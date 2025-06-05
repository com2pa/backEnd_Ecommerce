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
    .populate('items.product items.quantity total subtotal')
    .populate('discount')
    .populate('user','name')    
    
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
    const updatedCart = await cartServices.removeFromCart(user._id, productId);
    console.log(
      'actualizacion del carrito despues de eliminar producto',
      updatedCart
    );

    res.status(200).json({
      success: true,
      message: 'Producto eliminado del carrito',
      cart: updatedCart,
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

module.exports = cartRouter;
