/**
 * Collections Engine v2 - Strategy container (global rules, limits, time window).
 */
import { Model, DataTypes } from 'sequelize';

export class CollectionStrategy extends Model {
  static initModel(sequelize) {
    CollectionStrategy.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        name: { type: DataTypes.STRING(120), allowNull: false },
        description: { type: DataTypes.TEXT },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
        globalRules: { type: DataTypes.JSONB, defaultValue: {}, field: 'global_rules' },
        maxAttemptsPerWeek: { type: DataTypes.INTEGER, field: 'max_attempts_per_week' },
        cooldownHours: { type: DataTypes.INTEGER, field: 'cooldown_hours' },
        allowedTimeWindow: { type: DataTypes.STRING(64), field: 'allowed_time_window' },
        stopOnPromise: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'stop_on_promise' },
        stopOnPayment: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'stop_on_payment' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'CollectionStrategy', tableName: 'collection_strategies', timestamps: true, underscored: true }
    );
    return CollectionStrategy;
  }
}
