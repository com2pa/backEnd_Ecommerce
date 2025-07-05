const Cart = require('../models/cart');
const Product = require('../models/product');
const Discount = require('../models/discount');
const {setTimeout} =require('timers/promises')

// // Objeto para almacenar los timers de eliminación
const cartDeletionTimers = new Map();

// Función async para manejar operaciones asíncronas
const addToCart = async (userId, productId, quantity) => {
  try {
    // 1. Verificar producto y stock
    const product = await Product.findById(productId);
    if (!product) throw new Error('Producto no encontrado');
    if (product.stock < quantity) {
      throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
    }

    // 2. Buscar carrito existente o crear uno nuevo
    let cart = await Cart.findOne({ user: userId }).populate('discount');
    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
        discount: [],
      });
    }

    // 3. Buscar descuento activo para el producto
    const currentDate = new Date();
    const discount = await Discount.findOne({
      products: productId, // Cambiado de 'product' a 'products' para coincidir con tu schema
      online: true,
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate },
    });

    // 4. Calcular precio final
    const finalPrice = discount
      ? product.price * (1 - discount.percentage / 100)
      : product.price;
    // 4. Usar el precio original del producto (sin descuento)
    // const finalPrice = product.price;

    // 5. Actualizar o añadir item al carrito
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
      cart.items[itemIndex].price = finalPrice;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price: finalPrice,
      });
    }
    // Establecer expiresAt manualmente si no está en checkout
    if (!cart.isCheckoutPending) {
      cart.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    }
    // 6. Añadir descuento si existe y no está ya en el carrito
    if (discount && !cart.discount.some((d) => d._id.equals(discount._id))) {
      cart.discount.push(discount._id);
    }

    // // 7.  Calcular subtotal sin descuentos
    // cart.subtotal = cart.items.reduce(
    //   (sum, item) => sum + item.price * item.quantity,
    //   0
    // );
    // // 8. Calcular total CON descuentos (pero solo como referencia)
    // const discountAmount = cart.discount.reduce((sum, discount) => {
    //   return sum + cart.subtotal * (discount.percentage / 100);
    // }, 0);

    // Aplicar descuentos globales si los hubiera (aquí puedes expandir la lógica)
    //  cart.total = cart.subtotal - discountAmount;
    // cart.total = cart.subtotal;
    const { subtotal, discountAmount, discountedSubtotal, total } = calculateCartTotals(cart);
    cart.subtotal = subtotal;
    cart.total = total;
    cart.discountAmount = discountAmount;
    
    cart.lastUpdated = new Date();
    await cart.save();

    return cart;
  } catch (error) {
    console.error('Error en addToCart:', error);
    throw error;
  }
};

// Nueva función para calcular totales 
const calculateCartTotals = (cart) => {
// Calcular subtotal sin descuentos
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Calcular descuentos aplicables
  let discountAmount = 0;
  let discountedSubtotal = subtotal;
  
  // Verificar si hay descuentos y están vigentes
  if (cart.discount && cart.discount.length > 0) {
    const currentDate = new Date();
    
    cart.discount.forEach(discount => {
      if (discount.start_date <= currentDate && discount.end_date >= currentDate) {
        discountAmount += subtotal * (discount.percentage / 100);
      }
    });
    
    discountedSubtotal = subtotal - discountAmount;
  }

  return {
    subtotal,
    discountAmount,
    discountedSubtotal,
    total: discountedSubtotal
  };
};


// Función para eliminar producto del carrito
const removeFromCart = async (userId, productId) => {
  try {
    // 1. Buscar carrito existente
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new Error('Carrito no encontrado');
    }

    // 2. Encontrar índice del producto en el carrito
    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      throw new Error('Producto no encontrado en el carrito');
    }

    // 3. Eliminar el producto del array de items
    cart.items.splice(itemIndex, 1);

    // 4. Recalcular totales
    cart.subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    cart.total = cart.subtotal;

    // 5. Actualizar fecha de modificación
    cart.lastUpdated = new Date();

    // 6. Guardar cambios
    await cart.save();

    return cart;
  } catch (error) {
    console.error('Error en removeFromCart:', error);
    throw error;
  }
};

// Editar cantidad de producto en el carrito
// const updateProductQuantity = async (userId, productId, newQuantity) => {
//   try {
//     // usuario 
//     console.log('Iniciando actualización de cantidad...');
//     // 1. Validar que la nueva cantidad sea válida
//     if (newQuantity <=0) {
//       throw new Error('La cantidad debe ser un número positivo');
//     }

//     // 2. Verificar producto y stock
//     const product = await Product.findById(productId);
//     // console.log('si existe producto ',product)
//     if (!product) throw new Error('Producto no encontrado');
//     if (product.stock < newQuantity) {
//       throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
//     }

//     // 3. Buscar carrito relacionado al usuario
//     const cartProducto = await Cart.findOne({ user: userId });
//     console.log('si existe el carrito', cartProducto)
//     if (!cartProducto) {
//       throw new Error('Carrito no encontrado');
//     }

//     // 4. Buscar item en el carrito
//     const itemIndex = cartProducto.items.findIndex(
//       (item) => item.product.toString() === productId.toString()
//     );
//     // console.log('encontrado',itemIndex);

//     if (itemIndex === -1) {
//       throw new Error('Producto no encontrado en el carrito');
//     }

//     // 5. Actualizar cantidad y precio
//     cartProducto.items[itemIndex].quantity = newQuantity;
//     cartProducto.items[itemIndex].price = product.price;

//     // 6. Recalcular totales
//     const { subtotal, total } = calculateCartTotals(cartProducto);
//     cartProducto.subtotal = subtotal;
//     cartProducto.total = total;
//     cartProducto.lastUpdated = new Date();

//     await cartProducto.save();

//     return {
//       success: true,
//       message: 'Cantidad actualizada correctamente',
//       car:cartProducto
//     };
//   } catch (error) {
//     console.error('Error al actualizar cantidad:', error);
//     throw error;
//   }
// };
const updateProductQuantity = async (userId, productId, newQuantity) => {
  try {
    console.log('Iniciando actualización de cantidad...');
    
    // Validación de cantidad
    if (newQuantity <= 0) {
      throw new Error('La cantidad debe ser un número positivo');
    }

    // Verificar producto y stock
    const product = await Product.findById(productId);
    if (!product) throw new Error('Producto no encontrado');
    if (product.stock < newQuantity) {
      throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
    }

    // Buscar el carrito primero
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new Error('Carrito no encontrado');
    }

    // Encontrar el índice del producto en el carrito
    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId.toString()
    );
    
    if (itemIndex === -1) {
      throw new Error('Producto no encontrado en el carrito');
    }

    // Actualizar la cantidad y el precio
    cart.items[itemIndex].quantity = newQuantity;
    cart.items[itemIndex].price = product.price;

    // Recalcular totales
    const { subtotal, total } = calculateCartTotals(cart);
    cart.subtotal = subtotal;
    cart.total = total;
    cart.lastUpdated = new Date();

    // Guardar los cambios
    const updatedCart = await cart.save();

    return {
      success: true,
      message: 'Cantidad actualizada correctamente',
      cart: updatedCart
    };
  } catch (error) {
    console.error('Error detallado al actualizar cantidad:', error);
    throw error;
  }
};


module.exports = {
  addToCart,
  removeFromCart,
  updateProductQuantity,
  
};
