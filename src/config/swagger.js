import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GET http://localhost:{PORT}/api/{VERSION}/docs
export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mordecai API',
      version: config.app.apiVersion || 'v1',
      description: 'Documentación de la API de Mordecai',
    },
    servers: [
      {
        url: `http://localhost:${config.app.port}/api/${config.app.apiVersion}`,
        description: 'Servidor local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 400 },
            success: { type: 'boolean', example: false },
            message: { type: 'object' },
            data: { type: 'object' },
            error: { type: 'string' },
          },
        },
        ErrorUnauthorizedResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 401 },
            success: { type: 'boolean', example: false },
            message: { type: 'object', example: 'Token is invalid or expired' },
            data: { type: 'object' },
            error: { type: 'string' },
          },
        },
        ErrorNotFoundResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 404 },
            success: { type: 'boolean', example: false },
            message: { type: 'object', example: 'Not found' },
            data: { type: 'object' },
            error: { type: 'string', example: 'Resource not found' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total_results: { type: 'integer', example: 42 },
            total_pages: { type: 'integer', example: 5 },
            current_page: { type: 'integer', example: 1 },
            per_page: { type: 'integer', example: 10 },
          },
        },
        Example: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Ejemplo de prueba' },
            description: { type: 'string', nullable: true, example: 'Esta es una descripción' },
            status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
            isDelete: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: [
    // Rutas principales
    path.resolve(__dirname, '../routes/*.js'),
    // Módulos - archivos swagger y routes
    path.resolve(__dirname, '../modules/**/*.swagger.js'),
    path.resolve(__dirname, '../modules/**/*.routes.js'),
  ],
};

