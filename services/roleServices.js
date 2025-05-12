const User = require('../models/user');
const systemLogger = require('../help/system/systemLogger');

// Definición centralizada de roles con descripciones
const ROLES = Object.freeze({
  USER: {
    value: 'user',
    description: 'Usuario estándar',
  },
  ADMIN: {
    value: 'admin',
    description: 'Administrador completo',
  },
  EDITOR: {
    value: 'editor',
    description: 'Editor de contenido',
  },
  VIEWER: {
    value: 'viewer',
    description: 'Solo lectura',
  },
  SUPERADMIN: {
    value: 'superadmin',
    description: 'Super Administrador',
  },
  AUDITOR: {
    value: 'auditor',
    description: 'Consultor SENIAT',
  },
});

// Validar si un usuario puede cambiar roles
const canAssignRole = (assignerRole, targetRole) => {
  // Solo superadmin puede asignar cualquier rol
  if (assignerRole === ROLES.ADMIN.value) return true;

  // Admin puede asignar roles menores
  if (assignerRole === ROLES.ADMIN.value) {
    return ![ROLES.ADMIN.value, ROLES.SUPERADMIN.value].includes(targetRole);
  }

  return false;
};

// Asignar rol a usuario
const assignUserRole = async (userId, newRole, assignerId) => {
  try {
    // Validaciones básicas
    if (!userId || !newRole || !assignerId) {
      throw new Error('Faltan parámetros requeridos');
    }

    // Validar que el rol sea válido
    if (!Object.values(ROLES).some((role) => role.value === newRole)) {
      throw new Error(
        `Rol inválido. Roles permitidos: ${getAvailableRoles().join(', ')}`
      );
    }

    // Obtener usuario que asigna el rol
    const assigner = await User.findById(assignerId);
    if (!assigner) {
      throw new Error('Usuario asignador no encontrado');
    }

    // Obtener usuario a modificar
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Usuario objetivo no encontrado');
    }

    // Validar permisos
    if (!canAssignRole(assigner.role, newRole)) {
      await systemLogger.logAccessDenied(
        assigner,
        null,
        `Intento de asignar rol ${newRole} sin permisos`
      );
      throw new Error('No tienes permisos para asignar este rol');
    }

    // No permitir auto-asignación de roles superiores
    if (
      userId === assignerId.toString() &&
      ![ROLES.USER.value, ROLES.VIEWER.value].includes(newRole)
    ) {
      throw new Error('No puedes auto-asignarte este rol');
    }

    const oldRole = user.role;

    // Si el rol es el mismo, no hacer cambios
    if (oldRole === newRole) {
      return {
        message: 'El usuario ya tiene este rol asignado',
        user: formatUserResponse(user),
      };
    }

    // Actualizar rol
    user.role = newRole;
    await user.save();

    // Registrar en log
    await systemLogger.logCrudAction(
      assigner,
      'role_change',
      'User',
      userId,
      null,
      {
        oldRole,
        newRole,
      }
    );

    return {
      user: formatUserResponse(user),
      auditData: {
        oldRole,
        newRole,
        changedBy: assignerId,
        changedAt: new Date(),
      },
    };
  } catch (error) {
    console.error('Error en assignUserRole:', error);
    throw error;
  }
};

// Formatear respuesta de usuario
const formatUserResponse = (user) => {
  return {
    id: user._id,
    email: user.email,
    role: user.role,
  };
};

// Obtener roles disponibles
const getAvailableRoles = () => {
  return Object.values(ROLES).map((role) => ({
    value: role.value,
    description: role.description,
  }));
};

module.exports = {
  assignUserRole,
  getAvailableRoles,
  ROLES,
};
