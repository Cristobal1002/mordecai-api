/**
 * Modelo TenantSubscription - Suscripción y add-ons de billing por tenant
 */
import { Model, DataTypes } from 'sequelize';

export class TenantSubscription extends Model {
  static initModel(sequelize) {
    TenantSubscription.init(
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
          references: { model: 'tenants', key: 'id' },
        },
        callsPlan: {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: 'none',
          field: 'calls_plan',
        },
        whiteLabelEnabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'white_label',
        },
        extraSeats: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          field: 'extra_seats',
        },
        customRatePerUnitCents: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'custom_rate_per_unit_cents',
        },
        status: {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: 'trialing',
        },
        trialEndsAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'trial_ends_at',
        },
        billingAnchor: {
          type: DataTypes.DATEONLY,
          allowNull: true,
          field: 'billing_anchor',
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
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
        modelName: 'TenantSubscription',
        tableName: 'tenant_subscriptions',
        timestamps: true,
        underscored: true,
      }
    );
    return TenantSubscription;
  }
}
