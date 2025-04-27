const Aliquots = require('../models/aliquots');
// creo
const createAliquot = async (aliquotData, userId) => {
  const { code, name, percentage } = aliquotData;
  // verificar si la alicuota existe
  const existAliquot = await Aliquots.findOne({ code });
  if (existAliquot) {
    throw new Error(`La alícuota con código ${code} ya existe`);
  }

  //   // Validar mayúsculas en el nombre
  //   const normalizedName = name.toUpperCase();
  //   const validNames = {
  //     G: 'GENERAL',
  //     R: 'REDUCIDA',
  //     A: 'ADICIONAL',
  //     E: 'EXENTO',
  //     P: 'PERCIBIDO',
  //     IGTF: 'IMPUESTO A GRANDES TRANSACCIONES FINANCIERAS',
  //     };
  //     if (validNames[code] !== normalizedName) {
  //       throw new Error(`El nombre no coincide con el código de alícuota`);
  //     }
  // Crear y guardar la nueva alícuota
  const newAliquot = new Aliquots({
    code,
    name,
    percentage,
    user: userId,
    // appliesToForeignCurrency: code === 'IGTF',
  });
  //   guardando la alicuota
  const savedAliquot = await newAliquot.save();
  return savedAliquot;
};
// elimino
const deleteAliquot = async (id, userId) => {
  const aliquot = await Aliquots.findByIdAndDelete({
    _id: id,
    user: userId, // Opcional: asegurar que solo el creador puede eliminar
  });

  if (!aliquot) {
    throw new Error('Alícuota no encontrada o no autorizado');
  }
  return aliquot;
};

// edito
/**
 * Actualiza una alícuota
 */
const updateAliquot = async (id, updateData, userId) => {
  // Verificar existencia
  const currentAliquot = await Aliquots.findById(id);
  if (!currentAliquot) {
    throw new Error('Alícuota no encontrada');
  }

  // Validar que el usuario es el creador
  if (currentAliquot.user.toString() !== userId.toString()) {
    throw new Error('No autorizado para modificar esta alícuota');
  }

  // Validar código único si se está modificando
  if (updateData.code && updateData.code !== currentAliquot.code) {
    const exists = await Aliquots.findOne({ code: updateData.code });
    if (exists) {
      throw new Error('El código ya está en uso');
    }
  }

  // Aplicar actualización
  return await Aliquots.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
}


  (module.exports = {
    createAliquot,
    deleteAliquot,
    updateAliquot
  });
