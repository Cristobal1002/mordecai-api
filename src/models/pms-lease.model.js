/**
 * Leases/contracts; move-in/out, status, last note summary, in_collections.
 */
import { Model, DataTypes } from 'sequelize';

export class PmsLease extends Model {
  static initModel(sequelize) {
    PmsLease.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        pmsDebtorId: { type: DataTypes.UUID, allowNull: false, field: 'pms_debtor_id', references: { model: 'pms_debtors', key: 'id' } },
        pmsPropertyId: { type: DataTypes.UUID, allowNull: true, field: 'pms_property_id', references: { model: 'pms_properties', key: 'id' } },
        pmsUnitId: { type: DataTypes.UUID, allowNull: true, field: 'pms_unit_id', references: { model: 'pms_units', key: 'id' } },
        externalId: { type: DataTypes.STRING(256), allowNull: false, field: 'external_id' },
        leaseNumber: { type: DataTypes.STRING(64), field: 'lease_number' },
        status: { type: DataTypes.STRING(32), defaultValue: 'active' },
        moveInDate: { type: DataTypes.DATEONLY, field: 'move_in_date' },
        moveOutDate: { type: DataTypes.DATEONLY, field: 'move_out_date' },
        lastNoteSummary: { type: DataTypes.TEXT, field: 'last_note_summary' },
        inCollections: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'in_collections' },
        lastExternalUpdatedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_external_updated_at' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'PmsLease',
        tableName: 'pms_leases',
        timestamps: true,
        underscored: true,
        indexes: [
          { unique: true, fields: ['pms_connection_id', 'external_id'], name: 'uq_pms_leases_connection_external' },
        ],
      }
    );
    return PmsLease;
  }
}
