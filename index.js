const http = require('http');
const { app, setSocketIO } = require('./app');
const systemLogger = require('./help/system/systemLogger');




const server = http.createServer(app);
// configuracion de websocket
const io = require('socket.io')(server, {
  cors: {
    origin: "*", // Ajusta esto según tus necesidades de CORS
    methods: ["GET", "POST"]
  }
});
// Pasar io a la app Express
setSocketIO(io);
console.log('WebSocket configurado correctamente:', typeof io);
// Manejar conexiones WebSocket
io.on('connection',(socket)=>{
  console.log('Cliente conectado:', socket.id);
  // creando el evento
  socket.onAny((event, ...args) => {
    console.log(`Evento recibido: ${event}`, args);
  });
  // Unirse como admin
  socket.on('unirse_admin', () => {
    socket.join('admin-room');
    console.log(`Admin conectado: ${socket.id}`);
  });
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
})

server.listen(3000, async () => {
  console.log('servidor corriendo en el puerto 3000');
  // await systemLogger.logSystemEvent('system_start', {
  //   version: process.env.npm_package_version,
  //   nodeVersion: process.version,
  //   platform: process.platform,
  // });
});

module.exports = {server,io};
