const User = require('../models/user');
const systemLogger = require('../help/system/systemLogger');

// Definición centralizada de roles con descripciones
const ROLES = Object.freeze({
  USER: {
    value: 'user',
    description: 'Usuario estándar',
    level: 1
  },
  VIEWER: {
    value: 'viewer',
    description: 'Solo lectura',
    level: 2
  },
  EDITOR: {
    value: 'editor',
    description: 'Editor de contenido',
    level: 3
  },
  AUDITOR: {
    value: 'auditor',
    description: 'Consultor SENIAT',
    level: 4
  },
  ADMIN: {
    value: 'admin',
    description: 'Administrador completo',
    level: 5
  },
  SUPERADMIN: {
    value: 'superadmin',
    description: 'Super Administrador',
    level: 6
  },
});

// Obtener nivel de un rol
const getRoleLevel = (role) => {
  const roleEntry = Object.values(ROLES).find(r => r.value === role);
  return roleEntry ? roleEntry.level : 0;
};

// Validar si un usuario puede cambiar roles
const canAssignRole = (assignerRole, targetRole) => {
  const assignerLevel = getRoleLevel(assignerRole);
  const targetLevel = getRoleLevel(targetRole);
  
  // Solo admin y superadmin pueden asignar roles
  if (!['admin', 'superadmin'].includes(assignerRole)) {
    return false;
  }

  // Superadmin puede asignar cualquier rol excepto superadmin a otros
  if (assignerRole === ROLES.SUPERADMIN.value) {
    return targetRole !== ROLES.SUPERADMIN.value;
  }

  // Admin solo puede asignar roles con nivel menor al suyo
  if (assignerRole === ROLES.ADMIN.value) {
    return targetLevel < getRoleLevel(ROLES.ADMIN.value);
  }

  return false;
};

// Validar si un usuario puede modificar a otro usuario
const canModifyUser = (assignerRole, targetUserRole) => {
  const assignerLevel = getRoleLevel(assignerRole);
  const targetLevel = getRoleLevel(targetUserRole);
  
  return assignerLevel > targetLevel;
};

// Asignar rol a usuario
const assignUserRole = async (userId, newRole, assignerId) => {
  try {
    // Validaciones básicas
    if (!userId || !newRole || !assignerId) {
      throw new Error('Faltan parámetros requeridos');
    }

    // Validar que el rol sea válido
    const validRoles = Object.values(ROLES).map(role => role.value);
    if (!validRoles.includes(newRole)) {
      throw new Error(`Rol inválido. Roles permitidos: ${validRoles.join(', ')}`);
    }

    // Obtener usuario que asigna el rol
    const assigner = await User.findById(assignerId);
    if (!assigner) {
      throw new Error('Usuario asignador no encontrado');
    }

    // Verificar que el asignador tenga permisos de administrador
    if (!['admin', 'superadmin'].includes(assigner.role)) {
      throw new Error('No tienes permisos para gestionar roles');
    }

    // Obtener usuario a modificar
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Usuario objetivo no encontrado');
    }

    // Validar permisos para modificar a este usuario específico
    if (!canModifyUser(assigner.role, user.role)) {
      await systemLogger.logAccessDenied(
        assigner,
        null,
        `Intento de modificar usuario con rol igual o superior: ${user.role}`
      );
      throw new Error('No puedes modificar usuarios con rol igual o superior al tuyo');
    }

    // Validar permisos para asignar el nuevo rol
    if (!canAssignRole(assigner.role, newRole)) {
      await systemLogger.logAccessDenied(
        assigner,
        null,
        `Intento de asignar rol ${newRole} sin permisos`
      );
      throw new Error('No tienes permisos para asignar este rol');
    }

    // No permitir auto-modificación de rol
    if (userId === assignerId.toString()) {
      throw new Error('No puedes modificar tu propio rol');
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
        changedBy: assigner.email
      }
    );

    return {
      user: formatUserResponse(user),
      auditData: {
        oldRole,
        newRole,
        changedBy: assignerId,
        changedAt: new Date(),
        changedByEmail: assigner.email
      },
    };
  } catch (error) {
    console.error('Error en assignUserRole:', error);
    throw error;
  }
};

// Obtener todos los usuarios (solo para admin y superadmin)
const getAllUsers = async (requestorId) => {
  try {
    // Verificar permisos del solicitante
    const requestor = await User.findById(requestorId);
    if (!requestor || !['admin', 'superadmin'].includes(requestor.role)) {
      throw new Error('No tienes permisos para ver todos los usuarios');
    }

    const users = await User.find({})
      .select('-password -__v')
      .sort({ createdAt: -1 });
    
    return users.map(user => formatUserResponse(user));
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    throw new Error('Error al cargar los usuarios');
  }
};

// Formatear respuesta de usuario
const formatUserResponse = (user) => {
  const userObj = user.toObject ? user.toObject() : user;
  
  return {
    id: userObj._id || userObj.id,
    name: userObj.name,
    lastname: userObj.lastname,
    email: userObj.email,
    role: userObj.role,
    avatar: userObj.avatar,
    online: userObj.online,
    verify: userObj.verify,
    gender: userObj.gender,
    createdAt: userObj.createdAt,
    updatedAt: userObj.updatedAt
  };
};

// Obtener roles disponibles según el rol del solicitante
const getAvailableRoles = (requestorRole) => {
  const requestorLevel = getRoleLevel(requestorRole);
  
  return Object.values(ROLES)
    .filter(role => {
      // Solo admin y superadmin pueden ver todos los roles
      if (!['admin', 'superadmin'].includes(requestorRole)) {
        return false;
      }
      
      // Superadmin puede ver todos los roles excepto superadmin para asignar
      if (requestorRole === ROLES.SUPERADMIN.value) {
        return role.value !== ROLES.SUPERADMIN.value;
      }
      
      // Admin solo puede ver roles con nivel menor
      if (requestorRole === ROLES.ADMIN.value) {
        return role.level < getRoleLevel(ROLES.ADMIN.value);
      }
      
      return false;
    })
    .map(role => ({
      value: role.value,
      description: role.description,
      level: role.level
    }));
};

module.exports = {
  assignUserRole,
  getAvailableRoles,
  getAllUsers,
  ROLES,
  canAssignRole,
  canModifyUser
};