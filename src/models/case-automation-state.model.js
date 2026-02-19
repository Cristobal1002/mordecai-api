/**
 * Collections Engine v2 - Per-case state when case is in an automation.
 */
import { Model, DataTypes } from 'sequelize';

export class CaseAutomationState extends Model {
  static initModel(sequelize) {
    CaseAutomationState.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        debtCaseId: { type: DataTypes.UUID, allowNull: false, field: 'debt_case_id', references: { model: 'debt_cases', key: 'id' } },
        automationId: { type: DataTypes.UUID, allowNull: false, field: 'automation_id', references: { model: 'collection_automations', key: 'id' } },
        strategyId: { type: DataTypes.UUID, allowNull: false, field: 'strategy_id', references: { model: 'collection_strategies', key: 'id' } },
        currentStageId: { type: DataTypes.UUID, field: 'current_stage_id', references: { model: 'collection_stages', key: 'id' } },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'active' },
        nextActionAt: { type: DataTypes.DATE, field: 'next_action_at' },
        lastAttemptAt: { type: DataTypes.DATE, field: 'last_attempt_at' },
        attemptsWeekCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'attempts_week_count' },
        promiseDueDate: { type: DataTypes.DATEONLY, field: 'promise_due_date' },
        lastOutcome: { type: DataTypes.STRING(64), field: 'last_outcome' },
        lastOutcomeAt: { type: DataTypes.DATE, field: 'last_outcome_at' },
        meta: { type: DataTypes.JSONB, defaultValue: {}, field: 'meta' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'CaseAutomationState',
        tableName: 'case_automation_state',
        timestamps: true,
        underscored: true,
        indexes: [{ unique: true, fields: ['debt_case_id', 'automation_id'], name: 'uq_case_automation_state_case_automation' }],
      }
    );
    return CaseAutomationState;
  }
}
