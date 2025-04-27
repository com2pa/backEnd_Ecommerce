const http = require('http');
const app = require('./app');
const systemLogger = require('./help/system/systemLogger');
const server = http.createServer(app);
server.listen(3000, async () => {
  console.log('servidor corriendo en el puerto 3000');
  await systemLogger.logSystemEvent('system_start', {
    version: process.env.npm_package_version,
    nodeVersion: process.version,
    platform: process.platform,
  });
});

module.exports = server;
