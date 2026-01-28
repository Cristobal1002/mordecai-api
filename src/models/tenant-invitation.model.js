/**
 * Modelo TenantInvitation - Invite tokens
 */
import { Model, DataTypes } from 'sequelize';

export class TenantInvitation extends Model {
  static initModel(sequelize) {
    TenantInvitation.init(
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
        email: {
          type: DataTypes.STRING(160),
          allowNull: false,
        },
        role: {
          type: DataTypes.ENUM('owner', 'admin', 'member'),
          allowNull: false,
          defaultValue: 'member',
        },
        status: {
          type: DataTypes.ENUM('pending', 'accepted', 'revoked', 'expired'),
          allowNull: false,
          defaultValue: 'pending',
        },
        token: {
          type: DataTypes.STRING(180),
          allowNull: false,
          unique: true,
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'expires_at',
        },
        createdBy: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'created_by',
          references: {
            model: 'users',
            key: 'id',
          },
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
        modelName: 'TenantInvitation',
        tableName: 'tenant_invitations',
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ['tenant_id'] },
          { fields: ['email'] },
          { fields: ['token'] },
        ],
      }
    );

    return TenantInvitation;
  }
}
