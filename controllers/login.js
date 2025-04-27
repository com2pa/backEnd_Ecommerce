const loginRouter = require('express').Router();
const User = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const systemLogger = require('../help/system/systemLogger');
const authLogger = require('../help/auth/authLogger');
loginRouter.post('/', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!email || !password) {
      // Registra intento fallido (usando authLogger)
      await authLogger.logFailedAttempt(email, req, 'Credenciales inválidas');
      return res
        .status(400)
        .json({ message: 'Debes proporcionar email y contraseña' });
    }

    // if (!user || !(await user.comparePassword(password))) {
    //   // Registra intento fallido (usando authLogger)
    //   await authLogger.logFailedAttempt(email, req, 'Credenciales inválidas');
    //   return res.status(401).json({ error: 'Credenciales inválidas' });
    // }

    const userExist = await User.findOne({ email });
    if (!userExist) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (!userExist.verify) {
      return res.status(403).json({ message: 'Usuario no verificado' });
    }

    const isCorrect = await bcrypt.compare(password, userExist.password);
    if (!isCorrect) {
      return res
        .status(400)
        .json({ error: 'Email o Contraseña invalida por favor revisar' });
    }

    // Actualizar estado online a true
    await User.findByIdAndUpdate(userExist._id, { online: true });

    const userForToken = {
      id: userExist.id,
      name: userExist.name,
      role: userExist.role,
      online: true,
    };

    const accesstoken = jwt.sign(
      userForToken,
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1d' }
    );
    // Registrar login exitoso
    await systemLogger.logLogin(user, req);

    res.cookie('accesstoken', accesstoken, {
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    return res.status(200).json({
      user: {
        id: userExist.id,
        name: userExist.name,
        email: userExist.email,
        role: userExist.role,
        online: true,
      },
      accesstoken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
module.exports = loginRouter;
