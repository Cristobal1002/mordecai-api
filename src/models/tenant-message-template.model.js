/**
 * TenantMessageTemplate - Reusable SMS/Email templates per tenant
 */
import { Model, DataTypes } from 'sequelize';

export class TenantMessageTemplate extends Model {
  static initModel(sequelize) {
    TenantMessageTemplate.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        channel: { type: DataTypes.STRING(20), allowNull: false },
        name: { type: DataTypes.STRING(120), allowNull: false },
        subject: { type: DataTypes.STRING(500), field: 'subject' },
        bodyText: { type: DataTypes.TEXT, allowNull: false, field: 'body_text' },
        bodyHtml: { type: DataTypes.TEXT, field: 'body_html' },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'TenantMessageTemplate',
        tableName: 'tenant_message_templates',
        timestamps: true,
        underscored: true,
      }
    );
    return TenantMessageTemplate;
  }
}
