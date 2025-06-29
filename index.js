const http = require('http');
const { app, setSocketIO } = require('./app');
const systemLogger = require('./help/system/systemLogger');
const redis = require('redis');

// configuracion de redis
const redisClient =redis.createClient({
   username: process.env.REDIS_USERNAME,
   password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,         
    }
})
// Función para iniciar Redis
const startRedis= async()=>{
  try {
     await redisClient.connect();
    console.log('✅ Redis conectado correctamente');
    return true;
  } catch (err) {
    console.error('❌ Error al conectar con Redis:', err.message);
    return false;
  }
}
//  Crear servidor HTTP
const server = http.createServer(app);
// configuracion de websocket
const io = require('socket.io')(server, {
  cors: {
    origin: "*", // Ajusta esto según tus necesidades de CORS
    methods: ["GET", "POST"]
  }
});
// iniciar todo el servicio
const startServer = async () => {
  try {
    // Primero iniciamos Redis
    const redisReady = await startRedis();  
    
    if (!redisReady) {
      console.log('⚠️ Servidor iniciado sin Redis');
    } else {
      // Opcional: Guardar marca de tiempo de inicio en Redis
      await redisClient.set('server:start_time', new Date().toISOString());
      console.log('✅ Datos de inicio guardados en Redis');
    }

    // Luego iniciamos el servidor HTTP
    server.listen(3000, async () => {
      console.log('Servidor corriendo en el puerto 3000');
      // await systemLogger.logSystemEvent('system_start', {
      //   version: process.env.npm_package_version,
      //   nodeVersion: process.version,
      //   platform: process.platform,
      // });
    });

  } catch (err) {
    console.error('❌ Error crítico al iniciar el servidor:', err.message);
    process.exit(1); // Salir con código de error
  }
}

// 5. Manejo de errores y cierre limpio
process.on('SIGINT', async () => {
  console.log('\n🔻 Recibida señal de terminación (SIGINT)');
  
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
      console.log('✅ Conexión Redis cerrada');
    }
    server.close(() => {
      console.log('🛑 Servidor detenido correctamente');
      process.exit(0);
    });
  } catch (err) {
    console.error('Error durante el cierre:', err);
    process.exit(1);
  }
});
// Iniciar todo
startServer();

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

module.exports = {server,io};
