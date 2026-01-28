/**
 * Modelo TenantUser - Membership user <-> tenant
 */
import { Model, DataTypes } from 'sequelize';

export class TenantUser extends Model {
  static initModel(sequelize) {
    TenantUser.init(
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
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'user_id',
          references: {
            model: 'users',
            key: 'id',
          },
        },
        role: {
          type: DataTypes.ENUM('owner', 'admin', 'member'),
          allowNull: false,
          defaultValue: 'member',
        },
        status: {
          type: DataTypes.ENUM('invited', 'active', 'disabled'),
          allowNull: false,
          defaultValue: 'invited',
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
        modelName: 'TenantUser',
        tableName: 'tenant_users',
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ['tenant_id'] },
          { fields: ['user_id'] },
          { unique: true, fields: ['tenant_id', 'user_id'] },
        ],
      }
    );

    return TenantUser;
  }
}
