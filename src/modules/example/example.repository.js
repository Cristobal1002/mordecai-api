/**
 * Repository - Capa de acceso a datos
 * 
 * Este archivo maneja todas las operaciones con la base de datos.
 * Aquí se definen las consultas SQL/Sequelize específicas.
 */
import { Op } from 'sequelize';
import { sequelize } from '../../config/database.js';

class ExampleRepository {
  /**
   * Obtiene el modelo Example desde sequelize.models
   */
  _getModel() {
    if (!sequelize || !sequelize.models || !sequelize.models.Example) {
      throw new Error('Example model is not initialized. Make sure the database is enabled and connected.');
    }
    return sequelize.models.Example;
  }

  /**
   * Crea un nuevo registro
   */
  async create(data) {
    const Example = this._getModel();
    return Example.create(data);
  }

  /**
   * Busca un registro por ID
   */
  async findById(id) {
    const Example = this._getModel();
    return Example.findOne({
      where: { id, isDelete: false },
    });
  }

  /**
   * Busca todos los registros con paginación y filtros
   */
  async findAllPaginated(filters, { limit, offset }) {
    const Example = this._getModel();
    const where = { isDelete: false };

    // Aplicar filtros
    if (filters.name) {
      where.name = { [Op.iLike]: `%${filters.name}%` };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const result = await Example.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return result; // { rows, count }
  }

  /**
   * Actualiza un registro
   */
  async update(id, data) {
    const Example = this._getModel();
    return Example.update(data, {
      where: { id, isDelete: false },
    });
  }

  /**
   * Eliminación lógica (soft delete)
   */
  async softDelete(id) {
    const Example = this._getModel();
    return Example.update(
      { isDelete: true, status: 'inactive' },
      { where: { id } }
    );
  }
}

export const exampleRepository = new ExampleRepository();

