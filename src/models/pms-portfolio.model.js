/**
 * Portfolios from PMS (centro de costo). Rentvine: portfolios/search.
 */
import { Model, DataTypes } from 'sequelize';

export class PmsPortfolio extends Model {
  static initModel(sequelize) {
    PmsPortfolio.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        pmsConnectionId: { type: DataTypes.UUID, allowNull: false, field: 'pms_connection_id', references: { model: 'pms_connections', key: 'id' } },
        externalId: { type: DataTypes.STRING(256), allowNull: false, field: 'external_id' },
        name: { type: DataTypes.STRING(256) },
        meta: { type: DataTypes.JSONB, defaultValue: {} },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'PmsPortfolio', tableName: 'pms_portfolios', timestamps: true, underscored: true }
    );
    return PmsPortfolio;
  }
}
