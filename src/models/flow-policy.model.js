/**
 * Modelo FlowPolicy - Reglas de cobranza por rango de days_past_due
 */
import { Model, DataTypes } from 'sequelize';

export class FlowPolicy extends Model {
  static initModel(sequelize) {
    FlowPolicy.init(
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
        name: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        minDaysPastDue: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'min_days_past_due',
        },
        maxDaysPastDue: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'max_days_past_due',
        },
        channels: {
          type: DataTypes.JSONB,
          defaultValue: {},
          comment: '{sms:true,email:true,call:true,whatsapp:false}',
        },
        tone: {
          type: DataTypes.STRING(40),
          defaultValue: 'professional',
          comment: 'friendly|professional|firm',
        },
        rules: {
          type: DataTypes.JSONB,
          defaultValue: {},
          comment: 'Reglas para acuerdos de pago',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          field: 'is_active',
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
        modelName: 'FlowPolicy',
        tableName: 'flow_policies',
        timestamps: true,
        underscored: true,
        indexes: [
          {
            fields: ['tenant_id', 'min_days_past_due', 'max_days_past_due'],
          },
        ],
      }
    );

    return FlowPolicy;
  }
}

