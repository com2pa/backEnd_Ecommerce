const User = require('../models/user');

const allowedRoles = ['user', 'admin', 'editor', 'viewer', 'superadmin', 'auditor'];

const updateUserRole = async (userId, newRole, requestingUser) => {
  // Validar rol
  if (!allowedRoles.includes(newRole)) {
    throw new Error('Rol no válido');
  }

  // Verificar permisos
  if (!requestingUser || requestingUser.role !== 'admin' && requestingUser.role !== 'superadmin' ) {
    throw new Error('No autorizado para cambiar roles');
  }

  // Actualizar el rol
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { role: newRole },
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    throw new Error('Usuario no encontrado');
  }

  // Preparar respuesta
  const userToReturn = updatedUser.toObject();
  delete userToReturn.password;
  delete userToReturn.__v;

  return userToReturn;
};

module.exports = {
  updateUserRole,
  allowedRoles // Exportamos para usar en validaciones en el router si es necesario
};