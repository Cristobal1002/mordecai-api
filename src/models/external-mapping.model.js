/**
 * Maps PMS external IDs to our internal IDs for deduplication and upsert.
 */
import { Model, DataTypes } from 'sequelize';

export class ExternalMapping extends Model {
  static initModel(sequelize) {
    ExternalMapping.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        entityType: { type: DataTypes.STRING(64), allowNull: false, field: 'entity_type' },
        externalId: { type: DataTypes.STRING(256), allowNull: false, field: 'external_id' },
        internalEntityType: { type: DataTypes.STRING(64), allowNull: false, field: 'internal_entity_type' },
        internalId: { type: DataTypes.UUID, allowNull: false, field: 'internal_id' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'ExternalMapping', tableName: 'external_mappings', timestamps: true, updatedAt: 'updatedAt', createdAt: false, underscored: true }
    );
    return ExternalMapping;
  }
}
