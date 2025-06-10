// orderServices.js
const Order = require('../models/order');
const Cart = require('../models/cart');
const Aliquots = require('../models/aliquots');
const BCV = require('../models/bcv');

const createOrder = async (userId, cartId, paymentMethod) => {
  try {
    // 1. Obtener el carrito con toda la información necesaria
    const cart = await Cart.findById(cartId)
      .populate('items.product')
      .populate('discount');

    if (!cart) throw new Error('Carrito no encontrado');
    if (cart.user.toString() !== userId.toString())
      throw new Error('No autorizado');
    if (cart.items.length === 0) throw new Error('El carrito está vacío');

    // 2. Obtener tasas de cambio más recientes
    const latestRates = await BCV.find().sort({ fecha: -1 }).limit(1);
    if (!latestRates || latestRates.length === 0) {
      throw new Error('No se encontraron tasas de cambio disponibles');
    }
    
    const { tasa_oficial: usdRate, moneda } = latestRates.find(r => r.moneda === 'USD');
    const { tasa_oficial: eurRate } = latestRates.find(r => r.moneda === 'EUR') || { tasa_oficial: usdRate * 0.85 }; // Valor aproximado si no hay tasa EUR

    // 3. Calcular información de descuentos, alícuotas y conversiones por producto
    const itemsWithDetails = await Promise.all(cart.items.map(async (item) => {
      // Buscar si este producto tiene descuento
      const productDiscount = cart.discount.find((d) =>
        d.products.includes(item.product._id)
      );
      
      // Buscar alícuotas asociadas al producto
      const productAliquots = await Aliquots.find({ 
        code: { $in: ['G', 'R', 'A', 'E', 'P', 'IGTF'] } // Códigos estándar de alícuotas
      });

      // Calcular valores en diferentes divisas
      const priceUSD = item.price; // Asumiendo que el precio está en USD
      const priceEUR = priceUSD * (1 / eurRate);
      const priceVES = priceUSD * usdRate;

      // Calcular impuestos
      const aliquotsCalculated = productAliquots.map(aliquot => {
        const amount = priceVES * (aliquot.percentage / 100);
        return {
          code: aliquot.code,
          name: aliquot.name,
          percentage: aliquot.percentage,
          amount
        };
      });

      // Encontrar el IVA específicamente (asumiendo código 'G' para IVA)
      const iva = aliquotsCalculated.find(a => a.code === 'G') || {
        code: 'G',
        name: 'IVA',
        percentage: 0,
        amount: 0
      };

      return {
        product: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.price, // Precio base en USD
        priceUSD,          // Precio unitario en USD
        priceEUR,          // Precio unitario en EUR
        priceVES,          // Precio unitario en VES
        hasDiscount: !!productDiscount,
        discountPercentage: productDiscount ? productDiscount.percentage : 0,
        discountAmount: productDiscount
          ? item.price * item.quantity * (productDiscount.percentage / 100)
          : 0,
        aliquots: aliquotsCalculated,
        ivaAmount: iva.amount * item.quantity,
        totalWithTaxes: (priceVES + iva.amount) * item.quantity
      };
    }));

    // 4. Calcular totales generales
    const subtotal = itemsWithDetails.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    
    const totalDiscount = itemsWithDetails.reduce(
      (sum, item) => sum + item.discountAmount,
      0
    );
    
    const subtotalAfterDiscount = subtotal - totalDiscount;
    
    // Totales en diferentes divisas
    const totals = {
      USD: subtotalAfterDiscount,
      EUR: subtotalAfterDiscount * (1 / eurRate),
      VES: subtotalAfterDiscount * usdRate
    };
    
    // Calcular impuestos totales
    const totalTaxes = itemsWithDetails.reduce(
      (sum, item) => sum + item.ivaAmount,
      0
    );
    
    const grandTotalVES = totals.VES + totalTaxes;

    // 5. Calcular comisión por método de pago (3% si es tarjeta en USD)
    let paymentFee = 0;
    if (paymentMethod === 'credit_card_usd') {
      paymentFee = totals.USD * 0.03;
      totals.USD += paymentFee;
      totals.EUR = totals.USD * (1 / eurRate);
      totals.VES = totals.USD * usdRate;
    }

    // 6. Crear la orden con todos los detalles
    const order = new Order({
      user: userId,
      cart: cartId,
      paymentMethod,
      orderNumber: 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      items: itemsWithDetails,
      subtotal,
      discountAmount: totalDiscount,
      totals,
      taxes: {
        total: totalTaxes,
        aliquotsSummary: itemsWithDetails.reduce((acc, item) => {
          item.aliquots.forEach(aliquot => {
            const existing = acc.find(a => a.code === aliquot.code);
            if (existing) {
              existing.amount += aliquot.amount * item.quantity;
            } else {
              acc.push({
                code: aliquot.code,
                name: aliquot.name,
                percentage: aliquot.percentage,
                amount: aliquot.amount * item.quantity
              });
            }
          });
          return acc;
        }, [])
      },
      paymentFee,
      grandTotal: {
        USD: totals.USD,
        EUR: totals.EUR,
        VES: grandTotalVES
      },
      exchangeRates: {
        USD: usdRate,
        EUR: eurRate,
        lastUpdated: latestRates[0].fecha
      },
      createdAt: new Date(),
    });

    // 7. Guardar la orden y limpiar carrito
    await order.save();
    await Cart.findByIdAndUpdate(cartId, { items: [], subtotal: 0, total: 0 });

    return order;
  } catch (error) {
    console.error('Error en createOrder:', error);
    throw error;
  }
};

module.exports = {
  createOrder
};