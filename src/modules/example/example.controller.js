/**
 * Controller - Capa de controladores HTTP
 * 
 * Este archivo maneja las peticiones HTTP y respuestas.
 * Aquí se extraen los datos del request y se llama al service.
 */
import { exampleService } from './example.service.js';

const create = async (req, res, next) => {
  try {
    const example = await exampleService.create(req.body);
    return res.created(example, 'Example created successfully');
  } catch (error) {
    return next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const result = await exampleService.list(req.query);
    // result = { items, meta }
    return res.ok(result, 'Examples retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const example = await exampleService.getById(req.params.id);
    return res.ok(example, 'Example retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const example = await exampleService.update(req.params.id, req.body);
    return res.ok(example, 'Example updated successfully');
  } catch (error) {
    return next(error);
  }
};

const softDelete = async (req, res, next) => {
  try {
    await exampleService.softDelete(req.params.id);
    return res.ok({}, 'Example deleted successfully');
  } catch (error) {
    return next(error);
  }
};

export const exampleController = {
  create,
  list,
  getById,
  update,
  softDelete,
};

