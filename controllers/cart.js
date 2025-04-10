const cartRouter = require('express').Router();
// const Cart = require('../models/cart');
// const Product = require('../models/product');
// const Discount = require('../models/discount');
const cartServices = require('../services/cartServices');

cartRouter.post('/', async (req, res) => {
  try {
    // 1. Verificar usuario
    const user = req.user;
    if (!user || user.role !== 'user') {
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
