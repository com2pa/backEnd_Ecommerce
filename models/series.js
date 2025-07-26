const mongoose = require('mongoose');
const Cart = require('./cart');
const Order = require('./order');

const seriesSchema = new mongoose.Schema({
  documentType: {
    type: String,
    required: true,
    enum: ['Fat', 'NC'],
    default: 'Fat'
  },
  lastNumber: {
    type: Number,
    required: true,
    default: 0
  },
  prefix: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
   fiscalDetails: { // Campos para el desglose fiscal
    subtotal: {
      USD: { type: Number, required: true },
      VES: { type: Number, required: true }
    },
    discount: {
      amount: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 }
    },
    paymentFee: {
      amount: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 }
    },
    taxes: [{
      code: { type: String, required: true },
      name: { type: String, required: true },
      percentage: { type: Number, required: true },
      amountUSD: { type: Number, required: true },
      amountVES: { type: Number, required: true }
    }],
    totalTaxes: {
      USD: { type: Number, required: true },
      VES: { type: Number, required: true }
    },
    grandTotal: {
      USD: { type: Number, required: true },
      VES: { type: Number, required: true }
    },
    exchangeRate: {
      USD: { type: Number, required: true },
      lastUpdated: { type: Date, required: true }
    }
  },
  
  // Número fiscal único
  fiscalNumber: {
    type: String,
    unique: true,
    required: true
  },

},{ timestamps: true });

// Método para generar número de serie
seriesSchema.statics.generateSeriesNumber = async function(documentType) {
  const counter = await this.findOneAndUpdate(
    { documentType },
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true }
  );

  const formattedNumber = counter.lastNumber.toString().padStart(5, '0');
  return `${documentType}${formattedNumber}`;
};

seriesSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

const Series = mongoose.model("Series", seriesSchema);

module.exports = Series;