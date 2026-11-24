'use strict';

const app = require('./src/app');
const { PORT } = require('./src/config');
const backup = require('./src/services/backup');
const auth = require('./src/services/auth');

app.listen(PORT, '0.0.0.0', () => {
  auth.pruneSessions();
  console.log(`时间管理局服务已启动: http://0.0.0.0:${PORT}`);
  backup.startScheduler();
});
