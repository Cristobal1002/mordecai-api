/**
 * Public discovery wizard submissions (no tenant FK).
 */
import { Model, DataTypes } from 'sequelize';

export class DiscoverySession extends Model {
  static initModel(sequelize) {
    DiscoverySession.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        clientSessionId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          field: 'client_session_id',
        },
        answers: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        currentStepIndex: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: -1,
          field: 'current_step_index',
        },
        completedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'completed_at',
        },
        ipAddress: {
          type: DataTypes.STRING(45),
          allowNull: true,
          field: 'ip_address',
        },
        userAgent: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: 'user_agent',
        },
        createdAt: {
          type: DataTypes.DATE,
          field: 'created_at',
        },
        updatedAt: {
          type: DataTypes.DATE,
          field: 'updated_at',
        },
      },
      {
        sequelize,
        modelName: 'DiscoverySession',
        tableName: 'discovery_sessions',
        timestamps: true,
        underscored: true,
      }
    );
    return DiscoverySession;
  }
}
