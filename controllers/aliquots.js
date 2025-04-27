const aliquotsRouter = require('express').Router();
const Aliquot = require('../models/aliquots');
const aliquotsService = require('../services/aliquotsServices');
const systemLogger = require('../help/system/systemLogger');

// mostrando todas las alicuotas
aliquotsRouter.get('/', async (req, res) => {
  try {
    // 1. Verificar autenticación 
    const user = req.user;
    if (user.role != 'admin') {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    // 2. Obtener parámetros de consulta
    const { 
      page = 1, 
      limit = 10, 
      sort = 'code',
      order = 'asc',
      search 
    } = req.query;

    // 3. Construir consulta
    const query = {};
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    // 4. Opciones de paginación
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sort]: order === 'asc' ? 1 : -1 },
      lean: true
    };

    // 5. Ejecutar consulta paginada
    const result = await Aliquot.paginate(query, options);

    // 6. Formatear respuesta
    const response = {
      success: true,
      data: {
        aliquots: result.docs,
        pagination: {
          total: result.totalDocs,
          pages: result.totalPages,
          page: result.page,
          limit: result.limit,
          hasNext: result.hasNextPage,
          hasPrev: result.hasPrevPage
        }
      }
    };

    // // 7. Registrar acción de lectura (si es necesario)
    // await systemLogger.logCrudAction(
    //   user,
    //   'read',
    //   'Aliquot',
    //   null, // No hay ID específico
    //   req,
    //   {
    //     filters: query,
    //     pagination: options
    //   }
    // );

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error al obtener alícuotas:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener las alícuotas'
    });
  }
});
// creando la alicuotas
aliquotsRouter.post('/', async (req, res) => {
  try {
    // 1. Verificar usuario
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { code, name, percentage } = req.body;
    console.log('obteniendo la alicuotas ..', code, name, percentage);
    // Validación básica
    if (!code || !name || !percentage) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos (code, name, percentage) son requeridos',
      });
    }

    // Crear mediante servicio
    const newAliquot = await aliquotsService.createAliquot(
      { code, name, percentage },
      req.user._id
    );
    return res.status(200).json({
      success: true,
      message: 'Alícuota creada exitosamente',
      data: newAliquot,
    });
  } catch (error) {
    console.error('Error al crear alícuota:', error);
    const statusCode =
      error.message.includes('ya existe') || error.message.includes('inválida')
        ? 400
        : 500;

    return res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});
// elimino la alicuota
aliquotsRouter.delete('/:id', async (req, res) => {
  try {
    // 1. Verificar usuario autenticado y con rol adecuado
    const user = req.user;
    if (user.role !== 'admin') {
      await systemLogger.logAccessDenied(
        user,
        req,
        'Intento de eliminación no autorizado'
      );
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { id } = req.params;

    // 2. Verificar que la alícuota existe y obtener sus datos
    const aliquot = await Aliquot.findById(id);
    if (!aliquot) {
      return res.status(404).json({ error: 'Alícuota no encontrada' });
    }

    // 3. Registrar la acción ANTES de eliminar (con los datos completos)
    // await systemLogger.logCrudAction(user, 'delete', 'Aliquot', id, req, {
    //   deletedData: aliquot.toObject(), // Usamos el documento encontrado
    // });

    // 4. Eliminar mediante servicio
    const deletedAliquot = await aliquotsService.deleteAliquot(id, user._id);

    return res.status(200).json({
      success: true,
      message: 'Alícuota eliminada exitosamente',
      data: deletedAliquot,
    });
  } catch (error) {
    console.error('Error al eliminar alícuota:', error);

    let statusCode = 500;
    if (error.message.includes('No encontrada')) statusCode = 404;
    if (error.message.includes('No autorizado')) statusCode = 403;

    return res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

// edito la alicuota
aliquotsRouter.patch('/:id', async (req, res) => {
  try {
    // 1. Verificar autenticación y permisos
    const user = req.user;
    if (user.role !== 'admin') {
      await systemLogger.logAccessDenied(
        user,
        req,
        'Intento de edición no autorizado'
      );
      return res.status(403).json({
        success: false,
        error: 'Se requieren privilegios de administrador',
      });
    }

    const { id } = req.params;
    const { code, name, percentage } = req.body;

    // 2. Validación básica de campos
    if (!code && !name && !percentage) {
      return res.status(400).json({
        success: false,
        error:
          'Debe proporcionar al menos un campo para actualizar (code, name o percentage)',
      });
    }

    // 3. Obtener alícuota actual para registro y validación
    const currentAliquot = await Aliquot.findById(id);
    if (!currentAliquot) {
      return res.status(404).json({
        success: false,
        error: 'Alícuota no encontrada',
      });
    }

    // 4. Preparar datos de actualización
    const updateData = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (percentage !== undefined) updateData.percentage = percentage;

    // // 5. Registrar acción ANTES de actualizar
    // await systemLogger.logCrudAction(user, 'update', 'Aliquot', id, req, {
    //   oldData: {
    //     code: currentAliquot.code,
    //     name: currentAliquot.name,
    //     percentage: currentAliquot.percentage,
    //   },
    //   newData: updateData,
    // });

    // 6. Ejecutar actualización mediante servicio
    const updatedAliquot = await aliquotsService.updateAliquot(
      id,
      updateData,
      user._id
    );

    // 7. Responder con éxito
    return res.status(200).json({
      success: true,
      message: 'Alícuota actualizada exitosamente',
      data: {
        id: updatedAliquot._id,
        code: updatedAliquot.code,
        name: updatedAliquot.name,
        percentage: updatedAliquot.percentage,
        updatedAt: updatedAliquot.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error al actualizar alícuota:', error);

    // Manejo de errores específicos
    let statusCode = 500;
    if (error.message.includes('no encontrada')) statusCode = 404;
    if (error.message.includes('autorizado')) statusCode = 403;
    if (
      error.message.includes('código') ||
      error.message.includes('validación')
    )
      statusCode = 400;

    // Registrar error
    await systemLogger.logCrudAction(
      req.user,
      'update_error',
      'Aliquot',
      req.params.id,
      req,
      {
        error: error.message,
        attemptedUpdate: req.body,
      }
    );

    return res.status(statusCode).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
module.exports = aliquotsRouter;
