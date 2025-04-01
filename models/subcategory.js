const mongoose = require('mongoose');

const subcategorySchema = new mongoose.Schema({
  name: String,
  code: String,
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }
  ],
});

subcategorySchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

const Subcategory = mongoose.model('Subcategory', subcategorySchema)
module.exports = Subcategory;