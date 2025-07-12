const { chromium } = require('playwright');
const BCV = require('../models/bcv');
const User = require('../models/user');

const BCV_URL = 'https://www.bcv.org.ve';

/**
 * Obtiene las tasas del BCV usando scraping con reintentos
 * @param {number} maxRetries - Número máximo de reintentos (default: 3)
 * @returns {Promise<{fecha: Date, tasas: Array, fuente_url: string}>}
 */
async function getBCVRatesWithScrapi(maxRetries = 3) {
  let attempts = 0;
  let lastError;
  
  while (attempts < maxRetries) {
    let browser;
    try {
      browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      // Configuraciones mejoradas
      await page.setDefaultTimeout(30000);
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9'
      });

      await page.goto(BCV_URL, { 
        waitUntil: 'networkidle', 
        timeout: 30000
      });

      // Esperar selectores con fallback
      await Promise.race([
        page.waitForSelector('#dolar .centrado strong', { timeout: 15000 }),
        page.waitForSelector('#euro .centrado strong', { timeout: 15000 })
      ]);

      // Extracción de tasas
      const rates = {};
      const currencySelectors = {
        'USD': '#dolar .centrado strong',
        'EUR': '#euro .centrado strong'
      };

      for (const [currency, selector] of Object.entries(currencySelectors)) {
      try {
        const rateText = await page.$eval(selector, el => el.innerText.trim());
        const rateValue = parseFloat(rateText.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(rateValue)) {
          rates[currency] = rateValue;
        } else {
          throw new Error(`Tasa inválida para ${currency}`);
        }
      } catch (error) {
        console.error(`Error obteniendo tasa para ${currency}: ${error.message}`);
        throw new Error(`Fallo al obtener tasa para ${currency}`);
      }
    }
      if (Object.keys(rates).length < 2) {
      throw new Error('No se pudieron obtener todas las tasas requeridas');
    }

      return {
        fecha: new Date(),
        tasas: Object.entries(rates).map(([moneda, tasa]) => ({
          moneda,
          tasa,
          unidad_medida: 'VES'
        })),
        fuente_url: BCV_URL
      };
    } catch (error) {
      lastError = error;
      attempts++;
      if (attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
      }
    } finally {
      if (browser) await browser.close();
    }
  }
  
  throw new Error(`Falló después de ${maxRetries} intentos: ${lastError.message}`);
}

/**
 * Obtiene tasa BCV desde DB o scraping si no existe
 * @param {Date|string} fecha - Fecha para consultar
 * @param {string} moneda - Moneda a consultar (USD o EUR)
 * @returns {Promise<Object>} Objeto con tasa y metadatos
 */
async function getBCV(fecha, moneda = 'USD') {
  try {
    // Normalizar fecha
    const fechaInicio = new Date(fecha);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaInicio.getDate() + 1);

    // Buscar en la base de datos
    const tasa = await BCV.findOne({
      fecha: { $gte: fechaInicio, $lt: fechaFin },
      moneda: moneda.toUpperCase()
    }).sort({ createdAt: -1 });

    if (!tasa) {
      // Si no hay en DB, intentar scraping
      const scrapedData = await getBCVRatesWithScrapi();
      const scrapedRate = scrapedData.tasas.find(t => t.moneda === moneda.toUpperCase());
      
      if (scrapedRate) {
        return {
          ...scrapedRate,
          fecha: scrapedData.fecha,
          fuente_url: scrapedData.fuente_url
        };
      }
      
      throw new Error(`No se encontró tasa para ${moneda} en la fecha especificada`);
    }

    return tasa;
  } catch (error) {
    throw error;
  }
}

/**
 * Guarda las tasas actuales del BCV si no existen para hoy
 * @returns {Promise<Array>} Tasas guardadas o existentes
 */
async function saveCurrentRates() {
 try {
    const { fecha, tasas, fuente_url } = await getBCVRatesWithScrapi();
    const fechaNormalizada = new Date(fecha);
    fechaNormalizada.setHours(0, 0, 0, 0);

    // Verificar que tenemos ambas tasas
    const requiredCurrencies = ['USD', 'EUR'];
    const missingCurrencies = requiredCurrencies.filter(
      curr => !tasas.some(t => t.moneda === curr)
    );

    if (missingCurrencies.length > 0) {
      throw new Error(`Faltan tasas para: ${missingCurrencies.join(', ')}`);
    }

    const savedRates = [];
    const savePromises = tasas.map(async (tasaData) => {
      try {
        const existingRate = await BCV.findOne({ 
          fecha: { 
            $gte: fechaNormalizada,
            $lt: new Date(fechaNormalizada.getTime() + 24 * 60 * 60 * 1000)
          },
          moneda: tasaData.moneda
        });

        if (!existingRate) {
          const newRate = new BCV({
            fecha: fechaNormalizada,
            tasa_oficial: tasaData.tasa,
            moneda: tasaData.moneda,
            unidad_medida: tasaData.unidad_medida,
            fuente_url
          });
          await newRate.save();
          savedRates.push(newRate);
        } else {
          savedRates.push(existingRate);
        }
      } catch (error) {
        console.error(`Error guardando tasa ${tasaData.moneda}: ${error.message}`);
        throw error;
      }
    });

    await Promise.all(savePromises);
    return savedRates;
  } catch (error) {
    console.error('Error en saveCurrentRates:', error.message);
    throw error;
  }
}


// Agrega esta nueva función para creación manual
// Optimizar la función createManualRate
async function createManualRate(rateData) {
  // Validar datos requeridos
  const requiredFields = ['fecha', 'moneda', 'tasa_oficial'];
  const missingFields = requiredFields.filter(field => !rateData[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Faltan campos requeridos: ${missingFields.join(', ')}`);
  }

  // Validar moneda
  const moneda = rateData.moneda.toUpperCase();
  if (!['USD', 'EUR'].includes(moneda)) {
    throw new Error('Moneda no soportada. Use USD o EUR');
  }

  // Validar y normalizar fecha
  const fecha = new Date(rateData.fecha);
  if (isNaN(fecha.getTime())) {
    throw new Error('Formato de fecha inválido');
  }
  fecha.setHours(0, 0, 0, 0);

  // Validar tasa numérica
  const tasa = parseFloat(rateData.tasa_oficial);
  if (isNaN(tasa) || tasa <= 0) {
    throw new Error('La tasa debe ser un número positivo');
  }

  // Verificar duplicados usando el índice compuesto
  const existingRate = await BCV.findOne({
    fecha: {
      $gte: fecha,
      $lt: new Date(fecha.getTime() + 24 * 60 * 60 * 1000)
    },
    moneda
  }).lean();

  if (existingRate) {
    throw new Error(`Ya existe una tasa para ${moneda} en la fecha especificada`);
  }
  
  // Crear y guardar la nueva tasa
  const newRate = new BCV({
    fecha,
    tasa_oficial: tasa,
    moneda,
    unidad_medida: 'VES',
    fuente_url: rateData.fuente_url || 'Manual',
    user: rateData.userId// Opcional: guardar quién creó la tasa
  });

  await newRate.save();
  return newRate;
}

// Actualiza el module.exports para incluir la nueva función
module.exports = {
  getBCVRatesWithScrapi,
  getBCV,
  saveCurrentRates,
  createManualRate
};