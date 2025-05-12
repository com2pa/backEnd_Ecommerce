const mongoose = require('mongoose')

// documents
const userSchema = new mongoose.Schema({
  name: String,
  lastname: String,
  age: Number,
  address: String,
  cedula:String,
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'editor', 'viewer', 'superadmin', 'auditor'],
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  verify: {
    type: Boolean,
    default: false,
  },
  online: {
    type: Boolean,
    default: false,
  },
  avatar: {
    type: String,
    default: 'default.png',
  },
  shoppingHistory:[{//historia del compra
    type:Number
  }]
});
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