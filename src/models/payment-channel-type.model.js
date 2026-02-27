/**
 * PaymentChannelType - Catalog of payment channel types (link, transfer, zelle, cash, stripe, etc.)
 * config_schema defines the dynamic form fields for tenant configuration.
 */
import { Model, DataTypes } from 'sequelize';

export class PaymentChannelType extends Model {
  static initModel(sequelize) {
    PaymentChannelType.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        label: { type: DataTypes.STRING(120), allowNull: false },
        requiresReconciliation: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'requires_reconciliation' },
        sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
        configSchema: { type: DataTypes.JSONB, defaultValue: { fields: [] }, field: 'config_schema' },
        isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_enabled' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'PaymentChannelType',
        tableName: 'payment_channel_types',
        timestamps: true,
        underscored: true,
      }
    );
    return PaymentChannelType;
  }
}
