require('./register-ts.cjs');
const assert = require('assert');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../models/User.ts').default;
const Team = require('../models/Team.ts').default;
const subscriptionAccessModule = require('../utils/subscriptionAccess.ts');
const { hashOpaqueToken } = require('../utils/securityTokens.ts');

const authModulePath = path.resolve(__dirname, '../controllers/authController.ts');
const playerCardModulePath = path.resolve(__dirname, '../models/PlayerCard.ts');
const faceitAccountModulePath = path.resolve(__dirname, '../models/FaceitAccount.ts');
const faceitServiceModulePath = path.resolve(__dirname, '../services/faceitService.ts');
const mailServiceModulePath = path.resolve(__dirname, '../services/mailService.ts');

const originalUserFindById = User.findById;
const originalUserCountDocuments = User.countDocuments;
const originalTeamFind = Team.find;
const originalTeamFindById = Team.findById;
const originalResolveEffectiveSubscriptionAccess = subscriptionAccessModule.resolveEffectiveSubscriptionAccess;
const originalMongooseReadyState = mongoose.connection.readyState;

let passed = 0;
let failed = 0;

const loadAuthModule = () => {
  require.cache[playerCardModulePath] = {
    id: playerCardModulePath,
    filename: playerCardModulePath,
    loaded: true,
    exports: {
      __esModule: true,
      default: {
        findOne: async () => null,
        create: async () => null
      }
    }
  };

  require.cache[faceitAccountModulePath] = {
    id: faceitAccountModulePath,
    filename: faceitAccountModulePath,
    loaded: true,
    exports: {
      __esModule: true,
      default: {
        findOne: async () => null,
        create: async () => null
      }
    }
  };

  require.cache[faceitServiceModulePath] = {
    id: faceitServiceModulePath,
    filename: faceitServiceModulePath,
    loaded: true,
    exports: {
      __esModule: true,
      default: {
        resolveFaceitProfile: async () => null,
        importMatches: async () => 0
      }
    }
  };

  require.cache[mailServiceModulePath] = {
    id: mailServiceModulePath,
    filename: mailServiceModulePath,
    loaded: true,
    exports: {
      __esModule: true,
      sendPasswordResetEmail: async () => undefined,
      sendVerificationEmail: async () => undefined
    }
  };

  delete require.cache[authModulePath];
  return require(authModulePath);
};

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  }
});

const createUserDoc = (overrides = {}) => ({
  _id: 'user-1',
  name: 'User',
  email: 'user@example.com',
  role: 'player',
  playerType: 'solo',
  teamId: null,
  teamName: '',
  teamLogo: '',
  profiles: [
    {
      key: 'player_solo',
      label: 'Игрок / Solo',
      role: 'player',
      playerType: 'solo',
      teamId: null,
      teamName: '',
      teamLogo: '',
      privilegeKey: ''
    }
  ],
  activeProfileKey: 'player_solo',
  completedTests: false,
  completedBalanceWheel: false,
  baselineAssessment: null,
  saveCalls: 0,
  async save() {
    this.saveCalls += 1;
    return this;
  },
  ...overrides
});

const createFindByIdMock = (editableUser) => {
  let calls = 0;

  return () => {
    calls += 1;

    if (calls === 1) {
      return editableUser;
    }

    return {
      select() {
        return {
          populate: async () => editableUser
        };
      }
    };
  };
};

const createTeamDoc = ({ id, name, logo = '', playerCode, staffCode, playerLimit = 7 }) => ({
  _id: id,
  name,
  logo,
  playerLimit,
  playerInviteCodeHash: playerCode ? hashOpaqueToken(playerCode) : null,
  staffInviteCodeHash: staffCode ? hashOpaqueToken(staffCode) : null,
  isActive: true
});

const runTest = async (name, fn) => {
  try {
    User.findById = originalUserFindById;
    User.countDocuments = originalUserCountDocuments;
    Team.find = originalTeamFind;
    Team.findById = originalTeamFindById;
    subscriptionAccessModule.resolveEffectiveSubscriptionAccess = originalResolveEffectiveSubscriptionAccess;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    await fn();
    passed += 1;
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
};

const main = async () => {
  await runTest('player solo can add player team profile without losing solo profile', async () => {
    const team = createTeamDoc({
      id: 'team-1',
      name: 'Atlant',
      playerCode: 'player-code'
    });
    const userDoc = createUserDoc();

    Team.find = () => ({
      select: async () => [team]
    });
    Team.findById = () => ({
      select: async () => ({ playerLimit: 7 })
    });
    User.countDocuments = async () => 0;
    User.findById = createFindByIdMock(userDoc);
    subscriptionAccessModule.resolveEffectiveSubscriptionAccess = async () => ({
      hasPerformanceCoachCrmAccess: false,
      hasCorrelationAnalysisAccess: false,
      hasGameStatsAccess: false,
      inheritedFromTeamOwnerId: null
    });

    const { linkTeamProfile } = loadAuthModule();
    const req = {
      user: { _id: 'user-1', role: 'player', playerType: 'solo' },
      body: { teamCode: 'player-code' }
    };
    const res = createResponse();

    await linkTeamProfile(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.status, 'linked');
    assert.strictEqual(res.payload.targetProfileKey, 'player_team');
    assert.strictEqual(userDoc.saveCalls, 1);
    assert(userDoc.profiles.some((profile) => profile.key === 'player_solo'));
    assert(userDoc.profiles.some((profile) => profile.key === 'player_team' && profile.teamName === 'Atlant'));
  });

  await runTest('player profile rejects staff invite code', async () => {
    const team = createTeamDoc({
      id: 'team-2',
      name: 'Atlant Staff',
      staffCode: 'staff-code'
    });
    const userDoc = createUserDoc();

    Team.find = () => ({
      select: async () => [team]
    });
    User.findById = createFindByIdMock(userDoc);

    const { linkTeamProfile } = loadAuthModule();
    const req = {
      user: { _id: 'user-1', role: 'player', playerType: 'solo' },
      body: { teamCode: 'staff-code' }
    };
    const res = createResponse();

    await linkTeamProfile(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.match(res.payload.message, /player-коду/i);
    assert.strictEqual(userDoc.saveCalls, 0);
  });

  await runTest('existing team profile requires confirmation before relink', async () => {
    const currentTeamId = 'team-current';
    const nextTeam = createTeamDoc({
      id: 'team-next',
      name: 'Next Squad',
      playerCode: 'next-player-code'
    });
    const userDoc = createUserDoc({
      profiles: [
        {
          key: 'player_solo',
          label: 'Игрок / Solo',
          role: 'player',
          playerType: 'solo',
          teamId: null,
          teamName: '',
          teamLogo: '',
          privilegeKey: ''
        },
        {
          key: 'player_team',
          label: 'Игрок / Team',
          role: 'player',
          playerType: 'team',
          teamId: currentTeamId,
          teamName: 'Current Squad',
          teamLogo: '',
          privilegeKey: ''
        }
      ]
    });

    Team.find = () => ({
      select: async () => [nextTeam]
    });
    User.findById = createFindByIdMock(userDoc);

    const { linkTeamProfile } = loadAuthModule();
    const req = {
      user: { _id: 'user-1', role: 'player', playerType: 'solo' },
      body: { teamCode: 'next-player-code' }
    };
    const res = createResponse();

    await linkTeamProfile(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.status, 'confirmation_required');
    assert.strictEqual(res.payload.targetProfileKey, 'player_team');
    assert.strictEqual(res.payload.currentTeam.name, 'Current Squad');
    assert.strictEqual(res.payload.nextTeam.name, 'Next Squad');
    assert.strictEqual(userDoc.saveCalls, 0);
  });

  await runTest('staff can add staff team profile with staff code', async () => {
    const team = createTeamDoc({
      id: 'team-staff',
      name: 'Staff Team',
      staffCode: 'staff-link-code'
    });
    const userDoc = createUserDoc({
      role: 'staff',
      playerType: 'solo',
      profiles: [
        {
          key: 'staff_solo',
          label: 'Стафф',
          role: 'staff',
          playerType: 'solo',
          teamId: null,
          teamName: '',
          teamLogo: '',
          privilegeKey: 'PRIV'
        }
      ],
      activeProfileKey: 'staff_solo'
    });

    Team.find = () => ({
      select: async () => [team]
    });
    User.findById = createFindByIdMock(userDoc);
    subscriptionAccessModule.resolveEffectiveSubscriptionAccess = async () => ({
      hasPerformanceCoachCrmAccess: false,
      hasCorrelationAnalysisAccess: false,
      hasGameStatsAccess: false,
      inheritedFromTeamOwnerId: null
    });

    const { linkTeamProfile } = loadAuthModule();
    const req = {
      user: { _id: 'user-1', role: 'staff', playerType: 'solo', privilegeKey: 'PRIV' },
      body: { teamCode: 'staff-link-code' }
    };
    const res = createResponse();

    await linkTeamProfile(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.status, 'linked');
    assert.strictEqual(res.payload.targetProfileKey, 'staff_team');
    assert(userDoc.profiles.some((profile) => profile.key === 'staff_solo'));
    assert(userDoc.profiles.some((profile) => profile.key === 'staff_team' && profile.teamName === 'Staff Team'));
  });

  if (failed > 0) {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalMongooseReadyState,
      configurable: true
    });
    console.error(`\nAuth team-link behavior tests failed: ${failed} of ${passed + failed}`);
    process.exit(1);
  }

  Object.defineProperty(mongoose.connection, 'readyState', {
    value: originalMongooseReadyState,
    configurable: true
  });
  console.log(`\nAuth team-link behavior tests passed: ${passed}/${passed + failed}`);
};

main().catch((error) => {
  Object.defineProperty(mongoose.connection, 'readyState', {
    value: originalMongooseReadyState,
    configurable: true
  });
  console.error(error);
  process.exit(1);
});
