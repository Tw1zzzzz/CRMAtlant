import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import PlayerCard from '../models/PlayerCard';
import User from '../models/User';
import GameStats from '../models/GameStats';
import RawImport from '../models/RawImport';
import { asyncHandler } from '../middleware/asyncHandler';
import { badRequest } from '../utils/apiError';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseDateOnly(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inferFromFilename(fileName: string): { nickname: string | null; date: Date | null } {
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split('__');
  if (parts.length < 2) return { nickname: null, date: null };
  const nickname = parts[0]?.trim() || null;
  const date = parseDateOnly(parts[1]?.trim() || null);
  return { nickname, date };
}

function normalizeKey(k: string) {
  return k
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function toNumber(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(',', '.').replace('%', '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function resolveUserIdByNickname(nickname: string) {
  const card = await PlayerCard.findOne({ 'contacts.nickname': nickname }).select('userId');
  return card?.userId || null;
}

export const importCs2Excel = asyncHandler(async (req: any, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw badRequest('Файл не загружен (field: file)');

  const mode: 'team' | 'player' = (req.body?.mode === 'player' ? 'player' : 'team');
  const explicitDate = parseDateOnly(req.body?.date || null);
  const inferred = inferFromFilename(file.originalname);
  const day = explicitDate || inferred.date || new Date();
  const inferredNickname = mode === 'player' ? inferred.nickname : null;

  const rawImportsDir = path.join(process.cwd(), '../../uploads/raw-imports');
  ensureDir(rawImportsDir);
  const storedPath = path.join(rawImportsDir, file.filename);

  // Multer already saved file to disk; ensure we keep a stable path
  if (file.path && file.path !== storedPath) {
    try {
      fs.renameSync(file.path, storedPath);
    } catch {
      // If move fails, keep original path
    }
  }

  const workbook = xlsx.readFile(file.path || storedPath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw badRequest('В Excel нет листов');
  const sheet = workbook.Sheets[firstSheetName];

  const rowsRaw = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
  const errorsSample: Array<{ row: number; nickname?: string; reason: string }> = [];
  let okRows = 0;
  let rejectedRows = 0;

  for (let i = 0; i < rowsRaw.length; i++) {
    const rowIndex = i + 2; // header=1
    const row = rowsRaw[i] || {};

    // Normalize keys
    const norm: Record<string, any> = {};
    Object.keys(row).forEach(k => (norm[normalizeKey(k)] = row[k]));

    const nickname = (norm.nickname || inferredNickname || '').toString().trim();
    if (!nickname) {
      rejectedRows++;
      if (errorsSample.length < 50) errorsSample.push({ row: rowIndex, reason: 'nickname обязателен' });
      continue;
    }

    const userId = await resolveUserIdByNickname(nickname);
    if (!userId) {
      rejectedRows++;
      if (errorsSample.length < 50) errorsSample.push({ row: rowIndex, nickname, reason: 'Неизвестный nickname (нет PlayerCard.contacts.nickname)' });
      continue;
    }

    // Required numeric fields
    const matchesPlayed = toNumber(norm.matches_played);
    const wins = toNumber(norm.wins);
    const losses = toNumber(norm.losses);
    const draws = toNumber(norm.draws);

    const ctRounds = toNumber(norm.ct_rounds);
    const tRounds = toNumber(norm.t_rounds);
    const ctRoundsWon = toNumber(norm.ct_rounds_won);
    const tRoundsWon = toNumber(norm.t_rounds_won);
    const ctRoundsLost = toNumber(norm.ct_rounds_lost);
    const tRoundsLost = toNumber(norm.t_rounds_lost);

    const ctPistolsWon = toNumber(norm.ct_pistols_won);
    const ctPistolsTotal = toNumber(norm.ct_pistols_total);
    const tPistolsWon = toNumber(norm.t_pistols_won);
    const tPistolsTotal = toNumber(norm.t_pistols_total);

    const missing: string[] = [];
    if (matchesPlayed == null) missing.push('matches_played');
    if (wins == null) missing.push('wins');
    if (losses == null) missing.push('losses');
    if (draws == null) missing.push('draws');
    if (ctRounds == null) missing.push('ct_rounds');
    if (tRounds == null) missing.push('t_rounds');
    if (ctRoundsWon == null) missing.push('ct_rounds_won');
    if (tRoundsWon == null) missing.push('t_rounds_won');
    if (ctRoundsLost == null) missing.push('ct_rounds_lost');
    if (tRoundsLost == null) missing.push('t_rounds_lost');
    if (ctPistolsWon == null) missing.push('ct_pistols_won');
    if (ctPistolsTotal == null) missing.push('ct_pistols_total');
    if (tPistolsWon == null) missing.push('t_pistols_won');
    if (tPistolsTotal == null) missing.push('t_pistols_total');

    if (missing.length) {
      rejectedRows++;
      if (errorsSample.length < 50) errorsSample.push({ row: rowIndex, nickname, reason: `Нет колонок/значений: ${missing.join(', ')}` });
      continue;
    }

    if ((wins as number) + (losses as number) + (draws as number) !== (matchesPlayed as number)) {
      rejectedRows++;
      if (errorsSample.length < 50) errorsSample.push({ row: rowIndex, nickname, reason: 'wins+losses+draws != matches_played' });
      continue;
    }

    if ((ctRoundsWon as number) + (ctRoundsLost as number) !== (ctRounds as number)) {
      rejectedRows++;
      if (errorsSample.length < 50) errorsSample.push({ row: rowIndex, nickname, reason: 'ct_rounds_won+ct_rounds_lost != ct_rounds' });
      continue;
    }
    if ((tRoundsWon as number) + (tRoundsLost as number) !== (tRounds as number)) {
      rejectedRows++;
      if (errorsSample.length < 50) errorsSample.push({ row: rowIndex, nickname, reason: 't_rounds_won+t_rounds_lost != t_rounds' });
      continue;
    }
    if ((ctPistolsWon as number) > (ctPistolsTotal as number) || (tPistolsWon as number) > (tPistolsTotal as number)) {
      rejectedRows++;
      if (errorsSample.length < 50) errorsSample.push({ row: rowIndex, nickname, reason: 'pistols_won > pistols_total' });
      continue;
    }

    const ctSide = {
      // Match-level stats (we only have totals, so store them here)
      totalMatches: matchesPlayed as number,
      wins: wins as number,
      losses: losses as number,
      draws: draws as number,
      // Round-level stats (real CT rounds)
      totalRounds: ctRounds as number,
      roundsWon: ctRoundsWon as number,
      roundsLost: ctRoundsLost as number,
      pistolRounds: ctPistolsTotal as number,
      pistolRoundsWon: ctPistolsWon as number
    };

    const tSide = {
      // No per-side match totals in v1 import
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      // Round-level stats (real T rounds)
      totalRounds: tRounds as number,
      roundsWon: tRoundsWon as number,
      roundsLost: tRoundsLost as number,
      pistolRounds: tPistolsTotal as number,
      pistolRoundsWon: tPistolsWon as number
    };

    const targetDate = parseDateOnly(norm.date) || day;

    let doc = await GameStats.findOne({ userId, date: targetDate });
    if (!doc) {
      doc = new GameStats({
        userId,
        date: targetDate,
        kills: 0,
        deaths: 0,
        assists: 0,
        ctSide,
        tSide
      });
    } else {
      doc.kills = 0;
      doc.deaths = 0;
      doc.assists = 0;
      doc.ctSide = ctSide as any;
      doc.tSide = tSide as any;
    }

    await doc.save();
    okRows++;
  }

  const rawImport = await RawImport.create({
    uploadedBy: req.user?._id || null,
    kind: 'cs2_excel',
    mode,
    fileName: file.originalname,
    filePath: storedPath,
    inferredDate: day,
    report: {
      totalRows: rowsRaw.length,
      okRows,
      rejectedRows,
      errorsSample
    }
  });

  return res.json({
    success: true,
    importId: rawImport._id,
    report: rawImport.report
  });
});

