/**
 * Collections Engine v2 - Activity log for automations (scheduled, sent, failed, answered, promise, etc.).
 */
import { Model, DataTypes } from 'sequelize';

export class CollectionEvent extends Model {
  static initModel(sequelize) {
    CollectionEvent.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        automationId: { type: DataTypes.UUID, allowNull: false, field: 'automation_id', references: { model: 'collection_automations', key: 'id' } },
        debtCaseId: { type: DataTypes.UUID, field: 'debt_case_id', references: { model: 'debt_cases', key: 'id' } },
        channel: { type: DataTypes.STRING(32), field: 'channel' },
        eventType: { type: DataTypes.STRING(64), allowNull: false, field: 'event_type' },
        payload: { type: DataTypes.JSONB, defaultValue: {}, field: 'payload' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
      },
      { sequelize, modelName: 'CollectionEvent', tableName: 'collection_events', timestamps: true, updatedAt: false, underscored: true }
    );
    return CollectionEvent;
  }
}
