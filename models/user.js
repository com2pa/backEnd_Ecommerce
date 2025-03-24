const mongoose = require('mongoose')

// documents
const userSchema = new mongoose.Schema({
    name:String, 
    lastname: String,
    gender: Number,
    age:Number,
    address: String,
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },    
    role: {
        type: String,
        default: 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    verify: {
        type: Boolean,
        default: false
    },
    online: {
        type: Boolean,
        default: false

    }  


})
userSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
        delete returnedObject.password;    
    }
})
const User = mongoose.model('User', userSchema);
module.exports = User;