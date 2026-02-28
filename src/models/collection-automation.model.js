/**
 * Collections Engine v2 - A strategy running continuously on a PMS connection.
 */
import { Model, DataTypes } from 'sequelize';

export class CollectionAutomation extends Model {
  static initModel(sequelize) {
    CollectionAutomation.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        strategyId: { type: DataTypes.UUID, allowNull: false, field: 'strategy_id', references: { model: 'collection_strategies', key: 'id' } },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'active' },
        startedAt: { type: DataTypes.DATE, field: 'started_at' },
        pausedAt: { type: DataTypes.DATE, field: 'paused_at' },
        lastEvaluatedAt: { type: DataTypes.DATE, field: 'last_evaluated_at' },
        nextTickAt: { type: DataTypes.DATE, field: 'next_tick_at' },
        stats: { type: DataTypes.JSONB, defaultValue: {}, field: 'stats' },
        approvalMode: { type: DataTypes.STRING(32), defaultValue: 'AUTO', field: 'approval_mode' },
        approvalRules: { type: DataTypes.JSONB, defaultValue: {}, field: 'approval_rules' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'CollectionAutomation', tableName: 'collection_automations', timestamps: true, underscored: true }
    );
    return CollectionAutomation;
  }
}
