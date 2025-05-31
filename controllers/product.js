const productRouter = require('express').Router();
const Product = require('../models/product');
const Brand = require('../models/brand');
const Subcategory = require('../models/subcategory');
const Aliquot = require('../models/aliquots');
const User = require('../models/user');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { createProduct, updateProduct, deleteProduct } = require('../services/productServices');

// Configuración de multer 
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'products');
    // Crear directorio si no existe
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no soportado. Solo JPG/PNG permitidos'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});
// mostrando todos los productos
productRouter.get('/', async (req, res) => {
  try {
    const productos = await Product.find({}).populate('brand', 'name').populate('subcategory', 'name').populate('aliquots', 'percentage').exec()
   

    return res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return res.status(500).json({ error: 'Error al obtener los productos' });
  }
})

// mostrando la imagen de un producto
productRouter.get('/image/:imageName', (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(__dirname, '..', 'uploads', 'products', imageName);
  
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    res.sendFile(imagePath);
  });
});

// creando el producto
productRouter.post('/', upload.single('prodImage'), async (req, res) => {
  try {
    const user = req.user;
    
    // Validar permisos
    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'No tienes permisos para realizar esta acción'
      });
    }
    // Validar que se haya subido una imagen
        if (!req.file) {
      return res.status(400).json({
        error: 'Debe subir una imagen para el producto'
      });
    }

    // Validar campos requeridos
    const requiredFields = [
    'description',
    'price',
    'stock',
    'unit',
    'unitsPerPackage',
    'minStock',
    'sku',
    'isActive',
    'subcategoryId',
    'brandId',
    'aliquotId'
    ];
    
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Faltan campos requeridos: ${missingFields.join(', ')}`
      });
    }

    // Verificar referencias
    const [brandExists, subcategoryExists] = await Promise.all([
      Brand.findById(req.body.brandId),
      Subcategory.findById(req.body.subcategoryId)
    ]);

    if (!brandExists || !subcategoryExists) {
      return res.status(404).json({
        error: 'Marca o subcategoría no encontrada'
      });
    }

    // Crear el producto usando el servicio
    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      stock: parseInt(req.body.stock),
      unit: req.body.unit,
      unitsPerPackage: parseInt(req.body.unitsPerPackage),
      minStock: parseInt(req.body.minStock),
      sku: req.body.sku.toUpperCase(),
      isActive: req.body.isActive !== 'false',
      subcategory: req.body.subcategoryId,
      brand: req.body.brandId,
      aliquots: req.body.aliquotId
    };

    const newProduct = await createProduct(productData, req.file, user._id);

    return res.status(201).json({
      message: 'Producto creado exitosamente',
      product: newProduct
    });

  } catch (error) {
    console.error('Error al crear producto:', error);
    
    // Manejar errores específicos
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'El SKU ya está en uso por otro producto'
      });
    }

    if (error.message.includes('image')) {
      return res.status(400).json({
        error: error.message
      });
    }

    return res.status(500).json({
      error: 'Error al crear el producto',
      details: error.message
    });
  }
});

// editando el producto

productRouter.patch('/:id', upload.single('image'), async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }
    // Validar que se haya proporcionado un ID de producto
    const productId = req.params.id;
    // console.log('ID del producto:', productId);
    
   
    // // Validar campos requeridos
    const requiredFields = [
      'name', 'description', 'price', 'stock', 'unit', 
      'unitsPerPackage', 'minStock', 'sku', 'isActive',
      'subcategoryId', 'brandId', 'aliquotId'
    ];
    
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Faltan campos requeridos: ${missingFields.join(', ')}`,
      });
    } 

    // // Preparar datos para el servicio
    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      stock: parseInt(req.body.stock),
      unit: req.body.unit,
      unitsPerPackage: parseInt(req.body.unitsPerPackage),
      minStock: parseInt(req.body.minStock),
      sku: req.body.sku.toUpperCase(),
      isActive:req.body.isActive, 
      subcategory: req.body.subcategoryId,
      brand: req.body.brandId,
      aliquots: req.body.aliquotId
    };
    // console.log('Datos del producto a actualizar:', productData);

    // // Usar el servicio de actualización
    const updatedProduct = await updateProduct(
      productId, 
      productData, 
      req.file, 
      user._id
    );

    return res.status(200).json( updatedProduct);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    
    if (error.code === 11000 && error.keyPattern?.sku) {
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

  const deletedProduct = await deleteProduct(productId);

  // // busco el id del producto
  // const product = await Product.findById(productId);
  // // verifico si el procto existe
  // if (!product) {
  //   return res.status(404).json({ message: 'Producto no encontrado' });
  // }
  // // elimino el producto
  // const eliminado = await Product.findByIdAndDelete(productId);
  // // muestro el producto eliminado por consola
  // console.log('Producto eliminado:', eliminado);

  // // eliminando el producto del modelo de brand
  // const IdproductoBrand = await Brand.findByIdAndUpdate(product.brand, {
  //   $pull: { products: productId },
  // });
  // console.log('Producto eliminado de brand:', IdproductoBrand);

  // // elimino el producto del modelo de subcategory
  // const Idproductocategory = await Subcategory.findByIdAndUpdate(
  //   product.subcategory,
  //   { $pull: { products: productId } }
  // );
  // console.log('Producto eliminado de category:', Idproductocategory);
  // devuelvo el producto eliminado al cliente con status 200
  return res.json(deletedProduct);
});

module.exports = productRouter;
