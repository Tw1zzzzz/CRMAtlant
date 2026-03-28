import express from 'express';
import BrainTestAttempt from '../models/BrainTestAttempt';
import TestEntry from '../models/TestEntry';
import User from '../models/User';
import { protect, hasPerformanceCoachCrmSubscription } from '../middleware/auth';
import {
  BRAIN_DOMAINS,
  BrainTestKey,
  buildAttemptSeed,
  buildBrainPerformanceSummary,
  buildBrainTestsHistory,
  computeAttemptOutcome,
  computeFormScore,
  getCatalog,
  getCatalogEntry,
  isBrainTestKey
} from '../services/brainTestsService';

const router = express.Router();

router.use(protect);
router.use(hasPerformanceCoachCrmSubscription);

router.get('/catalog', (_req, res) => {
  return res.json(getCatalog());
});

router.post('/attempts/start', async (req: any, res) => {
  try {
    const { testKey, batterySessionId, clientMeta } = req.body || {};

    if (!testKey || typeof testKey !== 'string' || !isBrainTestKey(testKey)) {
      return res.status(400).json({ message: 'Некорректный testKey' });
    }

    const catalogEntry = getCatalogEntry(testKey);
    if (!catalogEntry) {
      return res.status(404).json({ message: 'Каталог теста не найден' });
    }

    const attempt = await BrainTestAttempt.create({
      userId: req.user._id,
      batterySessionId: typeof batterySessionId === 'string' ? batterySessionId : undefined,
      testKey,
      domain: BRAIN_DOMAINS[testKey],
      status: 'in_progress',
      seed: buildAttemptSeed(testKey),
      startedAt: new Date(),
      clientMeta: clientMeta || {},
      configSnapshot: catalogEntry.config
    });

    return res.status(201).json({
      attemptId: attempt._id,
      batterySessionId: attempt.batterySessionId || null,
      testKey,
      domain: BRAIN_DOMAINS[testKey],
      seed: attempt.seed,
      config: catalogEntry.config,
      instruction: catalogEntry.instruction,
      title: catalogEntry.title
    });
  } catch (error) {
    console.error('Error starting brain test attempt:', error);
    return res.status(500).json({ message: 'Не удалось запустить тест' });
  }
});

router.post('/attempts/:id/complete', async (req: any, res) => {
  try {
    const attempt = await BrainTestAttempt.findById(req.params.id);

    if (!attempt) {
      return res.status(404).json({ message: 'Попытка не найдена' });
    }

    if (String(attempt.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Нет доступа к этой попытке' });
    }

    if (attempt.status === 'completed') {
      return res.json(attempt);
    }

    const { rawMetrics = {}, clientMeta, stateSnapshot, context } = req.body || {};
    const completedAt = new Date();

    if (!isBrainTestKey(attempt.testKey)) {
      return res.status(400).json({ message: 'Попытка содержит неподдерживаемый testKey' });
    }

    const outcome = computeAttemptOutcome(attempt.testKey as BrainTestKey, {
      ...rawMetrics,
      durationMs: rawMetrics?.durationMs ?? req.body?.durationMs
    });

    const formState = outcome.validityStatus === 'valid' && typeof outcome.rawCompositeScore === 'number'
      ? await computeFormScore({
          userId: String(req.user._id),
          testKey: attempt.testKey as BrainTestKey,
          completedAt,
          currentAttemptId: String(attempt._id),
          rawCompositeScore: outcome.rawCompositeScore
        })
      : {
          formScore: null,
          baselineMedian: null,
          variability: null,
          baselineCount: 0
        };

    attempt.status = 'completed';
    attempt.completedAt = completedAt;
    attempt.durationMs = Number(rawMetrics?.durationMs || req.body?.durationMs || 0);
    attempt.rawMetrics = rawMetrics;
    attempt.derivedMetrics = {
      ...outcome.derivedMetrics,
      baselineMedian: formState.baselineMedian,
      variability: formState.variability,
      baselineCount: formState.baselineCount
    };
    attempt.rawCompositeScore = outcome.rawCompositeScore || 0;
    attempt.formScore = formState.formScore == null ? undefined : formState.formScore;
    attempt.validityStatus = outcome.validityStatus as 'valid' | 'invalid';
    attempt.invalidReasons = outcome.invalidReasons;
    attempt.clientMeta = clientMeta || attempt.clientMeta || {};

    if (attempt.validityStatus === 'valid' && !attempt.legacyTestEntryId) {
      const legacyEntry = await TestEntry.create({
        userId: req.user._id,
        date: completedAt,
        name: getCatalogEntry(attempt.testKey as BrainTestKey)?.title || attempt.testKey,
        isWeeklyTest: false,
        testType: attempt.testKey,
        scoreNormalized: attempt.rawCompositeScore,
        rawScore: attempt.rawCompositeScore,
        unit: 'score',
        durationSec: attempt.durationMs ? Number((attempt.durationMs / 1000).toFixed(2)) : undefined,
        attempts: 1,
        stateSnapshot,
        context: {
          ...(context || {}),
          source: 'brain_lab'
        },
        recordedBy: req.user._id,
        measuredAt: completedAt
      });
      attempt.legacyTestEntryId = legacyEntry._id;
    }

    await attempt.save();
    await User.findByIdAndUpdate(req.user._id, { completedTests: true });

    return res.json({
      success: true,
      data: {
        id: attempt._id,
        testKey: attempt.testKey,
        domain: attempt.domain,
        validityStatus: attempt.validityStatus,
        invalidReasons: attempt.invalidReasons,
        rawCompositeScore: attempt.rawCompositeScore,
        formScore: attempt.formScore,
        durationMs: attempt.durationMs,
        derivedMetrics: attempt.derivedMetrics
      }
    });
  } catch (error) {
    console.error('Error completing brain test attempt:', error);
    return res.status(500).json({ message: 'Не удалось завершить тест' });
  }
});

router.get('/me/summary', async (req: any, res) => {
  try {
    const requestedWindow = Number(req.query.window || 30);
    const windowDays = Number.isFinite(requestedWindow) && requestedWindow > 0 ? requestedWindow : 30;
    const summary = await buildBrainPerformanceSummary(String(req.user._id), windowDays);
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error loading brain performance summary:', error);
    return res.status(500).json({ message: 'Не удалось загрузить сводку Brain Lab' });
  }
});

router.get('/me/history', async (req: any, res) => {
  try {
    const { testKey } = req.query || {};
    const normalizedTestKey =
      typeof testKey === 'string' && isBrainTestKey(testKey) ? testKey : null;

    const history = await buildBrainTestsHistory(String(req.user._id), normalizedTestKey);
    return res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error loading brain tests history:', error);
    return res.status(500).json({ message: 'Не удалось загрузить историю Brain Lab' });
  }
});

export default router;
