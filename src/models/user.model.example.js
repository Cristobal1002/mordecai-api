/**
 * EJEMPLO DE MODELO - Puedes eliminar este archivo cuando crees tus modelos reales
 * 
 * Este es un ejemplo de cómo crear un modelo de Sequelize usando el patrón
 * que ya tienes establecido. Cuando crees tus modelos, sigue este patrón
 * y luego impórtalos en models/index.js
 */

import { Model, DataTypes } from 'sequelize';

export class User extends Model {
  static initModel(sequelize) {
    User.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        firebaseUid: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        role: {
          type: DataTypes.ENUM('owner', 'admin', 'member'),
          defaultValue: 'member',
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
      }
    );

    return User;
  }
}

