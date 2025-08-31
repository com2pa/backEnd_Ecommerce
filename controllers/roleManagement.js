// const roleManagementRouter = require('express').Router();
// const roleService = require('../services/roleServices');
// const systemLogger = require('../help/system/systemLogger');

// // Obtener lista de roles disponibles
// roleManagementRouter.get('/', async (req, res) => {
//   try {
//     const roles = roleService.getAvailableRoles();
//     res.json({
//       success: true,
//       data: roles,
//     });
//   } catch (error) {
//     console.error('Error al obtener roles:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Error al obtener los roles disponibles',
//     });
//   }
// });

// // Actualizar rol de usuario
// roleManagementRouter.put('/:userId', async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { role: newRole } = req.body;
//     const assigner = req.user;

//     // Validación básica
//     if (!newRole) {
//       return res.status(400).json({
//         success: false,
//         error: 'El campo "role" es requerido',
//       });
//     }

//     // Llamada al servicio
//     const result = await roleService.assignUserRole(
//       userId,
//       newRole,
//       assigner._id
//     );

//     // Respuesta exitosa
//     res.json({
//       success: true,
//       message: `Rol actualizado correctamente a ${newRole}`,
//       data: {
//         user: result.user,
//         audit: result.auditData,
//       },
//     });
//   } catch (error) {
//     console.error('Error en actualización de rol:', error);

//     // Registrar error
//     await systemLogger.logCrudAction(
//       req.user,
//       'role_change_error',
//       'User',
//       req.params.userId,
//       req,
//       {
//         error: error.message,
//         attemptedRole: req.body.role,
//       }
//     );

//     // Determinar código de estado apropiado
//     let statusCode = 500;
//     if (error.message.includes('no encontrado')) statusCode = 404;
//     if (error.message.includes('permisos')) statusCode = 403;
//     if (
//       error.message.includes('inválido') ||
//       error.message.includes('requeridos')
//     )
//       statusCode = 400;

//     res.status(statusCode).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// module.exports = roleManagementRouter;
const roleManagementRouter = require('express').Router();
const roleService = require('../services/roleServices');
const systemLogger = require('../help/system/systemLogger');

// Middleware para verificar permisos de administrador
const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Se requieren permisos de administrador para esta acción'
    });
  }
  next();
};

// Aplicar middleware de administrador a todas las rutas
roleManagementRouter.use(requireAdmin);

// Obtener lista de roles disponibles según el rol del usuario
roleManagementRouter.get('/roles', async (req, res) => {
  try {
    const roles = roleService.getAvailableRoles(req.user.role);
    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los roles disponibles',
    });
  }
});

// Obtener todos los usuarios (solo para admin)
roleManagementRouter.get('/users', async (req, res) => {
  try {
    const users = await roleService.getAllUsers(req.user._id);
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    
    let statusCode = 500;
    if (error.message.includes('permisos')) statusCode = 403;
    
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

// Actualizar rol de usuario
roleManagementRouter.put('/user/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role: newRole } = req.body;
    const assigner = req.user;

    // Validación básica
    if (!newRole) {
      return res.status(400).json({
        success: false,
        error: 'El campo "role" es requerido',
      });
    }

    // Llamada al servicio
    const result = await roleService.assignUserRole(
      userId,
      newRole,
      assigner._id
    );

    // Respuesta exitosa
    res.json({
      success: true,
      message: `Rol actualizado correctamente a ${newRole}`,
      data: {
        user: result.user,
        audit: result.auditData,
      },
    });
  } catch (error) {
    console.error('Error en actualización de rol:', error);

    // Registrar error
    await systemLogger.logCrudAction(
      req.user,
      'role_change_error',
      'User',
      req.params.userId,
      null,
      {
        error: error.message,
        attemptedRole: req.body.role,
        targetUserId: req.params.userId
      }
    );

    // Determinar código de estado apropiado
    let statusCode = 500;
    if (error.message.includes('no encontrado')) statusCode = 404;
    if (error.message.includes('permisos')) statusCode = 403;
    if (error.message.includes('No puedes modificar')) statusCode = 403;
    if (error.message.includes('inválido') || error.message.includes('requerido')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

// Obtener información de un usuario específico
roleManagementRouter.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password -__v');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Verificar que el usuario que hace la request puede ver este usuario
    if (!roleService.canModifyUser(req.user.role, user.role)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ver este usuario'
      });
    }

    res.json({
      success: true,
      data: roleService.formatUserResponse(user)
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el usuario'
    });
  }
});

module.exports = roleManagementRouter;