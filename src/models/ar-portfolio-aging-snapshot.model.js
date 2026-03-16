/**
 * Aging snapshot per portfolio per date (centro de costo).
 */
import { Model, DataTypes } from 'sequelize';

export class ArPortfolioAgingSnapshot extends Model {
  static initModel(sequelize) {
    ArPortfolioAgingSnapshot.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        pmsPortfolioId: { type: DataTypes.UUID, allowNull: false, field: 'pms_portfolio_id', references: { model: 'pms_portfolios', key: 'id' } },
        asOfDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'as_of_date' },
        totalCents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'total_cents' },
        bucket030Cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'bucket_0_30_cents' },
        bucket3160Cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'bucket_31_60_cents' },
        bucket6190Cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'bucket_61_90_cents' },
        bucket90PlusCents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'bucket_90_plus_cents' },
        pastDueTotalCents: { type: DataTypes.BIGINT, defaultValue: 0, field: 'past_due_total_cents' },
        currency: { type: DataTypes.STRING(8), defaultValue: 'USD' },
        meta: { type: DataTypes.JSONB, defaultValue: {} },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
      },
      {
        sequelize,
        modelName: 'ArPortfolioAgingSnapshot',
        tableName: 'ar_portfolio_aging_snapshots',
        timestamps: true,
        createdAt: true,
        updatedAt: false,
        underscored: true,
        indexes: [
          { unique: true, fields: ['pms_portfolio_id', 'as_of_date'], name: 'uq_ar_portfolio_aging_portfolio_as_of' },
        ],
      }
    );
    return ArPortfolioAgingSnapshot;
  }
}
