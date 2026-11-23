'use strict';

const app = require('./src/app');
const { PORT } = require('./src/config');
const backup = require('./src/services/backup');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`日子服务已启动: http://0.0.0.0:${PORT}`);
  backup.startScheduler();
});
