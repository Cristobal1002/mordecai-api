/**
 * Units (apt/unit) from PMS.
 */
import { Model, DataTypes } from 'sequelize';

export class PmsUnit extends Model {
  static initModel(sequelize) {
    PmsUnit.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        pmsPropertyId: { type: DataTypes.UUID, allowNull: true, field: 'pms_property_id', references: { model: 'pms_properties', key: 'id' } },
        externalId: { type: DataTypes.STRING(256), allowNull: false, field: 'external_id' },
        unitNumber: { type: DataTypes.STRING(64), field: 'unit_number' },
        rentCents: { type: DataTypes.BIGINT, allowNull: true, field: 'rent_cents' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'PmsUnit', tableName: 'pms_units', timestamps: true, underscored: true }
    );
    return PmsUnit;
  }
}
