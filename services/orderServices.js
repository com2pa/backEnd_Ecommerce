const Order = require('../models/order');
const Cart = require('../models/cart');
const Aliquots = require('../models/aliquots');
const BCV = require('../models/bcv');
const Series = require('../models/series'); // Importar el modelo Series

const createOrder = async (userId, cartId, paymentMethod) => {
  try {
    // 1. Obtener el carrito y tasas de cambio (mantener tu lógica existente)
    const cart = await Cart.findById(cartId).populate('items.product').populate('discount');
    const latestRates = await BCV.find().sort({ fecha: -1 }).limit(1);
    
    // 2. Generar número fiscal único
    const fiscalNumber = await Series.generateFiscalNumber('Fat');
    
    // 3. Calcular todos los valores como en el frontend
    const { 
      subtotal, 
      discountAmount, 
      discountedSubtotal, 
      taxesByAliquot, 
      totalIvaUSD, 
      totalIvaVES, 
      paymentFee, 
      totals 
    } = calculateOrderTotals(cart, paymentMethod, latestRates[0]);

    // 4. Preparar los impuestos para guardar
    const taxesDetails = Object.entries(taxesByAliquot).map(([key, tax]) => {
      const percentage = parseFloat(key.replace('%', ''));
      return {
        code: `IVA-${percentage}%`,
        name: `IVA ${percentage}%`,
        percentage,
        amountUSD: tax.usd,
        amountVES: tax.ves
      };
    });

    // 5. Crear la orden con todos los detalles
    const order = new Order({
      user: userId,
      cart: cartId,
      paymentMethod,
      fiscalNumber,
      orderNumber: 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      items: cart.items.map(item => ({
        product: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        priceVES: item.product.price * latestRates[0].tasa_oficial
      })),
      
      // Desglose fiscal completo
      fiscalDetails: {
        subtotal: {
          USD: subtotal,
          VES: subtotal * latestRates[0].tasa_oficial
        },
        discount: {
          amount: discountAmount,
          percentage: (discountAmount / subtotal) * 100
        },
        paymentFee: {
          amount: paymentFee,
          percentage: paymentMethod === 'credit_card_usd' ? 3 : 0
        },
        taxes: taxesDetails,
        totalTaxes: {
          USD: totalIvaUSD,
          VES: totalIvaVES
        },
        grandTotal: {
          USD: totals.USD,
          VES: totals.VES
        },
        exchangeRate: {
          USD: latestRates[0].tasa_oficial,
          lastUpdated: latestRates[0].fecha
        }
      },
      
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date()
    });

    await order.save();
    await Cart.findByIdAndDelete(cartId);
    return order;
  } catch (error) {
    console.error('Error en createOrder:', error);
    throw error;
  }
};

// Función auxiliar para calcular totales (similar a la del frontend)
const calculateOrderTotals = (cart, paymentMethod, exchangeRate) => {
  let subtotal = 0;
  let totalDiscount = 0;
  
  // Calcular subtotal y descuentos
  cart.items.forEach(item => {
    const itemPrice = item.product.price;
    const quantity = item.quantity;
    const itemSubtotal = itemPrice * quantity;
    subtotal += itemSubtotal;
    
    // Aplicar descuentos si existen
    if (cart.discount && cart.discount.length > 0) {
      cart.discount.forEach(discount => {
        if (discount.products.includes(item.product._id)) {
          totalDiscount += itemSubtotal * (discount.percentage / 100);
        }
      });
    }
  });
  
  const discountedSubtotal = subtotal - totalDiscount;
  const paymentFee = paymentMethod === 'credit_card_usd' ? discountedSubtotal * 0.03 : 0;
  
  // Calcular impuestos
  const taxesByAliquot = {};
  const aliquots = ['16%', '8%', '31%']; // Ejemplo, ajustar según tus alícuotas
  
  aliquots.forEach(aliquot => {
    taxesByAliquot[aliquot] = {
      usd: 0,
      ves: 0
    };
  });
  
  cart.items.forEach(item => {
    const productAliquot = item.product.aliquots; // Asumiendo que el producto tiene alícuotas
    if (productAliquot) {
      const aliquotKey = `${productAliquot.percentage}%`;
      const taxAmountUSD = (item.product.price * item.quantity) * (productAliquot.percentage / 100);
      const taxAmountVES = taxAmountUSD * exchangeRate.tasa_oficial;
      
      taxesByAliquot[aliquotKey].usd += taxAmountUSD;
      taxesByAliquot[aliquotKey].ves += taxAmountVES;
    }
  });
  
  // Calcular total de impuestos
  let totalIvaUSD = 0;
  let totalIvaVES = 0;
  Object.values(taxesByAliquot).forEach(tax => {
    totalIvaUSD += tax.usd;
    totalIvaVES += tax.ves;
  });
  
  // Totales finales
  const totals = {
    USD: discountedSubtotal + paymentFee + totalIvaUSD,
    VES: (discountedSubtotal + paymentFee) * exchangeRate.tasa_oficial + totalIvaVES
  };
  
  return {
    subtotal,
    discountAmount: totalDiscount,
    discountedSubtotal,
    taxesByAliquot,
    totalIvaUSD,
    totalIvaVES,
    paymentFee,
    totals
  };
};

module.exports = {
  createOrder
};