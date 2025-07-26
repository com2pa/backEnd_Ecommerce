const orderRouter = require('express').Router();
const orderServices = require('../services/orderServices');
const Order = require('../models/order')

orderRouter.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Formatear respuesta igual que en el frontend
    const response = {
      fiscalNumber: order.fiscalNumber,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        priceVES: item.priceVES,
        total: item.price * item.quantity,
        totalVES: item.priceVES * item.quantity
      })),
      fiscalDetails: {
        subtotal: order.fiscalDetails.subtotal,
        discount: order.fiscalDetails.discount,
        paymentFee: order.fiscalDetails.paymentFee,
        taxes: order.fiscalDetails.taxes,
        totalTaxes: order.fiscalDetails.totalTaxes,
        grandTotal: order.fiscalDetails.grandTotal,
        exchangeRate: order.fiscalDetails.exchangeRate
      },
      // ... otros campos que necesites
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// pdf
orderRouter.get('/:id/invoice', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Crear PDF con librería como pdfkit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    
    // Configurar respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Factura-${order.fiscalNumber}.pdf`);
    
    doc.pipe(res);
    
    // Agregar contenido al PDF (similar a tu desglose frontend)
    doc.fontSize(20).text(`Factura ${order.fiscalNumber}`, { align: 'center' });
    doc.moveDown();
    
    // Detalles de la orden
    doc.fontSize(14).text(`Fecha: ${order.createdAt.toLocaleDateString()}`);
    doc.text(`Estado: ${order.status}`);
    doc.moveDown();
    
    // Items
    doc.fontSize(16).text('Detalle de Productos:');
    order.items.forEach(item => {
      doc.text(`${item.quantity}x ${item.name} - ${item.price} USD (${item.priceVES} VES)`);
    });
    doc.moveDown();
    
    // Desglose fiscal
    doc.fontSize(16).text('Desglose Fiscal:');
    doc.text(`Subtotal: ${order.fiscalDetails.subtotal.USD} USD (${order.fiscalDetails.subtotal.VES} VES)`);
    
    if (order.fiscalDetails.discount.amount > 0) {
      doc.text(`Descuento: -${order.fiscalDetails.discount.amount} USD (${order.fiscalDetails.discount.amount * order.fiscalDetails.exchangeRate.USD} VES)`);
    }
    
    doc.text(`Comisión: ${order.fiscalDetails.paymentFee.amount} USD (${order.fiscalDetails.paymentFee.amount * order.fiscalDetails.exchangeRate.USD} VES)`);
    
    // Impuestos
    order.fiscalDetails.taxes.forEach(tax => {
      doc.text(`${tax.name}: ${tax.amountUSD} USD (${tax.amountVES} VES)`);
    });
    
    doc.moveDown();
    doc.fontSize(18).text(`Total: ${order.fiscalDetails.grandTotal.USD} USD (${order.fiscalDetails.grandTotal.VES} VES)`, { align: 'right' });
    
    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
        message: 'Se requieren cartId y paymentMethod',
      });
    }

    // 3. Crear la orden
    const order = await orderServices.createOrder(
      user._id,
      cartId,
      paymentMethod
    );

    // 4. Respuesta con detalles completos
    res.status(201).json({
      success: true,
      order: {
        _id: order._id, // Añadir el ID de la orden
        fiscalNumber: order.fiscalNumber,
        orderNumber: order.orderNumber,
        items: order.items.map(item => ({
          product: item.product,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          priceVES: item.priceVES
        })),
        subtotal: order.fiscalDetails.subtotal.USD,
        discountAmount: order.fiscalDetails.discount.amount,
        total: order.fiscalDetails.grandTotal.USD,
        paymentMethod: order.paymentMethod,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        fiscalDetails: order.fiscalDetails // Incluir todos los detalles fiscales
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

// Nueva ruta para obtener factura por número fiscal
orderRouter.get('/invoice/:fiscalNumber', async (req, res) => {
  try {
    const { fiscalNumber } = req.params;
    const user = req.user;

    const order = await Order.findOne({ fiscalNumber })
      .populate('items.product')
      .populate('user');

    if (!order) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }

    // Verificar permisos
    if (order.user._id.toString() !== user._id.toString() && user.role !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // Formatear respuesta con desglose de factura
    const invoiceDetails = {
      fiscalNumber: order.fiscalNumber,
      date: order.createdAt,
      customer: {
        id: order.user._id,
        name: order.user.name,
        // ... otros datos del cliente
      },
      items: order.items.map(item => ({
        productId: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity,
        currency: 'USD',
        // ... otros detalles del producto
      })),
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxes: order.taxes,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      status: order.status,
      paymentStatus: order.paymentStatus
    };

    res.status(200).json(invoiceDetails);
  } catch (error) {
    console.error('Error al obtener factura:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la factura',
    });
  }
});
module.exports = orderRouter;
