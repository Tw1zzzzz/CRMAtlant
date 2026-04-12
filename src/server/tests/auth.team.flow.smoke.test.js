const fs = require('fs');
const path = require('path');
const assert = require('assert');

const serverRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(serverRoot, relativePath), 'utf8');

const authController = read('controllers/authController.ts');
const authRoutes = read('routes/auth.ts');
const teamsRoutes = read('routes/teams.ts');
const userModel = read('models/User.ts');
const teamModel = read('models/Team.ts');

assert(
  authController.includes('export const forgotPassword'),
  'Auth controller should expose forgotPassword handler'
);

assert(
  authController.includes('export const resetPassword'),
  'Auth controller should expose resetPassword handler'
);

assert(
  authController.includes('export const resendVerificationEmail') &&
    authController.includes('export const verifyEmail') &&
    authController.includes('export const changePassword'),
  'Auth controller should expose email verification and password change handlers'
);

assert(
  authRoutes.includes("router.post('/forgot-password'"),
  'Auth routes should register forgot-password endpoint'
);

assert(
  authRoutes.includes("router.post('/reset-password'"),
  'Auth routes should register reset-password endpoint'
);

assert(
  authRoutes.includes("router.post('/resend-verification'") &&
    authRoutes.includes("router.post('/verify-email'") &&
    authRoutes.includes("router.post('/change-password'") &&
    authRoutes.includes("router.post('/profiles/player'") &&
    authRoutes.includes("router.post('/team-link'") &&
    authRoutes.includes("router.post('/switch-profile'"),
  'Auth routes should register email verification and password change endpoints'
);

assert(
  userModel.includes('passwordResetTokenHash') &&
    userModel.includes('passwordResetExpiresAt') &&
    userModel.includes('emailVerified') &&
    userModel.includes('emailVerificationTokenHash') &&
    userModel.includes('emailVerificationExpiresAt') &&
    userModel.includes('passwordChangedAt') &&
    userModel.includes('teamId') &&
    userModel.includes('teamName') &&
    userModel.includes('teamLogo') &&
    userModel.includes('profiles') &&
    userModel.includes('activeProfileKey'),
  'User model should include password reset, email verification, team and multi-profile fields'
);

assert(
  teamModel.includes('playerInviteCodeHash') &&
    teamModel.includes('staffInviteCodeHash') &&
    teamModel.includes('playerLimit') &&
    teamModel.includes('logo'),
  'Team model should define invite code hashes, player limit and team logo'
);

assert(
  teamsRoutes.includes("router.post('/:id/regenerate-player-code'") &&
    teamsRoutes.includes("router.post('/:id/regenerate-staff-code'") &&
    teamsRoutes.includes("router.get('/:id/members'") &&
    teamsRoutes.includes("router.patch('/:id/branding'"),
  'Teams routes should expose code rotation, members and branding endpoints'
);

console.log('Auth/team flow smoke tests passed');
