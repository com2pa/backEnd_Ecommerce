const BrandRouter = require('express').Router();
const Brand = require('../models/brand');

// Obtener todas las marcas/empresas
BrandRouter.get('/', async (req, res) => {
  // mostrando todas las marcas
  const allBrand = await Brand.find({});
  console.log('todas las marcas', allBrand);
  // Enviar la respuesta con la marca/empresa mostando todas las  marcas registradas
  res.json(allBrand);
});


// crear marca/empresa del producto
BrandRouter.post('/', async (req, res) => {
  const user = req.user
  if (!user.role === 'admin') {
    return res
     .status(401)
     .json({ message: 'No tienes permisos para realizar esta acción' });
  }
  const { name, rif } = req.body;
  console.log(name, rif);

  // Validar los datos
  if (!name || !rif) {
    return res.status(400).json({ message: 'Los datos son necesarios' });
  }
  // Verificar si la marca/empresa ya existe
  const existingBrand = await Brand.findOne({ rif });
  if (existingBrand) {
    return res.status(400).json({ message: 'La marca/empresa ya existe' });
  }
  // Crear la marca/empresa
  const newBrand = new Brand({ name, rif });
  await newBrand.save();
  // Enviar la respuesta con la marca/empresa creada
  res.status(201).json({ msg: 'Marca/empresa creada', newBrand });
});

// editar marca/empresa

BrandRouter.patch('/:id', async (req, res) => {
  const user = req.user;
  if (!user.role === 'admin') {
    return res
      .status(401)
      .json({ message: 'No tienes permisos para realizar esta acción' });
  }
  const { name, rif } = req.body;
  const brandId = req.params.id;

  // Validar los datos
  if (!name || !rif) {
    return res.status(400).json({ message: 'Los datos son necesarios' });
  }
  // Verificar si la marca/empresa ya existe
  const existingBrand = await Brand.findByIdAndUpdate(
    brandId,
    { name, rif },
    { new: true }
  );
  if (!existingBrand) {
    return res.status(404).json({ message: 'Marca/empresa no encontrada' });
  }
  // Enviar la respuesta con la marca/empresa editada
  res.json({ msg: 'Marca/empresa editada', existingBrand });
});

// eliminar marca/empresa

BrandRouter.delete('/:id', async (req, res) => {
  const user = req.user;
  if (!user.role === 'admin') {
    return res
      .status(401)
      .json({ message: 'No tienes permisos para realizar esta acción' });
  }
  const brandId = req.params.id;

  // Verificar si la marca/empresa existe
  const existingBrand = await Brand.findByIdAndDelete(brandId);
  console.log('eliminando', existingBrand);
  if (!existingBrand) {
    return res.status(404).json({ message: 'Marca/empresa no encontrada' });
  }
  // Enviar la respuesta con la marca/empresa eliminada
  res.json({ msg: 'Marca/empresa eliminada', existingBrand });
});

module.exports = BrandRouter;
