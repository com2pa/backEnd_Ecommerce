const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, 'Por favor ingresa un email válido']
    },
    phone: {
        type: String,  // Cambiado a String para manejar formatos internacionales
        required: true
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['unread', 'answered', 'read'],
        default: 'unread'
    },
    createdAt: {  
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
})

// Función  para formatear fecha
function formatDateTo12Hours(date) {
    if (!date || !(date instanceof Date)) return ''
    
    const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }
    
    return date.toLocaleString('es-ES', options)
}

messageSchema.set('toJSON', {
    virtuals: true,
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
        
        // Formatear la fecha createdAt
        if (returnedObject.createdAt) {
            returnedObject.fechaFormatted = formatDateTo12Hours(returnedObject.createdAt)
            returnedObject.fechaISO = returnedObject.createdAt.toISOString()
        }
        
        return returnedObject
    }
})

// Virtual para fácil acceso a la fecha formateada
messageSchema.virtual('fecha').get(function() {
    return formatDateTo12Hours(this.createdAt)
})

const Message = mongoose.model('Message', messageSchema)

module.exports = Message