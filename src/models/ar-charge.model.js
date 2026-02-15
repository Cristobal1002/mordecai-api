/**
 * Charges/invoices from PMS with due date for aging.
 */
import { Model, DataTypes } from 'sequelize';

export class ArCharge extends Model {
  static initModel(sequelize) {
    ArCharge.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        pmsLeaseId: { type: DataTypes.UUID, allowNull: false, field: 'pms_lease_id', references: { model: 'pms_leases', key: 'id' } },
        externalId: { type: DataTypes.STRING(256), allowNull: false, field: 'external_id' },
        chargeType: { type: DataTypes.STRING(64), field: 'charge_type' },
        amountCents: { type: DataTypes.BIGINT, allowNull: false, field: 'amount_cents' },
        openAmountCents: { type: DataTypes.BIGINT, allowNull: true, field: 'open_amount_cents' },
        currency: { type: DataTypes.STRING(8), defaultValue: 'USD' },
        dueDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'due_date' },
        postDate: { type: DataTypes.DATEONLY, field: 'post_date' },
        description: { type: DataTypes.TEXT },
        lastExternalUpdatedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_external_updated_at' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'ArCharge',
        tableName: 'ar_charges',
        timestamps: true,
        underscored: true,
        indexes: [
          { unique: true, fields: ['pms_connection_id', 'external_id'], name: 'uq_ar_charges_connection_external' },
        ],
      }
    );
    return ArCharge;
  }
}
