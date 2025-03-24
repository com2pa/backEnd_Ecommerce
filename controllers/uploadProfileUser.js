const UploadRouter = require('express').Router();
const User = require('../models/user');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Serve static files from the 'public' folder
// configuracion de subida
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, 'uploads/avatars/', true);
    }
    // else {
    //     cb(new Error('Formato de archivo no soportado'), false);
    // }
  },
  filename: function (req, file, cb) {
    cb(null, 'avatars ' + Date.now() + ' - ' + file.originalname);
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Upload Avatar
UploadRouter.post('/', [upload.single('file0')], async (req, res) => {
  if (!req.file) {
    return res.status(404).json({ msg: 'la peticion no incluye imagen' });
  }
  // conseguir el nombre del archivo
  let image = req.file.originalname;
  // sacar la extesion
  const imageSplit = image.split('.');

  const ext = imageSplit[1];
  if (ext != 'png' && ext != 'jpg' && ext != 'jpeg') {
    // borrar archivo subido
    const filePath = req.file.path;
    const fileDelete = fs.unlinkSync(filePath);
    // devolver respuesta negativa
    return res
      .status(400)
      .json({ error: 'La extension del archivo no es válida' });
  }
  // subir imagen al storage
  const avatarName = `${req.user.id}-${Date.now()}.${ext}`;
  const avatarPath = path.join(__dirname, '..', '/uploads/avatars', avatarName);
  fs.renameSync(req.file.path, avatarPath);
  // actualizar el campo avatar en la base de datos
  await User.findByIdAndUpdate( req.user.id, { avatar: avatarName }, { new: true }).exec();
  // devolver respuesta positiva
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { avatar: avatarName },
    { new: true }
  ).exec();
  res.status(200).json({
    message: 'Subiendo archivo',
    user: user,
    avatar: avatarName,
    file: req.file,
  });
});

// mostrar la imagen

UploadRouter.get('/avatar/:filename', async (req, res) => {
  const avatar = req.params.filename;

  // sacar el parametr de la url
  const file = req.params.file;
  // mostrando el path real de la imagen
  const filePath = './uploads/avatars/' + file;
  // comprobar si existe
  fs.stat(filePath, (error, exists) => {
    if (!exists) {
      return res.status(404).send({
        status: 'error',
        message: 'no existe la imagen',
      });
    }
    // devolver un file
    return res.sendFile(path.resolve(filePath));
  });
});
module.exports = UploadRouter;
