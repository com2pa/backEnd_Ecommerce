// /help/system/systemLogger.js
const ActivityLog = require('../../models/activityLog');

const systemLogger = {
  /**
   * Registra login exitoso
   * @param {Object} user - Usuario que inició sesión
   * @param {Object} req - Objeto de petición Express
   */

  logLogin: async (user, req) => {
    try {
      await ActivityLog.create({
        user: user._id,
        action: 'login',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          method: req.method,
          path: req.path,
          email: user.email,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error registrando login:', error);
    }
  },

  /**
   * Registra logout
   * @param {ObjectId} userId - ID del usuario
   * @param {Object} req - Objeto de petición Express
   */
  logLogout: async (userId, req) => {
    try {
      await ActivityLog.create({
        user: userId,
        action: 'logout',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          method: req.method,
          path: req.path,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error registrando logout:', error);
    }
  },

  /**
   * Registra acceso denegado
   * @param {Object} user - Usuario (si existe)
   * @param {Object} req - Objeto de petición Express
   * @param {String} reason - Razón del denegado
   */
  logAccessDenied: async (user, req, reason) => {
    try {
      await ActivityLog.create({
        user: user?._id,
        action: 'access_denied',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          method: req.method,
          path: req.path,
          reason: reason,
          attemptedEmail: user?.email,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error registrando acceso denegado:', error);
    }
  },
  /**
   * Registra eventos del sistema (inicio/parada)
   * @param {String} action - Tipo de evento (system_start/system_stop)
   * @param {Object} metadata - Metadatos adicionales
   */
  logSystemEvent: async (action, metadata = {}) => {
    try {
      await ActivityLog.create({
        action,
        ipAddress: 'system',
        metadata: {
          ...metadata,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error(`Error registrando evento del sistema (${action}):`, error);
    }
  },
  /**
   * Registra acciones CRUD (crear, leer, actualizar, eliminar)
   * @param {Object} user - Usuario que realiza la acción
   * @param {String} action - Tipo de acción (create, read, update, delete)
   * @param {String} entityType - Tipo de entidad afectada (ej: 'Aliquot')
   * @param {String} entityId - ID de la entidad afectada
   * @param {Object} req - Objeto de petición Express
   * @param {Object} metadata - Metadatos adicionales
   */
  logCrudAction: async (
    user,
    action,
    entityType,
    entityId,
    req,
    metadata = {}
  ) => {
    try {
      // Asegúrate que action sea uno de: create, read, update, delete
      const validActions = ['create', 'read', 'update', 'delete'];
      if (!validActions.includes(action)) {
        throw new Error(`Acción CRUD no válida: ${action}`);
      }
      await ActivityLog.create({
        user: user?._id,
        action: `${action}`,
        entityType,
        entityId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          method: req.method,
          path: req.path,
          ...metadata,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error(`Error registrando acción CRUD (${action}):`, error);
    }
  },
};

module.exports = systemLogger;
