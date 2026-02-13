# Mordecai AI - API

Backend de consumo para integración Siigo y comercios electrónicos.

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL (opcional, puede deshabilitarse con `DB_ENABLED=false`)

### Instalación

1. Clonar el repositorio
```bash
git clone <repository-url>
cd Mordecai-api
```

2. Instalar dependencias
```bash
npm install
```

3. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

**Nota importante**: Si no tienes base de datos configurada aún, puedes deshabilitarla temporalmente agregando `DB_ENABLED=false` en tu `.env`. El servidor arrancará sin base de datos.

4. Iniciar servidor de desarrollo
```bash
npm run dev
```

5. Iniciar servidor de producción
```bash
npm start
```

## 📁 Estructura del Proyecto

El proyecto sigue una **arquitectura modular** donde cada funcionalidad está organizada en módulos independientes.

```
├── src/
│   ├── config/          # Configuraciones (DB, Firebase, etc.)
│   ├── errors/          # Clases de errores personalizados
│   ├── loaders/         # Cargadores (Express, DB, etc.)
│   ├── middlewares/     # Middlewares personalizados
│   ├── models/          # Modelos de Sequelize
│   ├── modules/         # Módulos de la aplicación (arquitectura modular)
│   │   └── module-name/
│   │       ├── module-name.controller.js  # Controladores
│   │       ├── module-name.service.js     # Lógica de negocio
│   │       ├── module-name.repository.js  # Acceso a datos
│   │       ├── module-name.routes.js      # Definición de rutas
│   │       ├── module-name.validator.js   # Validaciones
│   │       └── module-name.swagger.js     # Documentación Swagger (opcional)
│   ├── routes/          # Rutas principales (health, etc.)
│   ├── utils/           # Utilidades (logger, helpers)
│   └── server.js        # Configuración del servidor
├── app.js               # Punto de entrada
└── package.json
```

### Arquitectura Modular

El proyecto sigue una **arquitectura modular** donde cada funcionalidad está organizada en módulos independientes. Cada módulo contiene toda la lógica relacionada con una funcionalidad específica:

- **Controller** (`*.controller.js`): Maneja las peticiones HTTP y respuestas
- **Service** (`*.service.js`): Contiene la lógica de negocio y validaciones
- **Repository** (`*.repository.js`): Gestiona el acceso a la base de datos
- **Routes** (`*.routes.js`): Define las rutas del módulo y aplica middlewares
- **Validator** (`*.validator.js`): Validaciones de entrada con express-validator
- **Swagger** (`*.swagger.js`): Documentación de la API (opcional)

### Flujo de una Petición

```
Request → Routes → Validator → Controller → Service → Repository → Database
                                                      ↓
Response ← Routes ← Controller ← Service ← Repository ← Database
```

1. **Routes**: Define la ruta y aplica middlewares (auth, validación, etc.)
2. **Validator**: Valida los datos de entrada usando express-validator
3. **Controller**: Extrae datos del request y llama al service
4. **Service**: Ejecuta la lógica de negocio y validaciones adicionales
5. **Repository**: Interactúa con la base de datos usando Sequelize
6. **Response**: El controller envía la respuesta al cliente

### Crear un Nuevo Módulo

1. Crea una carpeta en `src/modules/tu-modulo/`
2. Crea los archivos necesarios:
   - `tu-modulo.controller.js`
   - `tu-modulo.service.js`
   - `tu-modulo.repository.js`
   - `tu-modulo.routes.js`
   - `tu-modulo.validator.js`
   - `tu-modulo.swagger.js` (opcional)
3. Crea el modelo en `src/models/tu-modulo.model.js` (si aplica)
4. Actualiza `src/models/index.js` para inicializar el modelo
5. Importa las rutas en `src/routes/index.js`:

```javascript
// src/routes/index.js
import tuModuloRoutes from '../modules/tu-modulo/tu-modulo.routes.js';

router.use('/tu-modulo', tuModuloRoutes);
```

**💡 Tip**: Puedes usar el módulo `example` como plantilla. Copia `src/modules/example/` y adapta los archivos a tus necesidades.

## 🛠️ Scripts Disponibles

- `npm start` - Inicia el servidor en producción
- `npm run dev` - Inicia el servidor en modo desarrollo con nodemon
- `npm test` - Ejecuta los tests con coverage
- `npm run test:watch` - Ejecuta tests en modo watch
- `npm run lint` - Verifica el código con ESLint
- `npm run lint:fix` - Corrige errores de ESLint automáticamente
- `npm run format` - Formatea el código con Prettier

## 🔧 Configuración

### Variables de Entorno

Ver `.env.example` para todas las variables disponibles. Las principales son:

#### Aplicación
- `APP_NAME` - Nombre de la aplicación (default: "Mordecai API")
- `PORT` - Puerto del servidor (default: 3000)
- `NODE_ENV` - Entorno (development/production)
- `API_VERSION` - Versión de la API (default: "v1")

#### Base de Datos
- `DB_ENABLED` - Habilitar/deshabilitar base de datos (default: true, usar `false` para deshabilitar)
- `DB_NAME` - Nombre de la base de datos
- `DB_USER` - Usuario de PostgreSQL
- `DB_PASSWORD` - Contraseña de PostgreSQL
- `DB_HOST` - Host de PostgreSQL (default: localhost)
- `DB_PORT` - Puerto de PostgreSQL (default: 5432)
- `DB_SSL` - Habilitar conexión SSL (default: false, usar `true` para RDS de AWS u otros servicios que requieran SSL)
- `DB_LOGGING` - Habilitar logs de Sequelize (default: false)
- `DB_SYNC_MODE` - Modo de sincronización: `alter`, `force`, o `false` (default: false)

**⚠️ Importante**: 
- Si no tienes base de datos configurada, puedes deshabilitarla con `DB_ENABLED=false` en tu `.env`. El servidor arrancará normalmente, pero los módulos que requieran base de datos lanzarán un error claro.
- Para bases de datos en la nube (RDS de AWS, etc.) que requieren SSL, agrega `DB_SSL=true` en tu `.env`.

#### CORS y Rate Limiting
- `CORS_ORIGIN` - Orígenes permitidos (default: "*")
- `CORS_CREDENTIALS` - Permitir credenciales (cookies) en peticiones CORS. En producción con frontend en otro dominio debe ser `true`.
- `RATE_LIMIT_WINDOW_MS` - Ventana de tiempo para rate limiting en milisegundos (default: 60000 = 1 minuto)
- `RATE_LIMIT_MAX` - Máximo de requests por ventana (default: 100 = 100 peticiones por minuto)

#### Producción - OAuth (Login con Google/Microsoft)

Cuando frontend y backend están en **dominios distintos** (ej: frontend en Amplify, API en otro host), el login OAuth falla si no se configuran correctamente las cookies y CORS. El usuario queda en `/login` tras autenticarse porque las cookies no se envían en peticiones cross-origin.

**Variables obligatorias en producción (cross-origin):**

| Variable | Valor | Motivo |
|----------|-------|--------|
| `CORS_ORIGIN` | URL exacta del frontend (ej: `https://qa.xxx.amplifyapp.com`) | No usar `*`; con credenciales el navegador exige un origen específico |
| `CORS_CREDENTIALS` | `true` | Sin esto, las cookies no se envían en fetch con `credentials: 'include'` |
| `AUTH_COOKIE_SAMESITE` | `none` | Con `lax` (default) las cookies no se envían en peticiones cross-site |
| `AUTH_COOKIE_SECURE` | `true` | Obligatorio cuando `SameSite=None` |
| `COGNITO_FRONTEND_REDIRECT_URI` | `https://<frontend>/auth/callback` | URL del callback OAuth en el frontend (donde el backend redirige tras el login) |

**Ejemplo `.env` producción:**
```env
CORS_ORIGIN=https://qa.df09u9bgs5ngk.amplifyapp.com
CORS_CREDENTIALS=true
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_SECURE=true
COGNITO_FRONTEND_REDIRECT_URI=https://qa.df09u9bgs5ngk.amplifyapp.com/auth/callback
```

En Cognito, la URL de callback autorizada debe incluir la ruta del **backend** (donde Cognito envía el código), no la del frontend.

### Base de Datos

El proyecto usa **Sequelize** como ORM para PostgreSQL. 

- **Con base de datos**: Configura las variables `DB_*` en tu `.env`
- **Sin base de datos**: Agrega `DB_ENABLED=false` en tu `.env` para desarrollo sin DB

Los modelos se definen en `src/models/` y se inicializan en `src/models/index.js`.

## 📝 API

### Documentación Swagger

En modo desarrollo (`NODE_ENV=development`), la documentación interactiva de la API está disponible en:

- **Swagger UI**: http://localhost:3000/api/v1/docs
- **Swagger JSON**: http://localhost:3000/api/v1/docs.json

La documentación se genera automáticamente desde los archivos `.swagger.js` de cada módulo usando comentarios JSDoc con la sintaxis `@swagger`.

### Endpoints Disponibles

#### Health Checks
- `GET /api/v1/health` - Health check básico
- `GET /api/v1/health/ready` - Readiness probe (verifica DB si está habilitada)
- `GET /api/v1/health/live` - Liveness probe

#### Módulo de Ejemplo
El proyecto incluye un módulo de ejemplo completo en `src/modules/example/` que demuestra cómo implementar un CRUD completo siguiendo la arquitectura modular.

**Endpoints del módulo example:**
- `POST /api/v1/examples` - Crear un nuevo ejemplo
- `GET /api/v1/examples` - Listar ejemplos (con paginación y filtros)
  - Query params: `page`, `perPage`, `name`, `status`
- `GET /api/v1/examples/:id` - Obtener un ejemplo por ID
- `PUT /api/v1/examples/:id` - Actualizar un ejemplo
- `DELETE /api/v1/examples/:id` - Eliminar un ejemplo (soft delete)

Ver `src/modules/example/README.md` para más detalles sobre cómo funciona este módulo y usarlo como plantilla para crear nuevos módulos.

## 🧪 Testing

```bash
npm test
```

## 📦 Dependencias Principales

### Core
- **Express** - Framework web
- **Sequelize** - ORM para PostgreSQL
- **pg** - Driver de PostgreSQL para Node.js

### Utilidades
- **Pino** - Logger estructurado (usar `logger` en lugar de `console.log`)
- **pino-pretty** - Formateo bonito de logs en desarrollo
- **dotenv** - Manejo de variables de entorno

### Documentación
- **swagger-ui-express** - Interfaz de documentación Swagger
- **swagger-jsdoc** - Generación de documentación Swagger desde comentarios JSDoc

### Seguridad y Validación
- **Helmet** - Headers de seguridad HTTP
- **express-rate-limit** - Rate limiting
- **express-validator** - Validación de requests
- **cors** - Configuración CORS

### Desarrollo
- **nodemon** - Auto-reload en desarrollo
- **eslint** - Linter de código
- **prettier** - Formateador de código
- **jest** - Framework de testing

## 🔒 Seguridad

- **Helmet**: Headers de seguridad HTTP configurados
- **Rate Limiting**: Protección contra abuso de API (100 requests/15min por defecto)
- **Validación de Inputs**: express-validator en todos los endpoints
- **Manejo Seguro de Errores**: Sin exponer stack traces en producción
- **CORS**: Configuración de orígenes permitidos

## 📊 Logging

El proyecto usa **Pino** como logger estructurado. **Nunca uses `console.log`**, siempre usa el logger:

```javascript
import { logger } from '../utils/logger.js';

// Niveles disponibles
logger.debug({ data }, 'Información de debugging');
logger.info({ userId: 123 }, 'Operación exitosa');
logger.warn({ id }, 'Advertencia');
logger.error({ error }, 'Error capturado');
logger.fatal({ error }, 'Error fatal');
```

El logger está configurado para:
- **Desarrollo**: Salida formateada y coloreada con `pino-pretty`
- **Producción**: JSON estructurado para análisis con herramientas como ELK, Datadog, etc.

## 🏗️ Arquitectura Detallada

### Capas de la Aplicación

1. **Routes Layer** (`*.routes.js`)
   - Define endpoints y aplica middlewares
   - Conecta URLs con controllers

2. **Controller Layer** (`*.controller.js`)
   - Maneja requests/responses HTTP
   - Extrae datos del request
   - Llama a services
   - Maneja errores y envía respuestas

3. **Service Layer** (`*.service.js`)
   - Lógica de negocio
   - Validaciones de negocio
   - Orquesta llamadas a repositories
   - Transforma datos si es necesario

4. **Repository Layer** (`*.repository.js`)
   - Acceso a base de datos
   - Consultas SQL/Sequelize
   - Abstracción de la persistencia

5. **Model Layer** (`*.model.js`)
   - Definición de modelos Sequelize
   - Relaciones entre modelos
   - Validaciones a nivel de modelo

### Manejo de Errores

El proyecto usa clases de error personalizadas:

- `BadRequestError` (400) - Solicitud inválida
- `UnauthorizedError` (401) - No autenticado
- `ForbiddenError` (403) - Sin permisos
- `NotFoundError` (404) - Recurso no encontrado
- `ConflictError` (409) - Conflicto de estado
- `DatabaseError` (500) - Error de base de datos
- `IntegrationError` (502) - Error de integración externa

Los errores se manejan automáticamente por el middleware de errores y se formatean según el entorno.

## 📚 Recursos Adicionales

- **Módulo de Ejemplo**: `src/modules/example/` - Ejemplo completo de CRUD
- **Documentación Swagger**: http://localhost:3000/api/v1/docs (en desarrollo)
- **Health Checks**: Endpoints para monitoreo y health checks

## 📄 Licencia

ISC
