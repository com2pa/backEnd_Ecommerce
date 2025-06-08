const mongoose = require('mongoose');
// Función para convertir fechas de texto a Date
const parseCustomDate = (dateString) => {
  const [datePart, timePart] = dateString.split(' ');
  const [day, month, year] = datePart.split('/');
  const [hours, minutes] = timePart.split(':');
  
  // Crear fecha en UTC (para evitar problemas de zona horaria)
  return new Date(Date.UTC(year, month - 1, day, hours, minutes));
};

// Función para formatear Date a texto
const formatToCustomDate = (date) => {
  const d = new Date(date);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()} ${d.getUTCHours()}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
};
const discountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    start_date: { type: Date},
    end_date: { type: Date},
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    online: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

discountSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});
const Discount = mongoose.model('Discount', discountSchema);

module.exports = Discount;
