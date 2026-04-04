const fs = require('fs');
const path = require('path');
const assert = require('assert');

const serverRoot = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(serverRoot, relativePath), 'utf8');

const authController = read('controllers/authController.ts');
const statsRoutes = read('routes/stats.ts');
const calendarRoutes = read('routes/calendar.ts');
const server = read('server.ts');
const testsModel = read('models/TestEntry.ts');
const calendarEventModel = read('models/CalendarEvent.ts');
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
  server.includes("app.use('/api/calendar', calendarRoutes)"),
  'Server should register calendar API routes'
);

assert(
  supportRoute.includes("router.post('/request'"),
  'Support routes should include request submission endpoint'
);

assert(
  calendarRoutes.includes("router.get('/events'") &&
    calendarRoutes.includes("router.post('/events'") &&
    calendarRoutes.includes("router.put('/events/:id'") &&
    calendarRoutes.includes("router.delete('/events/:id'"),
  'Calendar routes should expose CRUD endpoints for events'
);

assert(
  testsModel.includes('stateSnapshot') && testsModel.includes('scoreNormalized'),
  'TestEntry model should include extended metrics'
);

assert(
  calendarEventModel.includes('scope') &&
    calendarEventModel.includes('ownerUserId') &&
    calendarEventModel.includes('teamId'),
  'CalendarEvent model should include scope and ownership fields'
);

console.log('Backend smoke tests passed');
