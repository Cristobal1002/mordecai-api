/**
 * Consolidated balance per lease (snapshot per as_of_date).
 */
import { Model, DataTypes } from 'sequelize';

export class ArBalance extends Model {
  static initModel(sequelize) {
    ArBalance.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        pmsLeaseId: { type: DataTypes.UUID, allowNull: false, field: 'pms_lease_id', references: { model: 'pms_leases', key: 'id' } },
        balanceCents: { type: DataTypes.BIGINT, allowNull: false, field: 'balance_cents' },
        currency: { type: DataTypes.STRING(8), defaultValue: 'USD' },
        asOfDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'as_of_date' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'ArBalance',
        tableName: 'ar_balances',
        timestamps: true,
        underscored: true,
        indexes: [
          { unique: true, fields: ['pms_lease_id', 'as_of_date'], name: 'uq_ar_balances_lease_as_of_date' },
        ],
      }
    );
    return ArBalance;
  }
}
