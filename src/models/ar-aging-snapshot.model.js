/**
 * Aging snapshot per connection per date (total + buckets 0-30, 31-60, 61-90, 90+).
 */
import { Model, DataTypes } from 'sequelize';

export class ArAgingSnapshot extends Model {
  static initModel(sequelize) {
    ArAgingSnapshot.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        asOfDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'as_of_date' },
        totalCents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'total_cents' },
        bucket030Cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'bucket_0_30_cents' },
        bucket3160Cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'bucket_31_60_cents' },
        bucket6190Cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'bucket_61_90_cents' },
        bucket90PlusCents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'bucket_90_plus_cents' },
        currency: { type: DataTypes.STRING(8), defaultValue: 'USD' },
        meta: { type: DataTypes.JSONB, defaultValue: {} },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
      },
      {
        sequelize,
        modelName: 'ArAgingSnapshot',
        tableName: 'ar_aging_snapshots',
        timestamps: true,
        createdAt: true,
        updatedAt: false,
        underscored: true,
        indexes: [
          { unique: true, fields: ['pms_connection_id', 'as_of_date'], name: 'uq_ar_aging_snapshots_connection_date' },
        ],
      }
    );
    return ArAgingSnapshot;
  }
}
