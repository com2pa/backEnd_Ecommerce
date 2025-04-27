const ActivityLog = require('../models/activityLog');

const activityLogger = (action, entityType = null) => {
  return async (req, res, next) => {
    try {
      const originalSend = res.send;

      res.send = function (data) {
        // Registrar después de que la respuesta se complete
        logActivity(req, res, action, entityType, data);
        originalSend.apply(res, arguments);
      };

      next();
    } catch (error) {
      console.error('Error en activityLogger middleware:', error);
      next();
    }
  };
};

async function logActivity(req, res, action, entityType, responseData) {
  try {
    const logData = {
      user: req.user?._id || null,
      action,
      entityType,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        params: req.params,
        query: req.query,
        response: responseData, // Opcional: registrar respuesta
      },
    };

    // Agregar entityId si está disponible
    if (req.params.id) logData.entityId = req.params.id;
    if (req.body._id) logData.entityId = req.body._id;
    if (responseData?._id) logData.entityId = responseData._id;

    await ActivityLog.create(logData);
  } catch (error) {
    console.error('Error registrando actividad:', error);
  }
}

module.exports = {
  activityLogger,
  logActivity,
};
