const discountRouter = require('express').Router();
const Discount = require('../models/discount');
const Product = require('../models/product');

// Mostrar todos los descuentos

discountRouter.get('/', async (req, res) => {
  const discounts = await Discount.find().populate('products', 'name');
  console.log('todos los descuentos ',discounts)
  res.json(discounts);
});
// Aplicar descuento a uno o más productos
discountRouter.post('/', async (req, res) => {
  try {
    // 1. Verificar permisos
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(401).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }

    // 2. Obtener y validar datos del request
    const { code, percentage, start_date, end_date, productId } = req.body;

    console.log('Datos recibidos:', {
      code,
      percentage,
      start_date,
      end_date,
      productId,
    });

    // 3. Normalizar productIds a array
    let productIdsArray;
    if (typeof productId === 'string') {
      // Si es string, separar por comas o saltos de línea
      productIdsArray = productId
        .split(/[\n,]/)
        .map((id) => id.trim())
        .filter((id) => id);
    } else if (Array.isArray(productId)) {
      // Si ya es array, usarlo directamente
      productIdsArray = productId;
    } else {
      // Si es un solo ID
      productIdsArray = [productId];
    }

    // Validaciones
    if (
      !code ||
      percentage === undefined ||
      !start_date ||
      !end_date ||
      !productIdsArray.length
    ) {
      return res.status(400).json({
        error:
          'Faltan campos requeridos: code, percentage, start_date, end_date o productIds',
      });
    }

    // 4. Verificar que los productos existen
    const products = await Product.find({ _id: { $in: productIdsArray } });

    if (products.length !== productIdsArray.length) {
      return res.status(404).json({
        error: 'Algunos productos no existen',
        productsFound: products.map((p) => p._id),
        productsRequested: productIdsArray,
      });
    }
    // cambiar el estado del descuesto a true
    await Discount.findByIdAndUpdate()

    // // 5. Crear el descuento
    const newDiscount = new Discount({
      code,
      percentage,
      start_date,
      end_date,
      products: productIdsArray,
      createdBy: user._id,
      online: true,
    });

    const savedDiscount = await newDiscount.save();

    // // 6. Responder con éxito
    res.status(201).json({
      message: 'Descuento aplicado correctamente',
      discount: {
        id: savedDiscount._id,
        code: savedDiscount.code,
        percentage: savedDiscount.percentage,
        start_date: savedDiscount.start_date,
        end_date: savedDiscount.end_date,
        online: savedDiscount.online,
      },
      products: products.map((product) => ({
        id: product._id,
        name: product.name,
        current_price: product.price,
        price_with_discount: product.price * (1 - percentage / 100),
      })),
    });
    // return res.status(200).json({
    //   message: 'Descuento aplicado correctamente',
    //   desciento: newDiscount,
    // });
  } catch (error) {
    console.error('Error completo:', error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: 'El código de descuento ya existe' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// eliminar descuento

discountRouter.delete('/:id', async (req, res) => { 
  const user = req.user;
  if (!user.role === 'admin') {
    return res.status(401).json({
      message: 'No tienes permisos para realizar esta acción',
    });
  }
  const discountId = req.params.id;

  try {
    const discount = await Discount.findByIdAndDelete(discountId);
    console.log('descuento eliminado',discount)
    if (!discount) {
      return res.status(404).json({ message: 'Descuento no encontrado' });
    }
    res.json({ message: 'Descuento eliminado con éxito' , discount});
  } catch (error) {
    console.error('Error completo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }

})

module.exports = discountRouter;
