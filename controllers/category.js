const categoryRouter = require('express').Router();
const Category = require('../models/category');
const Subcategory = require('../models/subcategory');

// mostrando todas las categorias

categoryRouter.get('/', async (req, res) => {
  const categories = await Category.find({}).populate('user', 'name');
  // console.log('las categorias', categories);
  res.json(categories);
});
// mostrar la subcatetegoria por id de la categoria
categoryRouter.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('user', 'name')
      .populate({
        path: 'subcategory',
        select: 'name code', // Selecciona los campos que quieres mostrar
        options: { sort: { name: 1 } } // Ordena por nombre ascendente
      });

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Enviar la respuesta con la categoría y sus subcategorías ya pobladas
    res.json({
      id: category.id,
      name: category.name,
      code: category.code,
      user: category.user,
      subcategories: category.subcategory || [] // Asegura que siempre haya un array
    });
  } catch (error) {
    console.error('Error al obtener categoría:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// creando categoria de los productos
categoryRouter.post('/', async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res
      .status(401)
      .json({ message: 'No tienes permisos para realizar esta acción' });
  }
  const { name, code } = req.body;
  console.log(name, code);
  // Validar los datos
  if (!name || !code) {
    return res
      .status(400)
      .json({ message: 'Debes proporcionar nombre y código' });
  }

  // Verificar si el código ya existe
  const existingCategory = await Category.findOne({ code });
  if (existingCategory) {
    return res
      .status(400)
      .json({ message: 'El código de categoría ya existe' });
  }
  // Crear categoría
  const newCategory = new Category({ name, code, user: user._id });
  console.log('nueva categoria creada', newCategory);
  // Guardar categoría en la base de datos
  await newCategory.save();
  // Populate el usuario antes de enviar la respuesta
  const populatedCategory = await Category.findById(newCategory._id).populate(
    'user',
    'name' 
  );
  // Crear y enviar la respuesta con la categoría creada
  res.status(201).json(newCategory);
});

// editando la categoria

categoryRouter.patch('/:id', async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res
      .status(401)
      .json({ message: 'No tienes permisos para realizar esta acción' });
  }
    const { name, code } = req.body;
    // Validar los datos
    if (!name ||!code) {
      return res
       .status(400)
       .json({ message: 'Debes proporcionar nombre y código' });
    }

    // Verificar si el código ya existe
    const existingCategory = await Category.findOne({ code });
    if (existingCategory && existingCategory._id.toString()!== req.params.id) {
      return res
       .status(400)
       .json({ message: 'El código de categoría ya existe' });
    }
    // Buscar la categoría por id
    const category = await Category.findByIdAndUpdate(req.params.id,{ name, code },{ new: true });
    console.log('categoria editada', category)
    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Crear y enviar la respuesta con la categoría editada
    res.status(200).json({ msg: 'Categoría editada', category });
});



// eliminar una cateria por id

categoryRouter.delete('/:id', async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res
      .status(401)
      .json({ message: 'No tienes permisos para realizar esta acción' });
  }

  const category = await Category.findByIdAndDelete(req.params.id);

  if (!category) {
    return res.status(404).json({ message: 'Categoría no encontrada' });
  }

  return res.json({ msg: 'Categoría eliminada', category });
});
module.exports = categoryRouter;
