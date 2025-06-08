const discountRouter = require('express').Router();
const { userExtractor } = require('../middlewares/auth');
const Discount = require('../models/discount');
const Product = require('../models/product');

// Mostrar todos los descuentos
discountRouter.get('/', async (req, res) => {
  const discounts = await Discount.find().populate('products', 'name');
  console.log('todos los descuentos ', discounts);
  res.json(discounts);
});

// Aplicar descuento a uno o más productos
discountRouter.post('/', userExtractor, async (req, res) => {
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
    if (percentage <= 0 || percentage >= 100) {
      return res.status(400).json({
        error: 'El porcentaje debe ser mayor que 0 y menor que 100',
      });
    }

    // 3. Normalizar productIds a array
    let productIdsArray;
    if (!productId) {
      productIdsArray = [];
    } else if (typeof productId === 'string') {
      productIdsArray = productId
        .split(/[\n,]/)
        .map((id) => id.trim())
        .filter((id) => id);
    } else if (Array.isArray(productId)) {
      productIdsArray = productId;
    } else {
      productIdsArray = [productId];
    }

    // Validaciones
    if (!code || percentage === undefined || !start_date || !end_date) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: code, percentage, start_date o end_date',
      });
    }

    // Validar fechas
    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({
        error: 'La fecha de inicio debe ser anterior a la fecha de fin',
      });
    }

    // 4. Verificar que los productos existen (si se proporcionaron)
    if (productIdsArray.length > 0) {
      const products = await Product.find({ _id: { $in: productIdsArray } });
      if (products.length !== productIdsArray.length) {
        return res.status(404).json({
          error: 'Algunos productos no existen',
          productsFound: products.map((p) => p._id),
          productsRequested: productIdsArray,
        });
      }
    }

    // 5. Crear el descuento
    const newDiscount = new Discount({
      code,
      percentage,
      start_date,
      end_date,
      products: productIdsArray,
      createdBy: user._id,
      online: false, // Por defecto inactivo hasta que se verifiquen las fechas
    });

    // Verificar si el descuento debe estar activo
    const now = new Date();
    if (new Date(start_date) <= now && new Date(end_date) >= now) {
      newDiscount.online = true;
    }

    const savedDiscount = await newDiscount.save();

    // 6. Responder con éxito
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
      products: savedDiscount.products.length > 0 
        ? (await Product.find({ _id: { $in: savedDiscount.products } })).map((product) => ({
            id: product._id,
            name: product.name,
            current_price: product.price,
            price_with_discount: product.price * (1 - percentage / 100),
          }))
        : [],
    });
  } catch (error) {
    console.error('Error completo:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'El código de descuento ya existe' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar descuento
discountRouter.delete('/:id', userExtractor, async (req, res) => { 
  const user = req.user;
  if (user.role !== 'admin') { // Corregí esta condición
    return res.status(401).json({
      message: 'No tienes permisos para realizar esta acción',
    });
  }
  const discountId = req.params.id;

  try {
    const discount = await Discount.findByIdAndDelete(discountId);
    console.log('descuento eliminado', discount);
    if (!discount) {
      return res.status(404).json({ message: 'Descuento no encontrado' });
    }
    res.json({ message: 'Descuento eliminado con éxito', discount });
  } catch (error) {
    console.error('Error completo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar descuento
discountRouter.patch('/:id', userExtractor, async (req, res) => {
  try {
    // 1. Verificar permisos
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(401).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }
    const discountId = req.params.id;
    
    // 2. Obtener datos del body
    const { code, percentage, start_date, end_date, productId, online } = req.body;

    console.log('Datos recibidos:', {
      code,
      percentage,
      start_date,
      end_date,
      productId,
      online
    });

    // 3. Verificar que se está enviando al menos un campo para actualizar
    if (!code && percentage === undefined && !start_date && !end_date && productId === undefined && online === undefined) {
      return res.status(400).json({ message: 'Debe proporcionar al menos un campo para actualizar' });
    }

    // 4. Verificar que el descuento existe
    const existingDiscount = await Discount.findById(discountId);
    if (!existingDiscount) {
      return res.status(404).json({ message: 'Descuento no encontrado' });
    }
    // validando el porcentage
    if (percentage !== undefined && (percentage <= 0 || percentage >= 100)) {
      return res.status(400).json({
        error: 'El porcentaje debe ser mayor que 0 y menor que 100',
      });
    }

    // 5. Preparar datos para actualización
    const updateData = {};
    const now = new Date();
    
    if (code) {
      // Verificar si el nuevo código ya existe (y no es el mismo)
      if (code !== existingDiscount.code) {
        const codeExists = await Discount.findOne({ code });
        if (codeExists) {
          return res.status(400).json({ message: 'El código ya está en uso por otro descuento' });
        }
      }
      updateData.code = code;
    }
    
    if (percentage !== undefined) updateData.percentage = percentage;
    
    // Convertir y validar fechas
    let startDateObj, endDateObj;
    
    if (start_date) {
      startDateObj = new Date(start_date);
      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: 'Fecha de inicio no válida' });
      }
      updateData.start_date = startDateObj;
    }
    
    if (end_date) {
      endDateObj = new Date(end_date);
      if (isNaN(endDateObj.getTime())) {
        return res.status(400).json({ error: 'Fecha de fin no válida' });
      }
      updateData.end_date = endDateObj;
    }

    // Validar rango de fechas si ambas están presentes
    if (start_date && end_date) {
      const effectiveStartDate = startDateObj || new Date(existingDiscount.start_date);
      const effectiveEndDate = endDateObj || new Date(existingDiscount.end_date);
      
      if (effectiveStartDate >= effectiveEndDate) {
        return res.status(400).json({
          error: 'La fecha de inicio debe ser anterior a la fecha de fin',
        });
      }
    }

    // Manejar productos si se proporcionan
    if (productId !== undefined) {
      let productIdsArray = [];
      
      if (productId === null || productId === '') {
        productIdsArray = [];
      } else if (typeof productId === 'string') {
        productIdsArray = productId
          .split(/[\n,]/)
          .map((id) => id.trim())
          .filter((id) => id);
      } else if (Array.isArray(productId)) {
        productIdsArray = productId;
      } else {
        productIdsArray = [productId];
      }

      // Verificar que los productos existen (solo si se proporcionaron IDs)
      if (productIdsArray.length > 0) {
        const products = await Product.find({ _id: { $in: productIdsArray } });
        if (products.length !== productIdsArray.length) {
          return res.status(404).json({
            error: 'Algunos productos no existen',
            productsFound: products.map((p) => p._id),
            productsRequested: productIdsArray,
          });
        }
      }

      updateData.products = productIdsArray;
    }

    // No permitir que se fuerce el estado online manualmente
    // if (online !== undefined) {
    //   return res.status(400).json({ 
    //     error: 'El estado online se calcula automáticamente según las fechas' 
    //   });
    // }

    // 6. Actualizar el estado online basado en fechas
    const effectiveStartDate = start_date ? startDateObj : new Date(existingDiscount.start_date);
    const effectiveEndDate = end_date ? endDateObj : new Date(existingDiscount.end_date);
    
    updateData.online = (effectiveStartDate <= now && effectiveEndDate >= now);

    // 7. Actualizar el descuento
    const updatedDiscount = await Discount.findByIdAndUpdate(
      discountId,
      updateData,
      { new: true, runValidators: true }
    ).populate('products', 'name price');

    // 8. Responder con éxito
    res.json({
      message: 'Descuento actualizado correctamente',
      discount: {
        id: updatedDiscount.id,
        code: updatedDiscount.code,
        percentage: updatedDiscount.percentage,
        start_date: updatedDiscount.start_date,
        end_date: updatedDiscount.end_date,
        online: updatedDiscount.online,
        products: updatedDiscount.products.map(product => ({
          id: product._id,
          name: product.name,
          price: product.price,
          price_with_discount: product.price * (1 - updatedDiscount.percentage / 100)
        }))
      }
    });
      
  } catch(error) {
    console.log('Error completo:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'El código de descuento ya existe' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }  
});
module.exports = discountRouter;