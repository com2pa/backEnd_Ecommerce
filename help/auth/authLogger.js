// /help/auth/authLogger.js
const ActivityLog = require('../../models/activityLog');

const authLogger = {
  /**
   * Registra intento fallido de login
   * @param {String} email - Email utilizado
   * @param {Object} req - Objeto de petición Express
   * @param {String} reason - Razón del fallo
   */
  logFailedAttempt: async (email, req, reason) => {
    try {
      await ActivityLog.create({
        action: 'login_failed',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          attemptedEmail: email,
          method: req.method,
          path: req.path,
          reason: reason,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error registrando intento fallido:', error);
    }
  },
};

module.exports = authLogger;
