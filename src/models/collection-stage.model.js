/**
 * Collections Engine v2 - Stage = range of days_past_due within a strategy (replaces FlowPolicy per-strategy).
 */
import { Model, DataTypes } from 'sequelize';

export class CollectionStage extends Model {
  static initModel(sequelize) {
    CollectionStage.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        strategyId: { type: DataTypes.UUID, allowNull: false, field: 'strategy_id', references: { model: 'collection_strategies', key: 'id' } },
        name: { type: DataTypes.STRING(120), allowNull: false },
        minDaysPastDue: { type: DataTypes.INTEGER, allowNull: false, field: 'min_days_past_due' },
        maxDaysPastDue: { type: DataTypes.INTEGER, field: 'max_days_past_due' },
        channels: { type: DataTypes.JSONB, defaultValue: {} },
        tone: { type: DataTypes.STRING(40), defaultValue: 'professional' },
        rules: { type: DataTypes.JSONB, defaultValue: {} },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'CollectionStage', tableName: 'collection_stages', timestamps: true, underscored: true }
    );
    return CollectionStage;
  }
}
