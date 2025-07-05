const mongoose = require('mongoose');
const Discount = require('./discount');
const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    discount: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Discount',
        default: null,
      },
    ],
    aliquot:{
      type: mongoose.Schema.Types.ObjectId,
      ref:'Aliquot',
    },
    tasa:[
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:'BCV',
      }
    ],
    subtotal: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    //  eliminación automática
    expiresAt: {
      type: Date,
      index: { expires: 0 } // Índice TTL (Time To Live)
    },
    //  verificar si el carrito está en proceso de pago
    isCheckoutPending: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);
// Método para calcular totales
cartSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.total = this.subtotal;
  //..
  return this;
};

// Método para cancelar eliminación (cuando el pago se completa)
cartSchema.methods.cancelDeletion = function() {
  this.expiresAt = undefined;
  this.isCheckoutPending = false;
  return this.save();
};
// Middleware para actualizar expiresAt cuando cambia el carrito
cartSchema.pre('save', function(next) {
  console.log('Ejecutando pre-save hook para carrito'); // Log de depuración
  
  // Solo actualizar expiresAt si hay items y no está en checkout
  if (this.items && this.items.length > 0 && !this.isCheckoutPending) {
    this.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    console.log('Estableciendo expiresAt:', this.expiresAt); // Log de depuración
  } else if (this.items && this.items.length === 0) {
    // Si el carrito está vacío, eliminar el expiresAt
    this.expiresAt = undefined;
    console.log('Carrito vacío - eliminando expiresAt'); // Log de depuración
  }
  next();
});
// Consulta para encontrar carritos abandonados
cartSchema.statics.findAbandonedCarts = function() {
  return this.find({
    expiresAt: { $lte: new Date() },
    isCheckoutPending: false
  });
};
let cleanupInterval; 
if (process.env.NODE_ENV === 'production') {
  // Verificar cada 5 minutos (ajustable)
  cleanupInterval = setInterval(async () => {
    try {
      console.log('Ejecutando limpieza de carritos abandonados...')
      const abandonedCarts = await Cart.find({
        expiresAt: { $lte: new Date() },
        isCheckoutPending: false
      });
      console.log(`Encontrados ${abandonedCarts.length} carritos para limpiar`);
      for (const cart of abandonedCarts) {
        await Cart.deleteOne({ _id: cart._id });
        console.log(`Carrito ${cart._id} eliminado por expiración`);
      }
    } catch (error) {
      console.error('Error en limpieza automática:', error);
    }
  }, 5 * 60 * 1000); // 5 minutos
}
// Manejar cierre adecuado del proceso
  process.on('SIGINT', () => {
    if (cleanupInterval) clearInterval(cleanupInterval);;
    process.exit();
  });
// 
cartSchema.methods.scheduleDeletion = async function() {
  try {
    if (!this.isCheckoutPending) {
      this.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      return await this.save();
    }
    return this;
  } catch (error) {
    console.error('Error al programar eliminación:', error);
    throw error;
  }
};
cartSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

const Cart = mongoose.model('Cart', cartSchema);

// Crear índice TTL para la eliminación automática
Cart.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  .then(() => console.log('Índice TTL creado para expiresAt'))
  .catch(err => console.error('Error creando índice TTL:', err));

Cart.on('index', function(err) {
  if (err) {
    console.error('Error en índices de Cart:', err);
  } else {
    console.log('Índices de Cart verificados correctamente');
  }
});
module.exports = Cart;
