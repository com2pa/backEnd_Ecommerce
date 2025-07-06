require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MONGO_URL } = require('./config');
const usersRouter = require('./controllers/users');
const loginRouter = require('./controllers/login');
const logoutRouter = require('./controllers/logout');
const perfilUserRouter = require('./controllers/perfilUser');
const UploadRouter = require('./controllers/uploadProfileUser');
const { userExtractor } = require('./middlewares/auth');
const categoryRouter = require('./controllers/category');
const BrandRouter = require('./controllers/brand');
const productRouter = require('./controllers/product');
const subcategoryRouter = require('./controllers/subcategory');
const discountRouter = require('./controllers/discount');
const cartRouter = require('./controllers/cart');
const orderRouter = require('./controllers/order');
const aliquotsRouter = require('./controllers/aliquots');
const activityLogsRouter = require('./controllers/activityLog');
const auditMiddleware = require('./middlewares/auditMiddleware');
const roleManagementRouter = require('./controllers/roleManagement');
const refresRouter = require('./controllers/refres');
const bcvRouter = require('./controllers/bcv');
const path = require('path');
const versionRouter = require('./controllers/version');
const messageRouter = require('./controllers/message');
(
  // conexion base de datos
  async () => {
    try {
      await mongoose.connect(MONGO_URL, {
      serverSelectionTimeoutMS: 70000, // 30 segundos
      socketTimeoutMS: 60000, // 45 segundos
      maxPoolSize: 100, // Número máximo de conexiones
      retryWrites: true,
      retryReads: true,
    });
      console.log('conectado a la base de datos');
      // serverSelectionTimeoutMS: 30000, // 30 segundos
      // socketTimeoutMS: 45000, // 45 segundos
    } catch (error) {
       console.error('Error de conexión a MongoDB:', error);
    process.exit(1); // Salir si no hay conexión
    }
  }
)();
// // Manejar eventos de conexión
// mongoose.connection.on('connected', () => {
//   console.log('Mongoose conectado a DB');
// });

mongoose.connection.on('error', (err) => {
  console.error('Error de conexión Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose desconectado');
});

// middlewares
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// routes

// app.use('/api/products', require('./routes/products'))
// app.use('/api/users', require('./routes/users'))
// app.use('/api/orders', require('./routes/orders'))



app.use('/api/registration', usersRouter);
app.use('/api/login', loginRouter);
app.use('/api/logout', logoutRouter);
app.use('/api/refres', userExtractor,refresRouter);
app.use('/api/profile', perfilUserRouter);
app.use('/api/upload', userExtractor,  auditMiddleware('UserProfile'),  UploadRouter);
app.use('/api/category', auditMiddleware('Category'),  categoryRouter);
app.use('/api/brand', userExtractor, auditMiddleware('Brand'), BrandRouter);
app.use('/api/subcategory', auditMiddleware('Subcategory'),  subcategoryRouter);
app.use('/api/product',  auditMiddleware('Product'), productRouter);
app.use('/api/discount',    auditMiddleware('Discount'),  discountRouter);
app.use('/api/cart', userExtractor, auditMiddleware('Cart'), cartRouter);
app.use('/api/order', userExtractor, auditMiddleware('Order'), orderRouter);
app.use('/api/aliquots',auditMiddleware('Aliquot'),  aliquotsRouter);
app.use('/api/activity-logs', activityLogsRouter);
app.use('/api/roles',  userExtractor,  auditMiddleware('User'),  roleManagementRouter);
app.use('/api/tasas-bcv', bcvRouter); 
app.use('/api/contactame',messageRouter);
// Servir archivos estáticos desde la carpeta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// mostrando la version del sotfware
app.use('/api/version',versionRouter);

let io;
const setSocketIO = (socketIO) => {
  io = socketIO;
  // Pasar io al router de mensajes si es necesario
  app.set('io', io);
};

app.use(express.static(path.resolve(__dirname, 'dist')));

app.get('/*', function(request,response){
  response.sendFile(path.resolve(__dirname, 'dist', 'index.html' ));
});

module.exports = {app,setSocketIO};
