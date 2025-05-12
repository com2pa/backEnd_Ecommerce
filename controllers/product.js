const productRouter = require('express').Router();
const Product = require('../models/product');
const Brand = require('../models/brand');
const Subcategory = require('../models/subcategory');
const User = require('../models/user');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configuración de multer (igual que tenías)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, 'uploads/products/', true);
    }
  },
  filename: function (req, file, cb) {
    cb(null, 'products ' + Date.now() + ' - ' + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
// creando el producto
productRouter.post('/', upload.single('image'), async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res
      .status(401)
      .json({ message: 'No tienes permisos para realizar esta acción' });
  }

  const {
    name,
    description,
    price,
    stock,
    unit,
    unitsPerPackage,
    minStock,
    sku,
    isActive,
    subcategoryId,
    brandId,
    aliquotId
  } = req.body;
  brandId,
    console.log(
      'producto',
      name,
      description,
      price,
      stock,
      unit,
      unitsPerPackage,
      minStock,
      sku,
      isActive,
      subcategoryId,
      brandId,
      aliquotId
    );

  // Validación de campos requeridos
  if (
    !name ||
    !description ||
    !price ||
    !stock ||
    !unit ||
    !unitsPerPackage ||
    !minStock ||
    !sku ||
    !subcategoryId ||
    !brandId ||
    !isActive ||
    !aliquotId
  ) {
    return res.status(400).json({
      error:
        'Faltan campos requeridos: nombre, descripción, precio, stock, unidad, unidades por paquete, mínimo en stock, SKU, activo, categoría y marca, alicuota',
    });
  }

  // Verificar si la categoría existe
  try {
    const subcategoryExists = await Subcategory.findById(subcategoryId);
    if (!subcategoryExists) {
      return res.status(404).json({
        error: 'La subcategoría especificada no existe',
      });
    }
  } catch (error) {
    return res.status(400).json({
      error: 'ID de categoría inválido',
    });
  }

  // Verificar si la marca existe
  try {
    const brandExists = await Brand.findById(brandId);
    if (!brandExists) {
      return res.status(404).json({
        error: 'La marca especificada no existe',
      });
    }
  } catch (error) {
    return res.status(400).json({
      error: 'ID de marca inválido',
    });
  }

  // Verificar si se subió una imagen
  if (!req.file) {
    return res
      .status(400)
      .json({ error: 'Debes subir una imagen del producto' });
  }

  // Validar extensión de la imagen
  let image = req.file.originalname;
  const imageSplit = image.split('.');
  const ext = imageSplit[imageSplit.length - 1].toLowerCase();

  if (ext !== 'png' && ext !== 'jpg' && ext !== 'jpeg') {
    // Borrar archivo subido
    const filePath = req.file.path;
    fs.unlinkSync(filePath);
    return res
      .status(400)
      .json({ error: 'Formato de imagen no válido (solo JPG/PNG)' });
  }

  // Generar nombre único para la imagen del producto
  const imageName = `product-${Date.now()}.${ext}`;
  const imagePath = path.join(__dirname, '..', 'uploads/products', imageName);

  // Mover el archivo a su ubicación final
  fs.renameSync(req.file.path, imagePath);

  try {
    // Crear y guardar el nuevo producto
    const newProduct = new Product({
      name,
      description,
      price: Number(price),
      stock: Number(stock) || 0,
      unit,
      unitsPerPackage: Number(unitsPerPackage) || 1,
      minStock: Number(minStock) || 0,
      sku,
      isActive: isActive !== 'false', // Convierte string a boolean
      subcategory: subcategoryId,
      brand: brandId,
      image: imageName,
      aliquots : aliquotId,
      user: req.user.id,
    });
    // guardando el producto
    const savedProduct = await newProduct.save();
    console.log('guardando el producto', savedProduct);
    if (!savedProduct) {
      return res.status(500).json({
        error: 'Error al guardar el producto',
      });
    }
    // guardar el id producto en el modelo seleccionado de brand
    const IdproductoBrand = await Brand.findByIdAndUpdate(brandId, {
      $push: { products: savedProduct._id },
    });
    console.log('guardando el id del producto  a brand', IdproductoBrand);
    // verificar si el producto existe en el modelo de brand
    if (!IdproductoBrand) {
      return res.status(404).json({
        error: 'El producto no se pudo agregar a la marca',
      });
    }

    // guardar el id producto en el modelo seleccionado de subcategory
    const Idproductosubcategory = await Subcategory.findByIdAndUpdate(subcategoryId, {
      $push: { products: savedProduct._id },
    });
    console.log('guardando el id del producto a category', Idproductosubcategory);
    // verificar si el producto existe en el modelo de category
    if (!Idproductosubcategory) {
      return res.status(404).json({
        error: 'El producto no se pudo agregar a la categoría',
      });
    }

    return res.status(201).json({
      message: 'Producto creado exitosamente',
      product: savedProduct,
    });
  } catch (error) {
    // Si hay un error, borrar la imagen subida
    const filePath = path.join(__dirname, '..', 'uploads/products', imageName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Manejar error de SKU duplicado
    if (error.code === 11000 && error.keyPattern.sku) {
      return res.status(400).json({
        error: 'El SKU ya está en uso por otro producto',
      });
    }

    return res.status(500).json({
      error: 'Error al guardar el producto',
      details: error.message,
    });
  }
});

// editando el producto

productRouter.patch('/:id', upload.single('image'), async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(401).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }

    const productId = req.params.id;
    // buscamos el producto
    const product = await Product.findById(productId);
    // verifico el producto
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    // lo que obtenemos del body
    const {
      name,
      description,
      price,
      stock,
      unit,
      unitsPerPackage,
      minStock,
      sku,
      isActive,
      subcategoryId,
      brandId,
      aliquotId
    } = req.body;

    // Validaciones básicas
    if (
      !name ||
      !description ||
      !price ||
      !stock ||
      !unit ||
      !unitsPerPackage ||
      !minStock ||
      !sku ||
      !subcategoryId ||
      !brandId ||
      !aliquotId ||
      isActive === undefined
    ) {
      return res.status(400).json({
        error: 'Faltan campos requeridos',
      });
    }

    // Verificar categoría y marca en paralelo para mejor rendimiento
    const [subcategoryExists, brandExists] = await Promise.all([
      Subcategory.findById(subcategoryId),
      Brand.findById(brandId),
    ]);

    if (!subcategoryExists) {
      return res
        .status(404)
        .json({ error: 'La categoría especificada no existe' });
    }

    if (!brandExists) {
      return res.status(404).json({ error: 'La marca especificada no existe' });
    }

    // Preparar datos de actualización
    const updateData = {
      name,
      description,
      price: Number(price),
      stock: Number(stock) || 0,
      unit,
      unitsPerPackage: Number(unitsPerPackage) || 1,
      minStock: Number(minStock) || 0,
      sku,
      isActive: isActive !== 'false',
      subcategory: subcategoryId,
      brand: brandId,
      aliquots: aliquotId,
    };

    // Manejo de imagen si se subió una nueva
    if (req.file) {
      // Validar extensión de la imagen
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      if (!['png', 'jpg', 'jpeg'].includes(ext)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: 'Formato de imagen no válido (solo JPG/PNG)',
        });
      }

      // Eliminar imagen anterior si existe
      if (product.image) {
        const oldImagePath = path.join(
          __dirname,
          '..',
          'uploads/products',
          product.image
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Generar nuevo nombre y mover la imagen
      const imageName = `product-${Date.now()}.${ext}`;
      const imagePath = path.join(
        __dirname,
        '..',
        'uploads/products',
        imageName
      );
      fs.renameSync(req.file.path, imagePath);

      updateData.image = imageName;
    }

    // Actualizar producto en una sola operación
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    );

    // Actualizar referencias en categoría y marca si cambiaron
    if (product.subcategory.toString() !== subcategoryId) {
      await Promise.all([
        Category.findByIdAndUpdate(product.subcategory, {
          $pull: { products: productId },
        }),
        Category.findByIdAndUpdate(subcategoryId, {
          $push: { products: productId },
        }),
      ]);
    }

    if (product.brand.toString() !== brandId) {
      await Promise.all([
        Brand.findByIdAndUpdate(product.brand, {
          $pull: { products: productId },
        }),
        Brand.findByIdAndUpdate(brandId, {
          $push: { products: productId },
        }),
      ]);
    }

    return res.status(200).json({
      message: 'Producto actualizado exitosamente',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);

    // Eliminar imagen nueva si hubo error después de subirla
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Manejar error de SKU duplicado
    if (error.code === 11000 && error.keyPattern.sku) {
      return res.status(400).json({
        error: 'El SKU ya está en uso por otro producto',
      });
    }

    return res.status(500).json({
      error: 'Error al actualizar el producto',
      details: error.message,
    });
  }
});

// elimiando un producto por el id

productRouter.delete('/:id', async (req, res) => {
  const user = req.user;
  if (!user.role === 'admin') {
    return res
      .status(401)
      .json({ message: 'No tienes permisos para realizar esta acción' });
  }
  const productId = req.params.id;
  // busco el id del producto
  const product = await Product.findById(productId);
  // verifico si el procto existe
  if (!product) {
    return res.status(404).json({ message: 'Producto no encontrado' });
  }
  // elimino el producto
  const eliminado = await Product.findByIdAndDelete(productId);
  // muestro el producto eliminado por consola
  console.log('Producto eliminado:', eliminado);

  // eliminando el producto del modelo de brand
  const IdproductoBrand = await Brand.findByIdAndUpdate(product.brand, {
    $pull: { products: productId },
  });
  console.log('Producto eliminado de brand:', IdproductoBrand);

  // elimino el producto del modelo de subcategory
  const Idproductocategory = await Subcategory.findByIdAndUpdate(
    product.subcategory,
    { $pull: { products: productId } }
  );
  console.log('Producto eliminado de category:', Idproductocategory);
  // devuelvo el producto eliminado al cliente con status 200
  return res.json({ message: 'Producto eliminado exitosamente', eliminado });
});

module.exports = productRouter;
