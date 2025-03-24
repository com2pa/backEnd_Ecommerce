const http = require('http');
const app = require('./app');

const server = http.createServer(app);
server.listen(3000, () => {
  console.log('servidor corriendo en el puerto 3000');
});

module.exports = server;
