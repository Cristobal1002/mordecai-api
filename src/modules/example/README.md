# Módulo Example

Este es un módulo de ejemplo completo que demuestra cómo implementar un CRUD siguiendo la arquitectura modular del proyecto.

## 📁 Estructura del Módulo

```
example/
├── example.controller.js    # Maneja peticiones HTTP
├── example.service.js        # Lógica de negocio
├── example.repository.js     # Acceso a base de datos
├── example.routes.js         # Definición de rutas
├── example.validator.js      # Validaciones de entrada
├── example.swagger.js        # Documentación Swagger
└── README.md                 # Este archivo
```

## 🔄 Flujo de una Petición

1. **Routes** (`example.routes.js`) - Define la ruta y aplica middlewares
2. **Validator** (`example.validator.js`) - Valida los datos de entrada
3. **Controller** (`example.controller.js`) - Extrae datos del request y llama al service
4. **Service** (`example.service.js`) - Ejecuta la lógica de negocio
5. **Repository** (`example.repository.js`) - Interactúa con la base de datos
6. **Response** - El controller envía la respuesta al cliente

## 📝 Endpoints Disponibles

- `POST /api/v1/examples` - Crear un nuevo ejemplo
- `GET /api/v1/examples` - Listar ejemplos (con paginación y filtros)
- `GET /api/v1/examples/:id` - Obtener un ejemplo por ID
- `PUT /api/v1/examples/:id` - Actualizar un ejemplo
- `DELETE /api/v1/examples/:id` - Eliminar un ejemplo (soft delete)

## 🧪 Ejemplos de Uso

### Crear un ejemplo
```bash
POST /api/v1/examples
Content-Type: application/json

{
  "name": "Mi ejemplo",
  "description": "Descripción del ejemplo",
  "status": "active"
}
```

### Listar ejemplos con filtros
```bash
GET /api/v1/examples?page=1&perPage=10&name=ejemplo&status=active
```

### Actualizar un ejemplo
```bash
PUT /api/v1/examples/1
Content-Type: application/json

{
  "name": "Ejemplo actualizado",
  "status": "inactive"
}
```

## 📚 Documentación Swagger

La documentación completa de este módulo está disponible en:
- **UI**: http://localhost:3000/api/v1/docs
- **JSON**: http://localhost:3000/api/v1/docs.json

## 💡 Cómo Crear tu Propio Módulo

1. Crea una carpeta en `src/modules/tu-modulo/`
2. Copia la estructura de este módulo
3. Renombra los archivos con el nombre de tu módulo
4. Actualiza `src/routes/index.js` para importar tus rutas
5. Actualiza `src/models/index.js` para inicializar tu modelo (si aplica)
6. Agrega la documentación Swagger en `tu-modulo.swagger.js`

