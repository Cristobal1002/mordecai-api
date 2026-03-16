/**
 * Modelo Software - Lista de softwares disponibles (Buildium, Rentvine, etc.)
 * Auth type, capabilities, logo, docs, enabled.
 */
import { Model, DataTypes } from 'sequelize';

export class Software extends Model {
  static initModel(sequelize) {
    Software.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        key: {
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true,
        },
        name: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        category: {
          type: DataTypes.STRING(64),
          allowNull: false,
        },
        authType: {
          type: DataTypes.STRING(32),
          allowNull: false,
          field: 'auth_type',
        },
        authConfig: {
          type: DataTypes.JSONB,
          defaultValue: {},
          field: 'auth_config',
        },
        capabilities: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        logoUrl: {
          type: DataTypes.STRING(512),
          allowNull: true,
          field: 'logo_url',
        },
        docsUrl: {
          type: DataTypes.STRING(512),
          allowNull: true,
          field: 'docs_url',
        },
        isEnabled: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          field: 'is_enabled',
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
        modelName: 'Software',
        tableName: 'softwares',
        timestamps: true,
        underscored: true,
        indexes: [
          { unique: true, fields: ['key'] },
          { fields: ['category'] },
          { fields: ['is_enabled'] },
        ],
      }
    );

    return Software;
  }
}
