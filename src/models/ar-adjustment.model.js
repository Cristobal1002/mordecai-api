/**
 * Credits, write-offs, adjustments.
 */
import { Model, DataTypes } from 'sequelize';

export class ArAdjustment extends Model {
  static initModel(sequelize) {
    ArAdjustment.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        pmsLeaseId: { type: DataTypes.UUID, allowNull: true, field: 'pms_lease_id', references: { model: 'pms_leases', key: 'id' } },
        externalId: { type: DataTypes.STRING(256), field: 'external_id' },
        adjustmentType: { type: DataTypes.STRING(64), field: 'adjustment_type' },
        amountCents: { type: DataTypes.BIGINT, allowNull: false, field: 'amount_cents' },
        currency: { type: DataTypes.STRING(8), defaultValue: 'USD' },
        appliedAt: { type: DataTypes.DATE, field: 'applied_at' },
        description: { type: DataTypes.TEXT },
        lastExternalUpdatedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_external_updated_at' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'ArAdjustment', tableName: 'ar_adjustments', timestamps: true, underscored: true }
    );
    return ArAdjustment;
  }
}
