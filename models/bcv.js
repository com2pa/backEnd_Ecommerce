const mongoose = require('mongoose');

const bcvSchema = new mongoose.Schema({
  user:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  fecha: {
    type: Date,
    required: true,
    index: true,
    default: Date.now
  },
  tasa_oficial: {
    type: Number,
    required: true,
    min: 0
  },
  moneda: {
    type: String,
    required: true,
    enum: ['USD', 'EUR']
  },
  unidad_medida: {
    type: String,
    required: true,
    default: 'VES',
    enum: ['VES', 'VED']
  },
  fuente_url: {
    type: String,
    enum: ["https://www.bcv.org.ve", "manual"],
    default: 'https://www.bcv.org.ve'
  },
  publicado: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice compuesto para evitar duplicados (fecha + moneda)
bcvSchema.index({ fecha: 1, moneda: 1 }, { unique: true });

// Índice para búsquedas por moneda y fecha
bcvSchema.index({ moneda: 1, fecha: -1 });

bcvSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    // Formatear fecha para mejor visualización
    if (returnedObject.fecha) {
      returnedObject.fecha = new Date(returnedObject.fecha).toISOString().split('T')[0];
    }
  }
});

const BCV = mongoose.model('BCV', bcvSchema);
module.exports = BCV;