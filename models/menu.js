const mongoose = require("mongoose");

const menuSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre del menú es requerido'],
        trim: true,
        minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
        maxlength: [50, 'El nombre no puede exceder 50 caracteres']
    },
    status: {
        type: Boolean,
        default: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'El usuario es requerido'],
    },
    roles: [{
        type: String,
        enum: {
            values: ['user', 'admin', 'editor', 'viewer', 'superadmin', 'auditor'],
            message: 'Rol no válido'
        },
        required: [true, 'Debe especificar al menos un rol'],
        validate: {
            validator: function(roles) {
                return roles && roles.length > 0;
            },
            message: 'Debe especificar al menos un rol'
        }
    }]
}, {
    timestamps: true
});

// Índice para búsquedas más eficientes
menuSchema.index({ name: 1 }, { unique: true });
menuSchema.index({ status: 1 });
menuSchema.index({ roles: 1 });

menuSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
    },
});

const Menu = mongoose.model("Menu", menuSchema);
module.exports = Menu;