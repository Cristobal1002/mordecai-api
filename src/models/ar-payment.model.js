/**
 * Payments applied; applied_to_charges for ledger.
 */
import { Model, DataTypes } from 'sequelize';

export class ArPayment extends Model {
  static initModel(sequelize) {
    ArPayment.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        pmsLeaseId: { type: DataTypes.UUID, allowNull: true, field: 'pms_lease_id', references: { model: 'pms_leases', key: 'id' } },
        externalId: { type: DataTypes.STRING(256), allowNull: false, field: 'external_id' },
        amountCents: { type: DataTypes.BIGINT, allowNull: false, field: 'amount_cents' },
        currency: { type: DataTypes.STRING(8), defaultValue: 'USD' },
        paidAt: { type: DataTypes.DATE, allowNull: false, field: 'paid_at' },
        paymentMethod: { type: DataTypes.STRING(64), field: 'payment_method' },
        appliedToCharges: { type: DataTypes.JSONB, defaultValue: [], field: 'applied_to_charges' },
        lastExternalUpdatedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_external_updated_at' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'ArPayment', tableName: 'ar_payments', timestamps: true, underscored: true }
    );
    return ArPayment;
  }
}
