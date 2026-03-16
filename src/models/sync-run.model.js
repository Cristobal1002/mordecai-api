/**
 * History of sync jobs per connection; metrics, errors, step.
 */
import { Model, DataTypes } from 'sequelize';

export class SyncRun extends Model {
  static initModel(sequelize) {
    SyncRun.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
        trigger: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'manual', field: 'trigger' },
        idempotencyKey: { type: DataTypes.STRING(256), allowNull: true, field: 'idempotency_key' },
        triggeredAt: { type: DataTypes.DATE, allowNull: false, field: 'triggered_at' },
        startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
        finishedAt: { type: DataTypes.DATE, allowNull: true, field: 'finished_at' },
        step: { type: DataTypes.STRING(64) },
        stats: { type: DataTypes.JSONB, defaultValue: {} },
        errorMessage: { type: DataTypes.TEXT, field: 'error_message' },
        errorDetails: { type: DataTypes.JSONB, field: 'error_details' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'SyncRun', tableName: 'sync_runs', timestamps: true, underscored: true }
    );
    return SyncRun;
  }
}
