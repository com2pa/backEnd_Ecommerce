const roleManagementRouter = require('express').Router();
const roleService = require('../services/roleServices');
const systemLogger = require('../help/system/systemLogger');

// Obtener lista de roles disponibles
roleManagementRouter.get('/', async (req, res) => {
  try {
    const roles = roleService.getAvailableRoles();
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

// Actualizar rol de usuario
roleManagementRouter.put('/:userId', async (req, res) => {
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
      req,
      {
        error: error.message,
        attemptedRole: req.body.role,
      }
    );

    // Determinar código de estado apropiado
    let statusCode = 500;
    if (error.message.includes('no encontrado')) statusCode = 404;
    if (error.message.includes('permisos')) statusCode = 403;
    if (
      error.message.includes('inválido') ||
      error.message.includes('requeridos')
    )
      statusCode = 400;

    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = roleManagementRouter;
