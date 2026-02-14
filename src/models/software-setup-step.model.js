/**
 * Modelo SoftwareSetupStep - Pasos del wizard de configuración por software
 * Orden, título, body (markdown), type (info|copy|link|warning|check), copyValue, linkUrl, mediaUrl, meta.
 */
import { Model, DataTypes } from 'sequelize';

export class SoftwareSetupStep extends Model {
  static initModel(sequelize) {
    SoftwareSetupStep.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        softwareId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'software_id',
          references: {
            model: 'softwares',
            key: 'id',
          },
        },
        order: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'order',
        },
        title: {
          type: DataTypes.STRING(256),
          allowNull: false,
        },
        body: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        type: {
          type: DataTypes.STRING(32),
          allowNull: false,
        },
        copyValue: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: 'copy_value',
        },
        linkUrl: {
          type: DataTypes.STRING(512),
          allowNull: true,
          field: 'link_url',
        },
        mediaUrl: {
          type: DataTypes.STRING(512),
          allowNull: true,
          field: 'media_url',
        },
        meta: {
          type: DataTypes.JSONB,
          allowNull: true,
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
        modelName: 'SoftwareSetupStep',
        tableName: 'software_setup_steps',
        timestamps: true,
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ['software_id', 'order'],
          },
          {
            fields: ['software_id'],
          },
        ],
      }
    );

    return SoftwareSetupStep;
  }
}
