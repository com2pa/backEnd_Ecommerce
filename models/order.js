const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart',
  },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: Number,
      price: Number,
      name: String, // para mostrar en la orden sin necesidad de populate
    },
  ],
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: {
    //metodo de pago
    type: String,
    required: true,
    enum: ['credit_card', 'paypal', 'bank_transfer', 'cash_on_delivery'],
  },
  paymentStatus: {
    //status del pago
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  trackingNumber: String, //numero de seguimiento

  notes: String,
  discountAmount: {
    // Cambia el nombre para mayor claridad
    type: Number,
    default: 0,
  },
  discountsApplied: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discount',
    },
  ],
  discounts: [
    //Esto te daría aún más flexibilidad para rastrear los descuentos aplicados en cada orden.
    {
      discount: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
      amount: Number,
      code: String,
      percentage: Number,
    },
  ],
  subtotal: Number,
  discountAmount: Number,
  total: Number,
  paymentMethod: String,
  orderNumber: {
    type: String,
    unique: true,
    default: function () {
      return 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

orderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
