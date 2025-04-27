const Order = require('../models/order');
const Cart = require('../models/cart');

const createOrder = async (userId, cartId, paymentMethod) => {
  try {
    // 1. Obtener el carrito con toda la información necesaria
    const cart = await Cart.findById(cartId)
      .populate('items.product')
      .populate('discount');

    if (!cart) throw new Error('Carrito no encontrado');
    if (cart.user.toString() !== userId.toString())
      throw new Error('No autorizado');
    if (cart.items.length === 0) throw new Error('El carrito está vacío');

    // 2. Calcular información de descuentos por producto
    const itemsWithDiscounts = cart.items.map((item) => {
      // Buscar si este producto tiene descuento
      const productDiscount = cart.discount.find((d) =>
        d.products.includes(item.product._id)
        );
        
      return {
        product: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        hasDiscount: !!productDiscount,
        discountPercentage: productDiscount ? productDiscount.percentage : 0,
        discountAmount: productDiscount
          ? item.price * item.quantity * (productDiscount.percentage / 100)
          : 0,
      };
    });

    // 3. Calcular totales
    const subtotal = itemsWithDiscounts.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const totalDiscount = itemsWithDiscounts.reduce(
      (sum, item) => sum + item.discountAmount,
      0
    );
    const total = subtotal - totalDiscount;

    // 4. Crear la orden
    const order = new Order({
      user: userId,
      cart: cartId,
      paymentMethod,
      orderNumber: 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      items: itemsWithDiscounts,
      subtotal,
      discountAmount: totalDiscount,
      total,
      createdAt: new Date(),
    });

    // 5. Guardar la orden y limpiar carrito
    await order.save();
    await Cart.findByIdAndUpdate(cartId, { items: [], subtotal: 0, total: 0 });

    return order;
  } catch (error) {
    console.error('Error en createOrder:', error);
    throw error;
  }
};

module.exports = {
    createOrder
}