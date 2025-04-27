// /middlewares/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const authLogger = require('../help/auth/authLogger');
const systemLogger = require('../help/system/systemLogger');

const userExtractor = async (req, res, next) => {
  try {
    const token = req.cookies?.accesstoken;

    if (!token) {
      await systemLogger.logAccessDenied(null, req, 'Token no proporcionado');
      return res.status(401).json({ error: 'No autorizado' });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      await systemLogger.logAccessDenied(null, req, 'Usuario no encontrado');
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    req.user = user;
    next();
  } catch (error) {
    await systemLogger.logAccessDenied(null, req, 'Token inválido o expirado');
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = { userExtractor };
