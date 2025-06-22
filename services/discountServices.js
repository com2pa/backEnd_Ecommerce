const Discount = require('../models/discount');
const Product = require('../models/product');

const discountService = {
  // Obtener todos los descuentos
  getAllDiscounts: async () => {
    return await Discount.find().populate('products', 'name').populate('createdBy', 'name email');
  },

  // Crear un nuevo descuento
  createDiscount: async (discountData, userId) => {
    const { code, percentage, start_date, end_date, productId } = discountData;
    if (!code || percentage === undefined || !start_date || !end_date) {
      throw new Error('Faltan campos requeridos: code, percentage, start_date o end_date');
    }
    // Validaciones adicionales necesarias
    if (percentage < 0 || percentage > 100) {
      throw new Error('El porcentaje debe ser mayor que 0 y menor que 100');
    }

    if (new Date(start_date) >= new Date(end_date)) {
      throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    // Normalizar productIds a array
    let productIdsArray;
    if (typeof productId === 'string') {
      productIdsArray = productId
        .split(/[\n,]/)
        .map((id) => id.trim())
        .filter((id) => id);
    } else if (Array.isArray(productId)) {
      productIdsArray = productId;
    } else {
      productIdsArray = [productId];
    }

    // Verificar que los productos existen
    const products = await Product.find({ _id: { $in: productIdsArray } });
    if (products.length !== productIdsArray.length) {
      throw new Error('Algunos productos no existen');
    }

    // Crear el descuento
    const newDiscount = new Discount({
      code,
      percentage,
      start_date,
      end_date,
      products: productIdsArray,
      createdBy: userId,
      online:  true,// Calculado según fechas
    });

    return await newDiscount.save();
  },

  // Actualizar un descuento
  updateDiscount: async (discountId, discountData, userId) => {
    const { code, percentage, start_date, end_date, productId, online } = discountData;
    
    // Normalizar productIds a array 
    let productIdsArray;
    if (typeof productId === 'string') {
      productIdsArray = productId
        .split(/[\n,]/)
        .map((id) => id.trim())
        .filter((id) => id);
    } else if (Array.isArray(productId)) {
      productIdsArray = productId;
    } else {
      productIdsArray = [productId];
    }

    // // Verificar que los productos existen   
    if (productIdsArray.length > 0) {
    const products = await Product.find({ _id: { $in: productIdsArray } });
      if (products.length !== productIdsArray.length) {
        throw new Error('Algunos productos no existen');
      }
    } 
    // Verificar si el código ya existe (si se está cambiando)
    if (code) {
      const existingCode = await Discount.findOne({ code, _id: { $ne: discountId } });
      if (existingCode) {
        throw new Error('El código de descuento ya está en uso');
      }
    }

     // Preparar datos de actualización
    const updateData = {
      ...discountData,
      updatedBy: userId,
      products: productIdsArray
    };

    // Si online es explícitamente false, mantenerlo así (desactivación manual)
    // Si es true o undefined, calcular según fechas
    if (online !== false) {
      delete updateData.online; // Dejar que el pre-save lo calcule
    }

    // Actualizar el descuento
     const updatedDiscount = await Discount.findByIdAndUpdate(
      discountId,
      updateData,
      { new: true, runValidators: true }
    ).populate('products', 'name');
    // / Si fue una desactivación manual, no recalcular
      if (online !== false) {
        // Forzar recálculo del estado
        updatedDiscount.online = updatedDiscount.checkStatus();
        await updatedDiscount.save();
      }

      return updatedDiscount;
    },

  // // Actualizar estados de descuentos según fechas
  updateDiscountsStatus: async () => {
    const now = new Date();
    // Desactivar descuentos que ya pasaron su fecha de fin
    await Discount.updateMany(
      { end_date: { $lt: now }, online: true },
      { $set: { online: false } }
    );
    // Activar descuentos que están en su período de vigencia
    await Discount.updateMany(
      { 
        start_date: { $lte: now },
        end_date: { $gte: now },
        online: false 
      },
      { $set: { online: true } }
    );
  },
  // Método para obtener descuentos activos
  getActiveDiscounts: async () => {
    const now = new Date();
    return await Discount.find({
      start_date: { $lte: now },
      end_date: { $gte: now },
      online: true
    }).populate('products', 'name price');
  },


  // Eliminar un descuento
  deleteDiscount: async (discountId) => {
    const discount = await Discount.findByIdAndDelete(discountId);
    if (!discount) {
      throw new Error('Descuento no encontrado');
    }
    return discount;
  },

  // Verificar si un código de descuento ya existe
  checkCodeExists: async (code, excludeId = null) => {
    const query = { code };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await Discount.findOne(query);
  },
};

module.exports = discountService;