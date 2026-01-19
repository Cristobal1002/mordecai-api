/**
 * Inicializa todos los modelos de Sequelize y sus relaciones
 * @param {Sequelize} sequelize - Instancia de Sequelize
 */
import { Example } from './example.model.js';

export const initModels = (sequelize) => {
  // Inicializar modelos
  Example.initModel(sequelize);

  // Definir relaciones aquí cuando tengas múltiples modelos
  // Ejemplo:
  // Company.hasMany(Example, { foreignKey: 'companyId' });
  // Example.belongsTo(Company, { foreignKey: 'companyId' });
};

