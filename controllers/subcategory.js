const subcategoryRouter = require('express').Router();
const Subcategory = require('../models/subcategory');
const Category = require('../models/category');
const User = require('../models/user');
const { userExtractor } = require('../middlewares/auth');

// Mostrar todas las subcategorías

subcategoryRouter.get('/', async (req, res) => {
  const subcategories = await Subcategory.find().populate('category', 'name');
  res.json(subcategories);
});
//  mostrando los productos por el id de la subcategoría
subcategoryRouter.get('/:id', async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id)
      .populate('category', 'name _id')
      .populate('products', 'name price prodImage'); 
    
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategoría no encontrada' });
    }
    
    res.json(subcategory);
  } catch (error) {
    console.error('Error al obtener subcategoría:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
});

// Crear subcategoría
subcategoryRouter.post('/', userExtractor, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(401).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }

    const { name, code, categoryId } = req.body;

    // Validaciones básicas
    if (!name || !code || !categoryId) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: name, code o categoryId',
      });
    }

    // Verificar que la categoría exista
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        error: 'La categoría especificada no existe',
      });
    }

    // Verificar si el código de subcategoría ya existe
    const existingSubcategory = await Subcategory.findOne({ code });
    if (existingSubcategory) {
      return res.status(400).json({
        error: 'El código de subcategoría ya está en uso',
      });
    }

    // Crear la nueva subcategoría
    const newSubcategory = new Subcategory({
      name,
      code,
      category: categoryId,
    });

    const savedSubcategory = await newSubcategory.save();

    // Verificar si el ID de la subcategoría ya está en la categoría
    if (
      category.subcategory &&
      category.subcategory.includes(savedSubcategory._id)
    ) {
      console.log(
        'El ID de subcategoría ya existe en la categoría, no se actualizará'
      );
    } else {
      // Actualizar la categoría solo si el ID no existe
      await Category.findByIdAndUpdate(categoryId, {
        $addToSet: { subcategory: savedSubcategory._id },
      });
    }

    // Obtener la subcategoría con la categoría populada
    const populatedSubcategory = await Subcategory.findById(
      savedSubcategory._id
    ).populate('category', 'name _id');

    return res.status(201).json(populatedSubcategory);
  } catch (error) {
    console.error('Error al crear subcategoría:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
});

// Editar subcategoría
subcategoryRouter.patch('/:id', userExtractor, async (req, res) => { 
  try {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(401).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }

    const subcategoryId = req.params.id;
    const { name, code, categoryId } = req.body;

    // Validaciones básicas
    if (!name || !code) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: name o code',
      });
    }

    // Verificar que la subcategoría exista
    const subcategory = await Subcategory.findById(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({
        error: 'La subcategoría especificada no existe',
      });
    }
    // Verificar si el nuevo código ya existe en otra subcategoría
    if (code !== subcategory.code) {
      const existingCode = await Subcategory.findOne({ 
        code, 
        id: { $ne: subcategoryId } 
      });
      
      if (existingCode) {
        return res.status(400).json({
          error: 'El código de subcategoría ya está en uso',
        });
      }
    }

    // Si se está cambiando de categoría
    let oldCategoryId = subcategory.category;
    let categoryChanged = false;

    if (categoryId && !oldCategoryId.equals(categoryId)) {
      // Verificar que la nueva categoría exista
      const newCategoryExists = await Category.findById(categoryId);
      if (!newCategoryExists) {
        return res.status(404).json({
          error: 'La nueva categoría especificada no existe',
        });
      }
      oldCategoryId = subcategory.category;
      categoryChanged = true;
    }

    // Actualizar la subcategoría
    const updateData = { name, code };
    if (categoryChanged) {
      updateData.category = categoryId;
    }

    const updatedSubcategory = await Subcategory.findByIdAndUpdate(
      subcategoryId,
      updateData,
      { new: true, runValidators: true }
    );

    // Actualizar referencias en categorías si cambió la categoría
    if (categoryChanged) {
      await Promise.all([
        // Remover de la categoría antigua
        Category.findByIdAndUpdate(oldCategoryId, {
          $pull: { subcategory: subcategoryId }
        }),
        // Agregar a la nueva categoría
        Category.findByIdAndUpdate(categoryId, {
          $push: { subcategory: subcategoryId }
        })
      ]);
    }

    return res.status(200).json(updatedSubcategory);
  } catch (error) {
    console.error('Error al actualizar subcategoría:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
});

// eliminar la subcatefgoria por el id 
subcategoryRouter.delete('/:id', userExtractor, async (req, res) => { 
  try {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(401).json({
        message: 'No tienes permisos para realizar esta acción',
      });
    }
    const subcategoryId = req.params.id;
    // Verificar que la subcategoría exista
    const subcategoryExists = await Subcategory.findById(subcategoryId);
    if (!subcategoryExists) {
      return res.status(404).json({
        error: 'La subcategoría especificada no existe',
      });
    }
    // Eliminar la subcategoría
    const idcategoria = await Subcategory.findByIdAndDelete(subcategoryId);
    console.log('subcategoria eliminada',idcategoria)
    // Actualizar la categoría para eliminar esta subcategoría
    const categoryId = subcategoryExists.category;
    const idsubcategoriaCategory = await Category.findByIdAndUpdate(categoryId, {
      $pull: { subcategory: subcategoryId },
    });
    console.log('eliminando id subcategoria de categoria',idsubcategoriaCategory)
    return res.status(200).json({
      message: 'Subcategoría eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar subcategoría:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
})

module.exports = subcategoryRouter;
