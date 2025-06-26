const messageRouter=require('express').Router()
const { userExtractor } = require('../middlewares/auth');
const Message=require('../models/message')
const nodemailer = require("nodemailer");

const validateEmail = (email) => {
  const re = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
  return re.test(String(email).toLowerCase())
}

const validatePhone = (phone) => {
  const re = /^[0](212|412|414|424|416|426)[0-9]{7}$/
  return re.test(phone)
}

// obteniendo el mensaje
messageRouter.get('/',async(req,res)=>{
     try {
    const mensajes = await Message.find({}).sort({ createdAt: -1 }) // Ordenados por fecha descendente
    res.json(mensajes)
  } catch (error) {
    console.error('Error al obtener mensajes:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

//creando el mensage 
messageRouter.post('/',async(req,res)=>{
    try {
        const{name,email,phone,message}=req.body
        // console.log(' obtengo del body',name,email,phone,message)
        //validar los datos
        if(!name || !email || !phone || !message){
            return res.status(400).json({msg:'debes proporcionar todos los datos'})
        }
        // Validar formato de email
        if (!validateEmail(email)) {
        return res.status(400).json({ error: 'El formato del email no es válido' })
        }

        // Validar formato de teléfono
        if (!validatePhone(phone)) {
        return res.status(400).json({ error: 'El formato del teléfono no es válido. Debe ser un número venezolano válido (ej: 04121234567)' })
        }

        // Validar longitud del mensaje
        if (message.length > 500) {
        return res.status(400).json({ error: 'El mensaje no debe exceder los 500 caracteres' })
        }
        // verificar si ya existe un mensaje reciente  con los mismo datos
         const existingMessage = await Message.findOne({
            name,
            email,
            phone,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24 horas
        });

        if (existingMessage) {
            return res.status(400).json({ 
                error: 'Ya has enviado un mensaje recientemente con estos datos. Por favor espera antes de enviar otro.' 
            });
        }
         // Crear y guardar el nuevo mensaje
        const newMessage = new Message({
        name,
        email,
        phone,
        message,
        createdAt: new Date(),
        status: 'unread' 
        })

        const savedMessage = await newMessage.save()
        // Obtener io desde la app
        const io = req.app.get('io');
        
        // Emitir evento de nuevo mensaje a los admins
        if (io) {
            console.log('Emitting nuevo_mensaje event');
            io.to('admin-room').emit('nuevo_mensaje', {
                ...savedMessage.toObject(),
                notification: `Nuevo mensaje de ${name}`
            });
        }

        // envio de correo
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // Use `true` for port 465, `false` for all other ports
            auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: [email, process.env.EMAIL_USER],
            subject: "¡Gracias por contactarnos! ✔",
            text: `Hola ${name},\n\nHemos recibido tu mensaje y nos pondremos en contacto contigo pronto.\n\nMensaje enviado: ${message}\n\nEquipo de Soporte,\n${process.env.EMAIL_NAME || 'Tu Empresa'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px; overflow: hidden;">
                <div style="background: #4a6bff; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">¡Gracias por contactarnos!</h1>
                </div>
                
                <div style="padding: 20px;">
                    <p style="font-size: 16px;">Hola <strong>${name}</strong>,</p>
                    <p style="font-size: 16px;">Hemos recibido tu mensaje y nuestro equipo lo revisará pronto. Nos pondremos en contacto contigo a la brevedad posible.</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="font-size: 14px; margin: 0; color: #555;"><strong>Tu mensaje:</strong></p>
                    <p style="font-size: 14px; margin: 10px 0 0 0; color: #333;">${message}</p>
                    </div>
                    
                    <p style="font-size: 16px;">Si necesitas ayuda inmediata, no dudes en responder a este correo.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea;">
                    <p style="font-size: 14px; color: #666;">
                        <strong>Información de contacto:</strong><br>
                        Teléfono: ${phone}<br>
                        Email: ${email}
                    </p>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eaeaea;">
                    <p style="font-size: 14px; color: #666;">Equipo de Soporte<br>${process.env.EMAIL_NAME || 'Tu Empresa'}</p>
                    </div>
                </div>
                </div>
        `
        });

        // Respuesta exitosa
        res.status(201).json({
        message: 'Mensaje recibido correctamente',
        data: savedMessage
        })
    } catch (error) {
        console.error('Error al guardar mensaje:', error)
    }
})
// actualizar el status read y answered
messageRouter.patch('/:id', async (req, res) => {
    try {       
        const { id } = req.params;
        const { status } = req.body;
        
        // Validar el status recibido
        const validStatuses = ['unread', 'read', 'answered'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status no válido' });
        }

        // Buscar y actualizar el mensaje
        const updatedMessage = await Message.findByIdAndUpdate(
            id, 
            { status }, 
            { new: true }
        );

        if (!updatedMessage) {
            return res.status(404).json({ error: 'El mensaje no existe' });
        }

        console.log('Actualizado el status:', updatedMessage);

        // Configurar el transporter (podrías mover esto a un helper)
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Plantilla base para los correos
        const baseEmailTemplate = (title, message, statusInfo) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px; overflow: hidden;">
                <div style="background: #4a6bff; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">${title}</h1>
                </div>
                
                <div style="padding: 20px;">
                    <p style="font-size: 16px;">Hola <strong>${updatedMessage.name}</strong>,</p>
                    <p style="font-size: 16px;">${message}</p>
                    
                    ${statusInfo ? `
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="font-size: 14px; margin: 0; color: #555;"><strong>Estado actual:</strong></p>
                        <p style="font-size: 14px; margin: 10px 0 0 0; color: #333;">${statusInfo}</p>
                    </div>
                    ` : ''}
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea;">
                        <p style="font-size: 14px; color: #666;">
                            <strong>Información de tu consulta:</strong><br>
                            Fecha: ${new Date(updatedMessage.createdAt).toLocaleDateString()}<br>
                            Mensaje: ${updatedMessage.message.substring(0, 100)}${updatedMessage.message.length > 100 ? '...' : ''}
                        </p>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eaeaea;">
                        <p style="font-size: 14px; color: #666;">Equipo de Soporte<br>${process.env.EMAIL_NAME || 'Tu Empresa'}</p>
                    </div>
                </div>
            </div>
        `;

        // Enviar correo según el estado
        let emailSubject = '';
        let emailHtml = '';
        let emailText = '';

        switch (status) {
            case 'read':
                emailSubject = 'Hemos revisado tu mensaje ✔';
                emailHtml = baseEmailTemplate(
                    'Tu mensaje está siendo procesado',
                    'Hemos recibido y revisado tu mensaje. Actualmente estamos trabajando en tu solicitud.',
                    'En proceso de respuesta'
                );
                emailText = `Hola ${updatedMessage.name},\n\nHemos revisado tu mensaje y estamos trabajando en tu solicitud.\n\nEquipo de Soporte,\n${process.env.EMAIL_NAME || 'Tu Empresa'}`;
                break;

            case 'answered':
                emailSubject = 'Hemos respondido a tu mensaje ✔';
                emailHtml = baseEmailTemplate(
                    'Respuesta a tu consulta',
                    'Nos complace informarte que hemos respondido a tu mensaje. Por favor revisa tu bandeja de entrada.',
                    'Respondido'
                );
                emailText = `Hola ${updatedMessage.name},\n\nHemos respondido a tu mensaje. Por favor revisa tu bandeja de entrada.\n\nEquipo de Soporte,\n${process.env.EMAIL_NAME || 'Tu Empresa'}`;
                break;

            default: // unread
                emailSubject = 'Hemos recibido tu mensaje ✔';
                emailHtml = baseEmailTemplate(
                    'Mensaje recibido',
                    'Hemos recibido tu mensaje correctamente. Pronto lo revisaremos y te contactaremos.',
                    'Pendiente de revisión'
                );
                emailText = `Hola ${updatedMessage.name},\n\nHemos recibido tu mensaje y pronto lo revisaremos.\n\nEquipo de Soporte,\n${process.env.EMAIL_NAME || 'Tu Empresa'}`;
        }

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: [updatedMessage.email, process.env.EMAIL_USER],
            subject: emailSubject,
            text: emailText,
            html: emailHtml
        });

        return res.status(200).json({
            message: 'El status del mensaje ha sido actualizado',
            data: updatedMessage
        });

    } catch (error) {
        console.error('Error al actualizar el status:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// respues al cliente
messageRouter.post('/:id/responder', async (req, res) => {
    try {
        const { id } = req.params;
        const { respuesta } = req.body;

        if (!respuesta || respuesta.trim().length === 0) {
            console.log('Respuesta vacía recibida');
            return res.status(400).json({ error: 'La respuesta no puede estar vacía' });
        }

        // Buscar el mensaje original
        const mensajeOriginal = await Message.findById(id);
        if (!mensajeOriginal) {
            return res.status(404).json({ error: 'Mensaje no encontrado' });
        }

        // Configurar el transporter para enviar el correo
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Plantilla HTML para la respuesta
        const respuestaHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px; overflow: hidden;">
                <div style="background: #4a6bff; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Respuesta a tu consulta</h1>
                </div>
                
                <div style="padding: 20px;">
                    <p style="font-size: 16px;">Hola <strong>${mensajeOriginal.name}</strong>,</p>
                    <p style="font-size: 16px;">Gracias por contactarnos. Aquí está nuestra respuesta a tu consulta:</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="font-size: 14px; margin: 0; color: #555;"><strong>Tu mensaje original:</strong></p>
                        <p style="font-size: 14px; margin: 10px 0 0 0; color: #333;">${mensajeOriginal.message}</p>
                    </div>
                    
                    <div style="background: #f0f7ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4a6bff;">
                        <p style="font-size: 14px; margin: 0; color: #555;"><strong>Nuestra respuesta:</strong></p>
                        <p style="font-size: 14px; margin: 10px 0 0 0; color: #333;">${respuesta}</p>
                    </div>
                    
                    <p style="font-size: 16px;">Si necesitas más información, no dudes en responder a este correo.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea;">
                        <p style="font-size: 14px; color: #666;">Equipo de Soporte<br>${process.env.EMAIL_NAME || 'Tu Empresa'}</p>
                    </div>
                </div>
            </div>
        `;

        // Enviar el correo con la respuesta
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: [mensajeOriginal.email, process.env.EMAIL_USER], // Enviar copia al admin también
            subject: `Respuesta a tu consulta - ${process.env.EMAIL_NAME || 'Tu Empresa'}`,
            text: `Hola ${mensajeOriginal.name},\n\nAquí está nuestra respuesta a tu consulta:\n\nTu mensaje original:\n${mensajeOriginal.message}\n\nNuestra respuesta:\n${respuesta}\n\nEquipo de Soporte,\n${process.env.EMAIL_NAME || 'Tu Empresa'}`,
            html: respuestaHtml
        });

        // Actualizar el estado del mensaje a "answered"
        const updatedMessage = await Message.findByIdAndUpdate(
            id,
            { status: 'answered' },
            { new: true }
        );

        res.status(200).json({
            message: 'Respuesta enviada correctamente',
            data: updatedMessage
        });
    } catch (error) {
        console.error('Error al enviar la respuesta:', error);
        res.status(500).json({ error: 'Error interno del servidor al enviar la respuesta' });
    }
});

module.exports=messageRouter;