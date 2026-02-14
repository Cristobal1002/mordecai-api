/**
 * Modelo PmsConnection - Conexión por tenant a un software
 * Estado (draft|connected|syncing|error|disabled), credenciales, last sync, last error.
 */
import { Model, DataTypes } from 'sequelize';

export class PmsConnection extends Model {
  static initModel(sequelize) {
    PmsConnection.init(
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
        softwareId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'software_id',
          references: {
            model: 'softwares',
            key: 'id',
          },
        },
        status: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'draft',
        },
        credentials: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        externalAccountId: {
          type: DataTypes.STRING(256),
          allowNull: true,
          field: 'external_account_id',
        },
        capabilities: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        lastSyncedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'last_synced_at',
        },
        lastError: {
          type: DataTypes.JSONB,
          allowNull: true,
          field: 'last_error',
        },
        syncState: {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: {},
          field: 'sync_state',
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
        modelName: 'PmsConnection',
        tableName: 'pms_connections',
        timestamps: true,
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ['tenant_id', 'software_id'],
          },
          { fields: ['tenant_id'] },
          { fields: ['software_id'] },
          { fields: ['status'] },
        ],
      }
    );

    return PmsConnection;
  }
}
