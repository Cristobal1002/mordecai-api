/**
 * TenantMessageAttachment - Reusable attachments (eviction letters, notices) per tenant
 */
import { Model, DataTypes } from 'sequelize';

export class TenantMessageAttachment extends Model {
  static initModel(sequelize) {
    TenantMessageAttachment.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        name: { type: DataTypes.STRING(120), allowNull: false },
        type: { type: DataTypes.STRING(40), defaultValue: 'custom' },
        fileKey: { type: DataTypes.STRING(512), allowNull: false, field: 'file_key' },
        minDaysPastDue: { type: DataTypes.INTEGER, field: 'min_days_past_due' },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'TenantMessageAttachment',
        tableName: 'tenant_message_attachments',
        timestamps: true,
        underscored: true,
      }
    );
    return TenantMessageAttachment;
  }
}
