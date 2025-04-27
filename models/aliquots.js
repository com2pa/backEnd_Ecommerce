// modelo de base de datos de alicuotas
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const aliquotSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'El código de la alícuota es requerido'],
    unique: true,
    enum: ['G', 'R', 'A', 'E', 'P', 'IGTF'],
    uppercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'El nombre de la alícuota es requerido'],
    enum: [
      'General',
      'Reducida',
      'Adicional',
      'Exento',
      'Percibido',
      'Impuesto a Grandes Transacciones Financieras',
    ],
  },
  percentage: {
    type: Number,
    required: [true, 'El porcentaje es requerido'],
    min: 0,
    max: 100,
    default: 0,
  },
  appliesToForeignCurrency: {
    //aplica para moneda extranjera variable booleana IGTF
    type: Boolean,
    default: false,
  },
  // isActive: {
  //     type: Boolean,
  //     default: true
  // },
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});
// Añadir plugin de paginación
aliquotSchema.plugin(mongoosePaginate);

aliquotSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});
const Aliquot = mongoose.model('Aliquo', aliquotSchema);
module.exports = Aliquot;
