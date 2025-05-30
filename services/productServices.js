const Product = require('../models/product');
const Brand = require('../models/brand');
const Subcategory = require('../models/subcategory');
const fs = require('fs').promises;
const path = require('path');

// Helper para manejar imágenes
const handleImageUpload = async (file) => {
  if (!file) {
    throw new Error('No se ha subido ninguna imagen');
  }

  const allowedTypes = ['image/jpeg', 'image/png'];
  if (!allowedTypes.includes(file.mimetype)) {
    await fs.unlink(file.path);
    throw new Error('Formato de imagen no válido. Solo se permiten JPG/PNG');
  }

  const ext = file.originalname.split('.').pop().toLowerCase();
  const imageName = `product-${Date.now()}.${ext}`;
  const uploadDir = path.join(__dirname, '..', 'uploads', 'products');

  // Asegurar que el directorio existe
  await fs.mkdir(uploadDir, { recursive: true });

  const uploadPath = path.join(uploadDir, imageName);

  // Mover el archivo a la ubicación final
  await fs.rename(file.path, uploadPath);

  return imageName;
};

// Crear un producto
const createProduct = async (productData, imageFile, userId) => {
  let imageName = null;
  try {
    // Validaciones básicas
    if (!productData || !imageFile) {
      throw new Error('Datos del producto o imagen faltantes');
    }

    // Manejar la imagen
    imageName = await handleImageUpload(imageFile);

    // Crear el producto
    const newProduct = new Product({
      ...productData,
      prodImage: imageName,
      user: userId
    });

    // Guardar el producto
    const savedProduct = await newProduct.save();

    // Actualizar referencias en Brand y Subcategory
    await Promise.all([
      Brand.findByIdAndUpdate(productData.brand, {
        $addToSet: { products: savedProduct._id }
      }),
      Subcategory.findByIdAndUpdate(productData.subcategory, {
        $addToSet: { products: savedProduct._id }
      })
    ]);

    return savedProduct;
  } catch (error) {
    // Limpieza en caso de error
    if (imageFile && imageFile.path) {
      try { await fs.unlink(imageFile.path); } catch {}
    }
    // Si la imagen ya fue movida pero ocurre un error después
    if (imageName) {
      const uploadPath = path.join(__dirname, '..', 'uploads', 'products', imageName);
      try { await fs.unlink(uploadPath); } catch {}
    }
    throw error;
  }
};

module.exports = {
  createProduct
};