const menuaccesRouter = require('express').Router()
const { userExtractor } = require('../middlewares/auth');
const Menu = require('../models/menu');

// Obtener el listado de menu
menuaccesRouter.get('/', userExtractor, async (req, res) => {
    try {
        const user = req.user;
        
        // Si es admin, puede ver todos los menús, sino solo los de su rol
        const filter = user.role === 'admin' ? {} : { 
            status: true, 
            roles: { $in: [user.role] } 
        };
        
        const menu = await Menu.find(filter).populate('user', 'name email');
        res.json(menu);
    } catch (error) {
        console.error('Error al obtener menús:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// crear el menu para el dashboard
menuaccesRouter.post('/', userExtractor, async (req, res) => {
    try {
        const user = req.user;
        
        // Verificar permisos de administrador
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'No tienes permisos para realizar esta acción' });
        }

        const { name, roles } = req.body;
        
        // Validar campos requeridos
        if (!name) {
            return res.status(400).json({ error: 'El nombre del menú es requerido' });
        }

        // Verificar si el nombre ya existe
        const existingMenu = await Menu.findOne({ name });
        if (existingMenu) {
            return res.status(400).json({ error: 'Ya existe un menú con este nombre' });
        }

        // Crear el nuevo menú con el usuario y roles
        const newMenu = new Menu({
            name,
            roles: roles || ['admin'], // Si no se envían roles, default es ['admin']
            user: user.id // Asignar el ID del usuario que crea el menú
        });

        // Guardar en la base de datos
        const savedMenu = await newMenu.save();
        
        // Populate para obtener datos del usuario
        const populatedMenu = await Menu.findById(savedMenu._id)
            .populate('user', 'name email');

        res.status(201).json(populatedMenu);
    } catch (error) {
        console.error('Error al crear menú:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ error: errors.join(', ') });
        }
        
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar un menú
menuaccesRouter.put('/:id', userExtractor, async (req, res) => {
    try {
        const user = req.user;
        
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'No tienes permisos para realizar esta acción' });
        }

        const { id } = req.params;
        const { name, roles, status } = req.body;

        const menu = await Menu.findById(id);
        if (!menu) {
            return res.status(404).json({ error: 'Menú no encontrado' });
        }

        // Verificar si el nombre ya existe en otro menú
        if (name && name !== menu.name) {
            const existingMenu = await Menu.findOne({ name });
            if (existingMenu) {
                return res.status(400).json({ error: 'Ya existe un menú con este nombre' });
            }
        }

        const updatedMenu = await Menu.findByIdAndUpdate(
            id,
            { 
                name: name || menu.name,
                roles: roles || menu.roles,
                status: status !== undefined ? status : menu.status
            },
            { new: true, runValidators: true }
        ).populate('user', 'name email');

        res.json(updatedMenu);
    } catch (error) {
        console.error('Error al actualizar menú:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar un menú
menuaccesRouter.delete('/:id', userExtractor, async (req, res) => {
    try {
        const user = req.user;
        
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'No tienes permisos para realizar esta acción' });
        }

        const menu = await Menu.findById(req.params.id);
        if (!menu) {
            return res.status(404).json({ error: 'Menú no encontrado' });
        }

        await Menu.findByIdAndDelete(req.params.id);
        res.status(204).end();
    } catch (error) {
        console.error('Error al eliminar menú:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener menús por rol
menuaccesRouter.get('/role/:role', async (req, res) => {
    try {
        const role = req.params.role;
        const menus = await Menu.find({ 
            status: true, 
            roles: { $in: [role] } 
        }).populate('user', 'name email');
        
        res.json(menus);
    } catch (error) {
        console.error('Error al obtener menús por rol:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = menuaccesRouter;