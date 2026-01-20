/**
 * Modelo InteractionLog - Registro de contacto omnicanal
 */
import { Model, DataTypes } from 'sequelize';

export class InteractionLog extends Model {
  static initModel(sequelize) {
    InteractionLog.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        tenantId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'tenant_id',
          references: {
            model: 'tenants',
            key: 'id',
          },
        },
        debtCaseId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'debt_case_id',
          references: {
            model: 'debt_cases',
            key: 'id',
          },
        },
        debtorId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'debtor_id',
          references: {
            model: 'debtors',
            key: 'id',
          },
        },
        type: {
          type: DataTypes.ENUM('CALL', 'SMS', 'EMAIL'),
          allowNull: false,
        },
        direction: {
          type: DataTypes.ENUM('OUTBOUND', 'INBOUND'),
          defaultValue: 'OUTBOUND',
        },
        channelProvider: {
          type: DataTypes.STRING(60),
          allowNull: true,
          field: 'channel_provider',
        },
        providerRef: {
          type: DataTypes.STRING(160),
          allowNull: true,
          field: 'provider_ref',
        },
        status: {
          type: DataTypes.STRING(40),
          defaultValue: 'queued',
        },
        outcome: {
          type: DataTypes.ENUM(
            'CONNECTED',
            'NO_ANSWER',
            'VOICEMAIL',
            'FAILED',
            'PROMISE_TO_PAY',
            'PAYMENT_PLAN',
            'PAID',
            'REFUSED',
            'CALLBACK_REQUESTED'
          ),
          allowNull: true,
        },
        startedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'started_at',
        },
        endedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'ended_at',
        },
        transcript: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        summary: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        aiData: {
          type: DataTypes.JSONB,
          defaultValue: {},
          field: 'ai_data',
        },
        error: {
          type: DataTypes.JSONB,
          defaultValue: {},
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
        modelName: 'InteractionLog',
        tableName: 'interaction_logs',
        timestamps: true,
        underscored: true,
        indexes: [
          {
            fields: ['tenant_id', 'debt_case_id', 'created_at'],
          },
          {
            fields: ['tenant_id', 'type', 'created_at'],
          },
          {
            fields: ['tenant_id', 'provider_ref'],
          },
        ],
      }
    );

    return InteractionLog;
  }
}

