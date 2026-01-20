/**
 * Modelo ImportBatch - Auditoría de importación XLSX
 */
import { Model, DataTypes } from 'sequelize';

export class ImportBatch extends Model {
  static initModel(sequelize) {
    ImportBatch.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        tenantId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'tenant_id',
          references: {
            model: 'tenants',
            key: 'id',
          },
        },
        source: {
          type: DataTypes.ENUM('XLSX', 'ERP'),
          defaultValue: 'XLSX',
        },
        fileKey: {
          type: DataTypes.STRING(512),
          allowNull: true,
          field: 'file_key',
        },
        status: {
          type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
          defaultValue: 'PENDING',
        },
        totalRows: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          field: 'total_rows',
        },
        successRows: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          field: 'success_rows',
        },
        errorRows: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          field: 'error_rows',
        },
        errors: {
          type: DataTypes.JSONB,
          defaultValue: [],
        },
        processedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'processed_at',
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
        modelName: 'ImportBatch',
        tableName: 'import_batches',
        timestamps: true,
        underscored: true,
        indexes: [
          {
            fields: ['tenant_id', 'created_at'],
          },
        ],
      }
    );

    return ImportBatch;
  }
}

