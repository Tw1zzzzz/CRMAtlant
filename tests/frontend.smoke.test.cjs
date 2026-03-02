const fs = require('fs');
const path = require('path');
const assert = require('assert');

const projectRoot = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const sidebarSource = read('src/components/Sidebar.tsx');
const dashboardSource = read('src/pages/Dashboard.tsx');
const profileSource = read('src/pages/Profile.tsx');
const notificationsSource = read('src/components/NotificationsPanel.tsx');

const collectSourceFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fullPath.includes(`${path.sep}src${path.sep}server`)) {
        continue;
      }
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      continue;
    }

    if (entry.name.includes('.backup')) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
};

const sourceFiles = collectSourceFiles(path.join(projectRoot, 'src'));
const hardcodedPortHits = sourceFiles
  .map((filePath) => ({
    filePath,
    content: fs.readFileSync(filePath, 'utf8')
  }))
  .filter(({ content }) => content.includes('localhost:5000'));

assert(
  sidebarSource.includes('href: "/new-analytics"'),
  'Sidebar should route analytics entry to /new-analytics'
);

assert(
  !sidebarSource.includes('href: "/analytics"'),
  'Sidebar should not expose /analytics in navigation'
);

assert(
  !dashboardSource.includes('StaffPrivilegeUpgrade'),
  'Dashboard should not render StaffPrivilegeUpgrade'
);

assert(
  profileSource.includes('Права и доступ') && profileSource.includes('StaffPrivilegeUpgrade'),
  'Profile should include access section with StaffPrivilegeUpgrade'
);

assert(
  notificationsSource.includes('getNotifications()'),
  'NotificationsPanel should load notifications from API'
);

assert(
  hardcodedPortHits.length === 0,
  `Source should not hardcode localhost:5000. Found in: ${hardcodedPortHits
    .map(({ filePath }) => path.relative(projectRoot, filePath))
    .join(', ')}`
);

console.log('Frontend smoke tests passed');
