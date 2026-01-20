/**
 * Modelo Debtor - Deudores/Cartera
 */
import { Model, DataTypes } from 'sequelize';

export class Debtor extends Model {
  static initModel(sequelize) {
    Debtor.init(
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
        externalRef: {
          type: DataTypes.STRING(128),
          allowNull: true,
          field: 'external_ref',
        },
        fullName: {
          type: DataTypes.STRING(160),
          allowNull: false,
          field: 'full_name',
        },
        email: {
          type: DataTypes.STRING(160),
          allowNull: true,
        },
        phone: {
          type: DataTypes.STRING(40),
          allowNull: true,
        },
        metadata: {
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
        modelName: 'Debtor',
        tableName: 'debtors',
        timestamps: true,
        underscored: true,
        indexes: [
          {
            fields: ['tenant_id', 'email'],
          },
          {
            fields: ['tenant_id', 'phone'],
          },
          {
            fields: ['tenant_id', 'external_ref'],
          },
        ],
      }
    );

    return Debtor;
  }
}

