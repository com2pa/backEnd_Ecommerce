const Cart = require('../models/cart');
const Product = require('../models/product');
const Discount = require('../models/discount');

// Función async para manejar operaciones asíncronas
const addToCart = async (userId, productId, quantity) => {
  try {
    // 1. Verificar producto y stock
    const product = await Product.findById(productId);
    if (!product) throw new Error('Producto no encontrado');
    if (product.stock < quantity) {
      throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
    }

    // 2. Buscar carrito existente o crear uno nuevo
    let cart = await Cart.findOne({ user: userId }).populate('discount');
    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
        discount: [],
      });
    }

    // 3. Buscar descuento activo para el producto
    const currentDate = new Date();
    const discount = await Discount.findOne({
      products: productId, // Cambiado de 'product' a 'products' para coincidir con tu schema
      online: true,
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate },
    });

    // 4. Calcular precio final
    const finalPrice = discount
      ? product.price * (1 - discount.percentage / 100)
      : product.price;

    // 5. Actualizar o añadir item al carrito
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
      cart.items[itemIndex].price = finalPrice; // Actualizar precio por si el descuento cambió
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price: finalPrice,
      });
    }

    // 6. Añadir descuento si existe y no está ya en el carrito
    if (discount && !cart.discount.some((d) => d._id.equals(discount._id))) {
      cart.discount.push(discount._id);
    }

    // 7. Calcular totales
    cart.subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Aplicar descuentos globales si los hubiera (aquí puedes expandir la lógica)
    cart.total = cart.subtotal;

    cart.lastUpdated = new Date();
    await cart.save();

    return cart;
  } catch (error) {
    console.error('Error en addToCart:', error);
    throw error;
  }
};

// Nueva función para calcular totales
const calculateCartTotals = (cart) => {
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Aquí puedes añadir lógica para aplicar descuentos globales
  const total = subtotal;

  return { subtotal, total };
};


// Función para eliminar producto del carrito
const removeFromCart = async (userId, productId) => {
  try {
    // 1. Buscar carrito existente
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new Error('Carrito no encontrado');
    }

    // 2. Encontrar índice del producto en el carrito
    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      throw new Error('Producto no encontrado en el carrito');
    }

    // 3. Eliminar el producto del array de items
    cart.items.splice(itemIndex, 1);

    // 4. Recalcular totales
    cart.subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    cart.total = cart.subtotal;

    // 5. Actualizar fecha de modificación
    cart.lastUpdated = new Date();

    // 6. Guardar cambios
    await cart.save();

    return cart;
  } catch (error) {
    console.error('Error en removeFromCart:', error);
    throw error;
  }
};


module.exports = {
    addToCart,
    removeFromCart
};
