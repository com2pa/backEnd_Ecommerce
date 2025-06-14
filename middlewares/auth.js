// // /middlewares/auth.js
// const jwt = require('jsonwebtoken');
// const User = require('../models/user');
// const authLogger = require('../help/auth/authLogger');
// const systemLogger = require('../help/system/systemLogger');

// const userExtractor = async (req, res, next) => {
//   try {
//     const token = req.cookies?.accesstoken;

//     if (!token) {
//       await systemLogger.logAccessDenied(null, req, 'Token no proporcionado');
//       return res.status(401).json({ error: 'No autorizado' });
//     }

//     const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
//     const user = await User.findById(decoded.id);

//     if (!user) {
//       await systemLogger.logAccessDenied(null, req, 'Usuario no encontrado');
//       return res.status(401).json({ error: 'Usuario no válido' });
//     }

//     req.user = user;
//     next();
//   } catch (error) {
//     await systemLogger.logAccessDenied(null, req, 'Token inválido o expirado');
//     return res.status(403).json({ error: 'Token inválido o expirado' });
//   }
// };


// module.exports = { userExtractor };

// /middlewares/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const authLogger = require('../help/auth/authLogger');
const systemLogger = require('../help/system/systemLogger');

// Middleware para extraer y verificar el usuario del token
const userExtractor = async (req, res, next) => {
  try {
    const token = req.cookies?.accesstoken || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      await systemLogger.logAccessDenied(null, req, 'Token no proporcionado');
      return res.status(401).json({ error: 'Acceso no autorizado - Token requerido' });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id).select('-password -__v');

    if (!user) {
      await systemLogger.logAccessDenied(null, req, 'Usuario no encontrado');
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    if (!user.verify) {
      await systemLogger.logAccessDenied(user._id, req, 'Cuenta no verificada');
      return res.status(403).json({ error: 'Cuenta no verificada - Por favor verifica tu email' });
    }

    req.user = user;
    next();
  } catch (error) {
    await systemLogger.logAccessDenied(null, req, 'Error de autenticación: ' + error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado - Por favor inicia sesión nuevamente' });
    }
    
    return res.status(403).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar roles
const roleAuthorization = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        await systemLogger.logAccessDenied(null, req, 'Intento de autorización sin autenticación');
        return res.status(401).json({ error: 'Autenticación requerida' });
      }

      if (!roles.includes(req.user.role)) {
        await systemLogger.logAccessDenied(req.user._id, req, `Intento de acceso no autorizado. Rol requerido: ${roles.join(', ')}`);
        return res.status(403).json({ 
          error: 'Acceso no autorizado',
          requiredRoles: roles,
          currentRole: req.user.role
        });
      }

      next();
    } catch (error) {
      await systemLogger.logSystemError(req.user?._id, req, 'Error en autorización de rol', error);
      return res.status(500).json({ error: 'Error interno al verificar permisos' });
    }
  };
};

// Middleware para verificar si el usuario está activo/online
const checkUserStatus = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const user = await User.findById(req.user._id);
    if (!user.online) {
      await systemLogger.logAccessDenied(req.user._id, req, 'Intento de acceso con cuenta inactiva');
      return res.status(403).json({ error: 'Tu cuenta está inactiva' });
    }

    next();
  } catch (error) {
    await systemLogger.logSystemError(req.user?._id, req, 'Error al verificar estado de usuario', error);
    next(); // Continuar aunque falle esta verificación
  }
};

// Middleware para protección contra fuerza bruta
const rateLimiter = require('express-rate-limit');
const loginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos por IP
  message: async (req, res) => {
    await systemLogger.logSecurityEvent(null, req, 'Demasiados intentos de login');
    return res.status(429).json({ 
      error: 'Demasiados intentos. Por favor intenta nuevamente más tarde.' 
    });
  }
});

module.exports = {
  userExtractor,
  roleAuthorization,
  checkUserStatus,
  loginLimiter
};


// notaa
/**
 * userExtractor mejorado:

Ahora acepta token tanto de cookies como de headers

Elimina campos sensibles (password, __v) del usuario

Verifica si el usuario tiene la cuenta verificada (verify: true)

Manejo más detallado de errores (token expirado vs inválido)

Nuevo middleware roleAuthorization:

Verifica que el usuario tenga los roles requeridos

Registra intentos de acceso no autorizados

Devuelve información útil en los errores

Nuevo middleware checkUserStatus:

Verifica si el usuario está marcado como online

Útil para prevenir acceso de cuentas inactivas

Nuevo middleware loginLimiter:

Protección contra ataques de fuerza bruta

Limita intentos de login
 * * */