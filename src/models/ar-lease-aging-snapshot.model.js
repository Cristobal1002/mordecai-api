/**
 * Aging snapshot per lease per date (for transition matrix).
 */
import { Model, DataTypes } from 'sequelize';

export class ArLeaseAgingSnapshot extends Model {
  static initModel(sequelize) {
    ArLeaseAgingSnapshot.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        pmsLeaseId: { type: DataTypes.UUID, allowNull: false, field: 'pms_lease_id', references: { model: 'pms_leases', key: 'id' } },
        asOfDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'as_of_date' },
        balanceCents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'balance_cents' },
        pastDueCents: { type: DataTypes.BIGINT, defaultValue: 0, field: 'past_due_cents' },
        bucketLabel: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'current', field: 'bucket_label' },
        daysPastDue: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'days_past_due' },
        meta: { type: DataTypes.JSONB, defaultValue: {} },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
      },
      {
        sequelize,
        modelName: 'ArLeaseAgingSnapshot',
        tableName: 'ar_lease_aging_snapshots',
        timestamps: true,
        createdAt: true,
        updatedAt: false,
        underscored: true,
        indexes: [
          { unique: true, fields: ['pms_lease_id', 'as_of_date'], name: 'uq_ar_lease_aging_lease_as_of' },
        ],
      }
    );
    return ArLeaseAgingSnapshot;
  }
}
