const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Puede ser null para login fallidos
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login',
        'logout',
        'login_failed',
        'access_denied',
        'create',
        'read',
        'update',
        'delete',
        'edit',
        'system_start',
        'system_stop',
      ],
    },
    entityType: {
      type: String,
      required: false, // Para acciones CRUD, especificar el tipo de entidad
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // Para acciones CRUD, el ID de la entidad afectada
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: false,
    },
    metadata: {
      type: Object,
      required: false,
    },
  },
  {
    timestamps: true, // Crea createdAt y updatedAt automáticamente
  }
);

// Índices para mejor performance
activityLogSchema.index({ user: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
module.exports = ActivityLog;
