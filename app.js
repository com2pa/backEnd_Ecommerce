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
// conexion base de datos
(async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('conectado a la base de datos');
  } catch (error) {
    console.log(error);
  }
})();

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
app.use('/api/profile', perfilUserRouter);
app.use('/api/upload', userExtractor,auditMiddleware('UserProfile'), UploadRouter);
app.use('/api/category', userExtractor, auditMiddleware('Category'), categoryRouter);
app.use('/api/brand', userExtractor, auditMiddleware('Brand'), BrandRouter);
app.use('/api/subcategory', userExtractor,auditMiddleware('Subcategory'), subcategoryRouter);
app.use('/api/product', userExtractor, auditMiddleware('Product'), productRouter);
app.use('/api/discount', userExtractor, auditMiddleware('Discount'), discountRouter);
app.use('/api/cart', userExtractor, auditMiddleware('Cart'), cartRouter);
app.use('/api/order', userExtractor, auditMiddleware('Order'), orderRouter);
app.use('/api/aliquots', userExtractor,auditMiddleware('Aliquot'), aliquotsRouter);
app.use('/api/activity-logs', activityLogsRouter);
module.exports = app;
