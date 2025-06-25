const messageRouter=require('express').Router()
const Message=require('../models/message')

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
        // Respuesta exitosa
        res.status(201).json({
        message: 'Mensaje recibido correctamente',
        data: savedMessage
        })
    } catch (error) {
        console.error('Error al guardar mensaje:', error)
    }
})

module.exports=messageRouter;