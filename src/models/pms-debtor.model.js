/**
 * Debtors (person/company) synced from PMS; contact and preference flags.
 */
import { Model, DataTypes } from 'sequelize';

export class PmsDebtor extends Model {
  static initModel(sequelize) {
    PmsDebtor.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        externalId: { type: DataTypes.STRING(256), allowNull: false, field: 'external_id' },
        displayName: { type: DataTypes.STRING(256), allowNull: false, field: 'display_name' },
        type: { type: DataTypes.STRING(32), defaultValue: 'person' },
        email: { type: DataTypes.STRING(256) },
        phone: { type: DataTypes.STRING(64) },
        address: { type: DataTypes.JSONB, defaultValue: {} },
        language: { type: DataTypes.STRING(16) },
        timezone: { type: DataTypes.STRING(64) },
        doNotContact: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'do_not_contact' },
        doNotCall: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'do_not_call' },
        meta: { type: DataTypes.JSONB, defaultValue: {} },
        lastExternalUpdatedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_external_updated_at' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'PmsDebtor',
        tableName: 'pms_debtors',
        timestamps: true,
        underscored: true,
        indexes: [
          { unique: true, fields: ['pms_connection_id', 'external_id'], name: 'uq_pms_debtors_connection_external' },
        ],
      }
    );
    return PmsDebtor;
  }
}
