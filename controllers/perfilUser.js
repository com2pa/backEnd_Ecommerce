const perfilUserRouter = require('express').Router();
const User = require('../models/user');

// Get  profile users
perfilUserRouter.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select({
      role: 0,
      verify: 0,
    });
    if (!user) return res.status(400).json({ error: 'usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error en la petición' });
    console.error('no encontrado', error);
  }
});

module.exports = perfilUserRouter;
