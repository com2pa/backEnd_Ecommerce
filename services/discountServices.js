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
      online: true,
    });

    return await newDiscount.save();
  },

  // Actualizar un descuento
  updateDiscount: async (discountId, discountData, userId) => {
    const { code, percentage, start_date, end_date, productId, online } = discountData;

    // Normalizar productIds a array (igual que en create)
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

    // Actualizar el descuento
    const updatedDiscount = await Discount.findByIdAndUpdate(
      discountId,
      {
        code,
        percentage,
        start_date,
        end_date,
        products: productIdsArray,
        online,
        updatedBy: userId,
      },
      { new: true, runValidators: true }
    ).populate('products', 'name');

    if (!updatedDiscount) {
      throw new Error('Descuento no encontrado');
    }

    return updatedDiscount;
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