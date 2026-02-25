/**
 * TenantPaymentChannel - Payment channel catalog per tenant (link, transfer, zelle, cash)
 */
import { Model, DataTypes } from 'sequelize';

export class TenantPaymentChannel extends Model {
  static initModel(sequelize) {
    TenantPaymentChannel.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        code: { type: DataTypes.STRING(40), allowNull: false },
        label: { type: DataTypes.STRING(120), allowNull: false },
        requiresReconciliation: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'requires_reconciliation' },
        instructionsTemplate: { type: DataTypes.TEXT, field: 'instructions_template' },
        sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'TenantPaymentChannel',
        tableName: 'tenant_payment_channels',
        timestamps: true,
        underscored: true,
      }
    );
    return TenantPaymentChannel;
  }
}
