const bcvRouter = require('express').Router();
const { getBCV, getBCVRatesWithScrapi, saveCurrentRates } = require('../services/bcvServices');

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
    
    res.status(200).json(tasa);
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
bcvRouter.post('/save', async (req, res) => {
  try {
    const {user}=req.user
    if(user.role !== 'admin'){
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

module.exports = bcvRouter;