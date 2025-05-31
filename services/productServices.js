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

// Actualizar producto con manejo completo de referencias e imagen
const updateProduct = async (productId, productData, imageFile, userId) => {
  let imageName = null;
  try {
    // Validaciones básicas
    if (!productId || !productData) {
      throw new Error('ID del producto o datos faltantes');
    }
    // Buscar el producto
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Producto no encontrado');
    }

    // Guardar referencias antiguas para actualización
    const oldBrand = product.brand;
    const oldSubcategory = product.subcategory;

    // Manejar la imagen si se proporciona
    if (imageFile) {
      // Eliminar imagen anterior si existe
      if (product.prodImage) {
        const oldImagePath = path.join(__dirname, '..', 'uploads', 'products', product.prodImage);
        try { await fs.unlink(oldImagePath); } catch (err) { console.error('Error eliminando imagen antigua:', err); }
      }
      imageName = await handleImageUpload(imageFile);
      product.prodImage = imageName;
    }


    // Actualizar los datos del producto
    Object.assign(product, productData);
    product.user = userId; // Actualizar usuario que modificó

    // Guardar el producto actualizado
    const updatedProduct = await product.save();

    // Actualizar referencias en Brand y Subcategory
    if (oldBrand.toString() !== product.brand.toString()) {
      await Brand.findByIdAndUpdate(oldBrand, {
        $pull: { products: productId }
      });
      await Brand.findByIdAndUpdate(product.brand, {
        $addToSet: { products: productId }
      }); 
    }
    if (oldSubcategory.toString() !== product.subcategory.toString()) {
      await Subcategory.findByIdAndUpdate(oldSubcategory, {
        $pull: { products: productId }
      });
      await Subcategory.findByIdAndUpdate(product.subcategory, {
        $addToSet: { products: productId }
      });
    }

    return updatedProduct;
  } catch (error) {
    // Limpieza en caso de error
    if (imageFile && imageFile.path) {
      try { await fs.unlink(imageFile.path); } catch {}
    }
    if (imageName) {
      const uploadPath = path.join(__dirname, '..', 'uploads', 'products', imageName);
      try { await fs.unlink(uploadPath); } catch {}
    }
    throw error;
  }
};

// eliminar un producto por el id
const deleteProduct = async (productId) => {
  try {
    // Buscar el producto
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    // Eliminar imagen del sistema de archivos
    if (product.prodImage) {
      const imagePath = path.join(__dirname, '..', 'uploads', 'products', product.prodImage);
      try { await fs.unlink(imagePath); } catch (err) { console.error('Error eliminando imagen:', err); }
    }
    // Eliminar el producto
    const deletedProduct = await Product.findByIdAndDelete(productId);
    if (!deletedProduct) {
      throw new Error('Error al eliminar el producto');
    }
    // Eliminar referencias en Brand y Subcategory
    await Promise.all([
      Brand.findByIdAndUpdate(product.brand, {
        $pull: { products: productId }
      }),
      Subcategory.findByIdAndUpdate(product.subcategory, {
        $pull: { products: productId }
      })
    ]);
    return deletedProduct;
  }
  catch (error) {
    console.error('Error al eliminar producto:', error);
    throw error;
  }
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct
};