const jwt = require('jsonwebtoken');
const User = require('../models/user');

const usertExtractor = async (req, res, next) => {
     try {
       // comprobar que el token existe
       const token = req.cookies?.accesstoken;
       if (!token)
         return res
           .status(401)
           .json({ error: 'No estas autorizado para acceder a esta ruta' });

       // verificar que el token es válido

       const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
       // console.log(decoded)

       // traer el usuario
       const user = await User.findById(decoded.id);
       req.user = user;

       // continuar con la ejecución de la ruta
       next();
     } catch (error) {
       return res
         .status(403)
         .json({ error: 'No estas autorizado para acceder a esta ruta' });
     }
}

module.exports = {usertExtractor};
