const logoutRouter = require('express').Router();
const User = require('../models/user');
const jwt = require('jsonwebtoken');

logoutRouter.get('/', async (req, res) => {
  const cookies = req.cookies;

  // Verificar si la cookie existe
  if (!cookies?.accesstoken) {
    return res.status(401).json('Usted no ha iniciado sesión!');
  }

  try {
    // Verificar el token para obtener el ID del usuario
    const decodedToken = jwt.verify(
      cookies.accesstoken,
      process.env.ACCESS_TOKEN_SECRET
    );
    const userId = decodedToken.id;

    // Actualizar el estado online a false
    await User.findByIdAndUpdate(userId, { online: false });

    // Borrar la cookie del navegador
    res.clearCookie('accesstoken', {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    });

    return res.sendStatus(204);
  } catch (error) {
    // Si hay un error con el token, simplemente borramos la cookie
    res.clearCookie('accesstoken', {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    });
    return res.status(400).json('Sesión inválida');
  }
});

module.exports = logoutRouter;
