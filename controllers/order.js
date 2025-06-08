const orderRouter = require('express').Router();
const orderServices = require('../services/orderServices');
const Order = require('../models/order')
// obtener la orden
orderRouter.get('/', async (req, res) => {
  try {
    // Verificar usuario
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Obtener órdenes del usuario
    const orders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 }) // Ordenar por fecha descendente
      .lean();

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las órdenes',
    });
  }
});

// creando la orden
orderRouter.post('/', async (req, res) => {
  try {
    // 1. Verificar usuario
    const user = req.user;
    if (!user || user.role !== 'user') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    // 2. Validar datos de entrada
    const { cartId, paymentMethod } = req.body;

    if (!cartId || !paymentMethod) {
      return res.status(400).json({
        message: 'Se requieren cartId,  paymentMethod',
      });
    }

    // 3. Crear la orden
    const order = await orderServices.createOrder(
      user._id,
      cartId,
      paymentMethod
    );

    res.status(201).json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        items: order.items,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        total: order.total,
        paymentMethod: order.paymentMethod,
        discounts: order.discounts,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error('Error al crear orden:', error);
    const statusCode = error.message.includes('no encontrado')
      ? 404
      : error.message.includes('No autorizado')
      ? 403
      : error.message.includes('El carrito está vacío')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
});
module.exports = orderRouter;
