// /middlewares/auditMiddleware.js
const ActivityLog = require('../models/activityLog');

const auditMiddleware = (entityType) => {
  return async (req, res, next) => {
    const originalJson = res.json;

    res.json = async function (body) {
      try {
        if (
          req.user &&
          entityType &&
          ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
        ) {
          let action;
          switch (req.method) {
            case 'POST':
              action = 'create';
              break;
            case 'GET':
              action = 'read';
              break;
            case 'PUT':
            case 'PATCH':
              action = 'update';
              break;
            case 'DELETE':
              action = 'delete';
              break;
          }

          await ActivityLog.create({
            user: req.user._id,
            action: action,
            entityType: entityType,
            entityId: req.params.id || body._id || body.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              changes: action === 'update' ? req.body : undefined,
              timestamp: new Date(),
            },
          });
        }
      } catch (error) {
        console.error('Error en middleware de auditoría:', error);
      }

      originalJson.call(this, body);
    };

    next();
  };
};

module.exports = auditMiddleware;
