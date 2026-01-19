/**
 * Modelo de ejemplo para el módulo Example
 * Este es un modelo simple que puedes usar como referencia
 */
import { Model, DataTypes } from 'sequelize';

export class Example extends Model {
  static initModel(sequelize) {
    Example.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('active', 'inactive'),
          defaultValue: 'active',
        },
        isDelete: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
      },
      {
        sequelize,
        modelName: 'Example',
        tableName: 'examples',
        timestamps: true,
      }
    );

    return Example;
  }
}

