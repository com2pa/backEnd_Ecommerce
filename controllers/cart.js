const cartRouter = require('express').Router();
const Cart = require('../models/cart');
// const Product = require('../models/product');
// const Discount = require('../models/discount');
const cartServices = require('../services/cartServices');

// Obtener el carrito del usuario actual
cartRouter.get('/', async (req, res) => {
  try {
    // 1. Verificar usuario
    const user = req.user;
    if (!user || user.role !== 'user') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    // 2. Obtener carrito con toda la información necesaria
    const cart = await Cart.findOne({ user: user.id })
    .populate({
    path: 'items.product',
    populate: [
      { path: 'aliquots' },
      { path: 'brand' },
      { path: 'subcategory' },
      { path: 'user', select: 'name' }
        ]
      })
       .populate({
          path: 'discount',
          populate: {
            path: 'products',
            select: '_id' // Solo necesitamos los IDs para verificar
          }
        })
      .populate('user', 'name')
      .populate('tasa', 'percentage');    
    
    // console.log(cart, 'obteniendo');
    if (!cart) {
      return res.status(200).json({
        success: true,
        cart: {
          items: [],
          subtotal: 0,
          total: 0,
          discount: [],
          user: user._id
        }
      });
    }
    res.status(200).json(cart);
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el carrito',
    });
  }
});
// verificar estado del carrito
cartRouter.get('/check-status', async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const cart = await Cart.findOne({ user: user._id });
     // Calcular isExpired primero
   const isExpired = !cart || 
                     (cart.expiresAt === undefined && cart.items?.length > 0) ||
                     (cart.expiresAt && cart.expiresAt <= new Date());
    console.log(`Verificando estado del carrito: 
      Existe: ${!!cart}, 
      Expiración: ${cart?.expiresAt}, 
      isExpired: ${isExpired}, 
      Hora actual: ${new Date()}`);
    res.status(200).json({
      exists: !!cart,
      isExpired: !cart || (cart.expiresAt && cart.expiresAt <= new Date()),
      isCheckoutPending: cart?.isCheckoutPending || false
    });
  } catch (error) {
    console.error('Error verificando estado del carrito:', error);
    res.status(500).json({ message: 'Error al verificar carrito' });
  }
});
cartRouter.post('/', async (req, res) => {
  try {
    // 1. Verificar usuario
    const user = req.user;
    if (!user || user.role !== 'user' ) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // 2. Validar datos de entrada
    const { productId, quantity } = req.body;
    console.log('productos enviados', productId, quantity);
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({
        message: 'Se requiere productId y cantidad válida (entero positivo)',
      });
    }

    //   // 3. Buscar producto y verificar stock
    //   const product = await Product.findById(productId);
    //   console.log('producto', product.name);
    //   if (!product) {
    //     return res.status(404).json({ message: 'Producto no encontrado' });
    //   }

    //   if (product.stock < quantity) {
    //     return res.status(400).json({
    //       message: `Stock insuficiente. Disponible: ${product.stock}`,
    //       availableStock: product.stock,
    //     });
    //   }

    //     // 4. Buscar descuento activo del producto
    //     const currentDate = new Date();
    //     console.log('Fecha actual:', currentDate);
    //     // verificar si el producto tiene descuento
    //     const discountActive = await Discount.findOne({
    //       product: productId,
    //       online: true,
    //       start_date: { $lte: currentDate },
    //       end_date: { $gte: currentDate },
    //     });
    //     console.log('descuento', discountActive);

    // 3. Delegar lógica de negocio al servicio
      const updatedCart = await cartServices.addToCart(user._id, productId, quantity);
      console.log('actualizacion del carrito', updatedCart)
      const io =req.app.get('io')
      // // emitir evento de nuevo mensaje a los client
      if(io){
        console.log('Emitting nuevo_mensaje event');
        io.to('admin-room').emit('nuevo_mensaje', {
            ...updatedCart.toObject(),
            notification: `Nuevo mensaje de ${user}`
        });
      }
      

   res.status(200).json({
     success: true,
     cart: updatedCart,
   });
  } catch (error) {
    console.error('Error:', error);
    const statusCode = error.message.includes('no encontrado')
      ? 404
      : error.message.includes('Stock insuficiente')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
});
// editar la cantidad de producto al carrito
cartRouter.put('/:productId', async (req, res) => {
  try {
    // 1. Verificar usuario autenticado
    const user = req.user;
    if (!user || user.role !== 'user') {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // 2. Obtener parámetros
    const { productId } = req.params;
    const { quantity } = req.body;
    
    console.log(`Actualizando producto ${productId} a cantidad ${quantity}`);
    
    // 3. Validar entrada
    if (!quantity) {
      return res.status(400).json({ 
        success: false,
        message: 'La cantidad debe ser un número válido' 
      });
    }

    const numericQuantity = parseInt(quantity);
    if (isNaN(numericQuantity)) {
        return res.status(400).json({ 
          success: false,
          message: 'La cantidad debe ser un número válido' 
        });
    }

    if (numericQuantity <= 0) {
      return res.status(400).json({ 
        success: false,
        message: 'La cantidad debe ser mayor a 0' 
      });
    }

    // 4. Actualizar cantidad
    const result = await cartServices.updateProductQuantity(
      user.id, 
      productId, 
      numericQuantity
    );
   
    console.log('Resultado de updateProductQuantity:', result);

    // 5. Verificar si se actualizó correctamente
    if (!result.success) {
      return res.status(400).json(result);
    }

    // 6. Obtener el carrito actualizado para devolverlo
    const freshCart = await Cart.findOne({ user: user.id })
      .populate('items.product')
      .populate('discount');

    res.status(200).json({
      success: true,
      message: result.message,
      cart: freshCart
    });
  } catch (error) {
    console.error('Error en PUT /cart/:productId:', error);
    const status = error.message.includes('no encontrado') ? 404 : 
                  error.message.includes('Stock insuficiente') ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message
    });
  }
});
// eliminando un elemento del carrito
cartRouter.delete('/:productId', async (req, res) => {
  try {
    // 1. Verificar usuario
    const user = req.user;
    if (!user || user.role !== 'user') {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // 2. Obtener el productId de los parámetros de la URL
    const { productId } = req.params;
    console.log('producto a eliminar:', productId);

    // 3. Delegar lógica de negocio al servicio
     const result = await cartServices.removeFromCart(user._id, productId);
    console.log(
      'actualizacion del carrito despues de eliminar producto',
      result
    );    
    res.status(200).json({
      success: true,
      message: 'Producto eliminado del carrito',
      cart: result.cart
    });
  } catch (error) {
    console.error('Error al eliminar producto del carrito:', error);
    const statusCode = error.message.includes('no encontrado') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
});
// Añade estas rutas a tu cartRouter:

// Iniciar proceso de pago (marcar carrito como pendiente)
cartRouter.post('/checkout/start', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'user') {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const cart = await Cart.findOne({ user: user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Carrito no encontrado' });
    }

    cart.isCheckoutPending = true;
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Proceso de pago iniciado',
      cart
    });
  } catch (error) {
    console.error('Error al iniciar pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar proceso de pago'
    });
  }
});

// Completar pago (eliminar carrito)
cartRouter.post('/checkout/complete', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'user') {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Eliminar el carrito directamente (sin cancelar timers)
    const deletedCart = await Cart.findOneAndDelete({ user: user._id });

    if (!deletedCart) {
      return res.status(404).json({ message: 'Carrito no encontrado' });
    }

    res.status(200).json({
      success: true,
      message: 'Pago completado y carrito eliminado',
      cart: deletedCart
    });
  } catch (error) {
    console.error('Error al completar pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar el pago'
    });
  }
});

// Ruta para limpieza manual (opcional, para administración)
cartRouter.delete('/cleanup', async (req, res) => {
  try {
    const abandonedCarts = await Cart.find({
      expiresAt: { $lte: new Date() },
      isCheckoutPending: false
    });

    let deletedCount = 0;
    for (const cart of abandonedCarts) {
      await cart.remove();
      deletedCount++;
    }

    res.status(200).json({
      success: true,
      message: `Se eliminaron ${deletedCount} carritos abandonados`
    });
  } catch (error) {
    console.error('Error en limpieza manual:', error);
    res.status(500).json({
      success: false,
      message: 'Error en limpieza manual'
    });
  }
});

module.exports = cartRouter;
