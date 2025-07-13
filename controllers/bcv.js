const bcvRouter = require('express').Router();
const { getBCV, getBCVRatesWithScrapi, saveCurrentRates, createManualRate } = require('../services/bcvServices');
const User = require('../models/user');
const BCV = require('../models/bcv');
const { userExtractor } = require('../middlewares/auth');

// Validar parámetros de moneda
const validateCurrency = (moneda) => {
  const upperMoneda = moneda.toUpperCase();
  if (!['USD', 'EUR'].includes(upperMoneda)) {
    throw new Error('Moneda no soportada. Use USD o EUR');
  }
  return upperMoneda;
};

// Validar parámetros de fecha
const validateDate = (dateString) => {
  if (!dateString) return new Date();
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error('Formato de fecha inválido');
  }
  return date;
};

// Obtener tasa histórica
bcvRouter.get('/', async (req, res) => {
  try {
    const fecha = validateDate(req.query.fecha);
    const moneda = validateCurrency(req.query.moneda || 'USD' || 'EUR');


    const tasa = await getBCV(fecha, moneda);
    const tasa2= await BCV.find({}).populate('user', 'name')
    res.json(tasa2);
  } catch (error) {
    const statusCode = error.message.includes('no se encontró') ? 404 : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

// Obtener tasa más reciente (scraping en tiempo real)
bcvRouter.get('/latest', async (req, res) => {
  try {
    const moneda = req.query.moneda ? validateCurrency(req.query.moneda) : null;
    const data = await getBCVRatesWithScrapi();

    // Estructura de respuesta consistente
    const response = {
      fecha: data.fecha,
      fuente_url: data.fuente_url,
      tasas: moneda 
        ? [data.tasas.find(t => t.moneda === moneda)].filter(Boolean)
        : data.tasas
    };

    if (moneda && response.tasas.length === 0) {
      return res.status(404).json({ error: `No se encontró tasa para la moneda ${moneda}` });
    }

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Endpoint para guardar tasas actuales del BCV
bcvRouter.post('/save', userExtractor, async (req, res) => {
  try {
    const user = req.user
    if(!user || user.role !== 'admin'){
       return res.status(401).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }
    const savedRates = await saveCurrentRates();
    res.status(201).json({
      message: 'Tasas guardadas correctamente',
      tasas: savedRates
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// crear la tasa de bcv
// Reemplazar el endpoint POST /create con este código mejorado
bcvRouter.post('/create', userExtractor, async (req, res) => {
  try {
    const  user  = req.user;
    const { fecha, moneda, tasa_oficial, fuente_url } = req.body;
    
    if (user.role !== 'admin' ) {
      return res.status(401).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }

    // Validar campos requeridos
    if (!fecha || !moneda || !tasa_oficial) {
      return res.status(400).json({ error: 'Faltan campos requeridos: fecha, moneda o tasa_oficial' });
    }

    // Crear la tasa usando el servicio
    const savedRate = await createManualRate({
      fecha,
      moneda,
      tasa_oficial,
      fuente_url
    });

    res.status(201).json(savedRate);
  } catch (error) {
    console.error('Error en creación manual:', error);
    const statusCode = error.message.includes('permisos') ? 403 : 
                      error.message.includes('Faltan') || 
                      error.message.includes('Moneda no soportada') ? 400 : 
                      error.message.includes('Ya existe') ? 409 : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

module.exports = bcvRouter;