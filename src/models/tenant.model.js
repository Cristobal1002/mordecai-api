/**
 * Modelo Tenant - Multi-tenant core
 */
import { Model, DataTypes } from 'sequelize';

export class Tenant extends Model {
  static initModel(sequelize) {
    Tenant.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        timezone: {
          type: DataTypes.STRING(64),
          defaultValue: 'America/New_York',
        },
        status: {
          type: DataTypes.ENUM('active', 'inactive'),
          defaultValue: 'active',
        },
        settings: {
          type: DataTypes.JSONB,
          defaultValue: {},
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
        modelName: 'Tenant',
        tableName: 'tenants',
        timestamps: true,
        underscored: true,
      }
    );

    return Tenant;
  }
}

