/**
 * Properties/communities from PMS.
 */
import { Model, DataTypes } from 'sequelize';

export class PmsProperty extends Model {
  static initModel(sequelize) {
    PmsProperty.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        pmsPortfolioId: { type: DataTypes.UUID, allowNull: true, field: 'pms_portfolio_id', references: { model: 'pms_portfolios', key: 'id' } },
        externalId: { type: DataTypes.STRING(256), allowNull: false, field: 'external_id' },
        name: { type: DataTypes.STRING(256) },
        address: { type: DataTypes.JSONB, defaultValue: {} },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'PmsProperty', tableName: 'pms_properties', timestamps: true, underscored: true }
    );
    return PmsProperty;
  }
}
