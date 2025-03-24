require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose')
const cors = require('cors')
const cookieParser = require('cookie-parser');
const { MONGO_URL } = require('./config');


    // conexion base de datos
    (async () => {
        try {
            await mongoose.connect(MONGO_URL);
            console.log('conectado a la base de datos')
        
        } catch (error) {
            console.log(error)
        }
    })();

// middlewares
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// routes

// app.use('/api/products', require('./routes/products'))
// app.use('/api/users', require('./routes/users'))
// app.use('/api/orders', require('./routes/orders'))

module.exports = app;

