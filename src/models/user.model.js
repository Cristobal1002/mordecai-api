/**
 * Modelo User - Auth users (global identity)
 */
import { Model, DataTypes } from 'sequelize';

export class User extends Model {
  static initModel(sequelize) {
    User.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        cognitoSub: {
          type: DataTypes.STRING(160),
          allowNull: false,
          unique: true,
          field: 'cognito_sub',
        },
        email: {
          type: DataTypes.STRING(160),
          allowNull: false,
        },
        fullName: {
          type: DataTypes.STRING(160),
          allowNull: true,
          field: 'full_name',
        },
        phone: {
          type: DataTypes.STRING(40),
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('pending', 'active', 'disabled'),
          allowNull: false,
          defaultValue: 'pending',
        },
        lastLoginAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'last_login_at',
        },
        createdAt: {
          type: DataTypes.DATE,
          field: 'created_at',
        },
        updatedAt: {
          type: DataTypes.DATE,
          field: 'updated_at',
        },
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ['cognito_sub'] },
          { fields: ['email'] },
        ],
      }
    );

    return User;
  }
}
