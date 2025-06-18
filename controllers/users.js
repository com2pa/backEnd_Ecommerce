const usersRouter = require('express').Router();
const User = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { PAGE_URL } = require('../config');
const { updateUserRole } = require('../services/userRoleServices');
const { userExtractor, roleAuthorization } = require('../middlewares/auth');
// obtendiend todos los usuario
usersRouter.get('/', async (req, res) => {
  try {
      const users = await User.find({});
      // console.log('usuario conectados',users)

      if (!users) return res.status(404).json({ message: 'No hay usuarios' });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// creando un nuevo usuario
usersRouter.post('/', async (req, res) => {
  // lo que obtengo del body
  const { name, lastname, gender, age, address, email, password,cedula } = req.body;
  console.log(name, lastname, gender, age, address, email, password,cedula);

  // validando los datos
  if (
    !name ||
    !lastname ||
    !gender ||
    !age ||
    !address ||
    !email ||
    !password ||
    !cedula
  ) {
    return res
      .status(400)
      .json({ message: 'Todos los campos son obligatorios' });
  }

  // verificando si el email ya existe
  const existingUser = await User.findOne({ email });
  if (existingUser)
    return res.status(400).json({ message: 'El email ya existe' });
  // validacion del email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ msg: 'Formato de email inválido' });
  }

  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      msg: 'La contraseña debe tener al menos 6 caracteres, incluyendo letras mayúsculas, letras minúsculas, números y caracteres especiales',
    });
  }
  // encriptar la constraseña
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  // console.log('contraeña encriptada',hashedPassword)

  // creando el nuevo usuario
  const newUser = new User({
    name,
    lastname,
    gender,
    age,
    address,
    email,
    cedula,
    password: hashedPassword,
  });
  // guardando el usuario
  try {
    const savedUser = await newUser.save();
    console.log('usuario', savedUser);
    //   res.status(201).json({usuarioCreado: savedUser});
    // el token dura 1 dia
    const token = jwt.sign(
      { id: savedUser.id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1d' }
    );
    console.log('token', token);

    // enviar correo para su verificacion de usuario registrado
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    //  como enviar el correo
    //   await transporter.sendMail({
    //     from: process.env.EMAIL_USER,
    //     to: email,
    //     subject: 'Verificacion de usuario :)  ✔',
    //     text: 'Acontinuacion se presenta este link para poder validar tu registro en la pagina',
    //     html: `<a href="${PAGE_URL}/verify/${savedUser.id}/${token}">Verificar Correo por favor ! </a>`,
    //   });
    // Reemplaza el contenido del sendMail con esto:
    await transporter.sendMail({
      from: `"${process.env.EMAIL_NAME || 'Tu App'}" <${
        process.env.EMAIL_USER
      }>`,
      to: email,
      subject: '¡Por favor verifica tu correo electrónico! ✔',
      html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px; overflow: hidden;">
      <div style="background: #4a6bff; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">¡Bienvenido a nuestra plataforma!</h1>
      </div>
      
      <div style="padding: 20px;">
        <p style="font-size: 16px;">Hola <strong>${name}</strong>,</p>
        <p style="font-size: 16px;">Gracias por registrarte en nuestro servicio. Para completar tu registro, por favor verifica tu dirección de correo electrónico haciendo clic en el siguiente botón:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${PAGE_URL}/verify/${savedUser.id}/${token}" 
             style="background: #4a6bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            Verificar mi correo
          </a>
        </div>
        
        <p style="font-size: 16px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="font-size: 14px; color: #666; word-break: break-all;">${PAGE_URL}/verify/${
        savedUser.id
      }/${token}</p>
        
        <p style="font-size: 16px;">Si no has solicitado este registro, por favor ignora este mensaje.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea;">
          <p style="font-size: 14px; color: #666;">Equipo de Soporte<br>${
            process.env.EMAIL_NAME || 'Tu App'
          }</p>
        </div>
      </div>
    </div>
  `,
      text: `Hola ${name},\n\nGracias por registrarte en nuestro servicio. Para completar tu registro, por favor verifica tu dirección de correo electrónico visitando este enlace:\n\n${PAGE_URL}/verify/${
        savedUser.id
      }/${token}\n\nSi no has solicitado este registro, por favor ignora este mensaje.\n\nEquipo de Soporte,\n${
        process.env.EMAIL_NAME || 'Tu App'
      }`,
    });
    return res.json({
      savedUser,
      token,
      msg: 'usuario registrado verifique su correo :) ',
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Actualizar rol de usuario
usersRouter.patch('/:id/role',userExtractor ,roleAuthorization(['superadmin']), async (req, res) => {
try {
    const { id } = req.params;
    const { role } = req.body;
    const requestingUser = req.user; // Obtenido del middleware de autenticación

    const updatedUser = await updateUserRole(id, role, requestingUser);

    res.json({
      success: true,
      message: 'Rol actualizado correctamente',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    
    let statusCode = 500;
    if (error.message === 'Rol no válido') statusCode = 400;
    if (error.message === 'No autorizado para cambiar roles') statusCode = 403;
    if (error.message === 'Usuario no encontrado') statusCode = 404;

    res.status(statusCode).json({ 
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// actualizacion de el token
usersRouter.patch('/:id/:token', async (req, res) => { 
  try {
    // obtengo el token por el params
    const token = req.params.token;
    console.log('token recibido', token);
    // verifico el token
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log('token decodificado', decodedToken);
    const id = decodedToken.id;
    // cambio el estado del usuario a verificado
    const user = await User.findByIdAndUpdate(
      id,
      { verify: true },
      { new: true } // Devuelve el documento actualizado
      
    );
    console.log('usuario verificado', user);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.status(200).json({ message: 'Usuario verificado con éxito' });

  } catch (error) {
    console.error('Error en verificación:', error);
    //    encontrar el email del usuario
    const id = req.params.id;
    const user = await User.findById(id);
    console.log('email del usuario', user);
    // firmar el nuevo token
    const token = jwt.sign({ id: id }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '1d',
    });
    // enviar correo para verificacion de usuaruio registrado

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // Use `true` for port 465, `false` for all other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    //  como enviar el correo
    await transporter.sendMail({
      from: `"${process.env.EMAIL_NAME || 'Tu App'}" <${process.env.EMAIL_USER}>`,
      to: user.email, 
      subject: '¡Tu enlace de verificación ha expirado! 🔄',
      html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px; overflow: hidden;">
      <div style="background: #ff6b4a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">¡Enlace expirado!</h1>
      </div>
      <div style="padding: 20px;">
        <p style="font-size: 16px;">Hola <strong>${user.name}</strong>,</p> // <-- ERROR: 'User.name' debería ser 'user.name'
        <p style="font-size: 16px;">El enlace de verificación que recibiste anteriormente ha expirado. Por seguridad, hemos generado uno nuevo para que puedas completar tu registro:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${PAGE_URL}/verify/${id}/${token}" 
             style="background: #ff6b4a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            Nuevo enlace de verificación
          </a>
        </div>
        <p style="font-size: 16px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="font-size: 14px; color: #666; word-break: break-all;">${PAGE_URL}/verify/${id}/${token}</p>
        <p style="font-size: 16px;">Este enlace estará activo por 24 horas.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea;">
          <p style="font-size: 14px; color: #666;">Equipo de Soporte<br>${process.env.EMAIL_NAME || 'Tu App'}</p>
        </div>
      </div>
    </div>
  `,
      text: `Hola ${user.name},\n\nEl enlace de verificación que recibiste anteriormente ha expirado. Por seguridad, hemos generado uno nuevo para que puedas completar tu registro:\n\n${PAGE_URL}/verify/${id}/${token}\n\nEste enlace estará activo por 24 horas.\n\nEquipo de Soporte,\n${process.env.EMAIL_NAME || 'Tu App'}`
      
    });

    return res
      .status(400)
      .json({
        error:
          'El link expiro. Se ha enviado un ¡Nuevo link! de verificacion a su correo',
      });      
  }
});


module.exports = usersRouter;
