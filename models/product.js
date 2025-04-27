const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: String,
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    unit: {
      type: String,
      required: true,
      enum: ['unidad', 'caja', 'bulto', 'paquete'], // tipos de unidades permitidas
      default: 'unidad',
    },
    unitsPerPackage: {
      // cantidad de unidades por caja/bulto
      type: Number,
      required: function () {
        return this.unit !== 'unidad';
      },
      min: 1,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
    },
    image: {
      type: String,
      default: 'default.png',
    },
    user: {
      // Cambiado a minúscula para seguir convenciones
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    minStock: {
      // stock mínimo para alertas
      type: Number,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sku: {
      type: String,
      unique: true,
      trim: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subcategory',
      required: true,
    },
    discount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discount',
    },
     aliquots: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Aliquot'
    }],
    // hasDiscount: {
    //   type: Boolean,
    //   default: false,
    // },
    // discountPercentage: {
    //   type: Number,
    //   default: null,
    // },
    // discountedPrice: {
    //   type: Number,
    //   default: null,
    // },
  },
  {
    timestamps: true, // añade createdAt y updatedAt automáticamente
  }
);

productSchema.methods.getDiscount = function () {
  // Verifica si hay un descuento activo y vigente
  if (
    this.discount &&
    this.discount.active &&
    (!this.discount.validUntil || this.discount.validUntil >= new Date())
  ) {
    return {
      value: this.discount.value,
      type: this.discount.type,
    };
  }
  return null;
};

productSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;


// Manejo de unidades y bultos:

// Campo unit para especificar el tipo de empaque

// Campo unitsPerPackage para indicar cuántas unidades hay por caja/bulto

// Virtual totalUnits que calcula automáticamente el total de unidades