const fs = require('fs');
const path = require('path');
const assert = require('assert');

const serverRoot = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(serverRoot, relativePath), 'utf8');

const authController = read('controllers/authController.ts');
const statsRoutes = read('routes/stats.ts');
const server = read('server.ts');
const testsModel = read('models/TestEntry.ts');
const supportRoute = read('routes/support.ts');

assert(
  authController.includes('signJwt('),
  'Auth controller should sign tokens via local JWT helper'
);

assert(
  statsRoutes.includes("router.get('/tests/state-impact'"),
  'Stats routes should include tests state-impact endpoint'
);

assert(
  statsRoutes.includes("router.get('/analytics/overview'"),
  'Stats routes should include analytics overview endpoint'
);

assert(
  server.includes("app.use('/api/notifications', notificationsRoutes)"),
  'Server should register notifications API routes'
);

assert(
  server.includes("app.use('/api/support', supportRoutes)"),
  'Server should register support API routes'
);

assert(
  supportRoute.includes("router.post('/request'"),
  'Support routes should include request submission endpoint'
);

assert(
  testsModel.includes('stateSnapshot') && testsModel.includes('scoreNormalized'),
  'TestEntry model should include extended metrics'
);

console.log('Backend smoke tests passed');
