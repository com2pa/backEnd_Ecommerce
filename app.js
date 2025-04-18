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
const { usertExtractor } = require('./midlewares/auth');
const categoryRouter = require('./controllers/category');
const BrandRouter = require('./controllers/brand');
const productRouter = require('./controllers/product');
const subcategoryRouter = require('./controllers/subcategory');
const discountRouter = require('./controllers/discount');
const cartRouter = require('./controllers/cart');

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
app.use('/api/upload', usertExtractor, UploadRouter);
app.use('/api/category', usertExtractor, categoryRouter);
app.use('/api/brand', usertExtractor, BrandRouter);
app.use('/api/subcategory', usertExtractor, subcategoryRouter);
app.use('/api/product', usertExtractor, productRouter);
app.use('/api/discount', usertExtractor, discountRouter);
app.use('/api/cart', usertExtractor, cartRouter);

module.exports = app;
