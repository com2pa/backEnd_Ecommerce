const activityLogRouter = require('express').Router();
const ActivityLog = require('../models/activityLog');
activityLogRouter.get('/', async (req, res) => {;

    try {
      const {
        action,
        entityType,
        userId,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;

      const filter = {};
      if (action) filter.action = action;
      if (entityType) filter.entityType = entityType;
      if (userId) filter.user = userId;

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: { path: 'user', select: 'name email role' },
      };

      const logs = await ActivityLog.paginate(filter, options);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
 
})

module.exports = activityLogRouter;
