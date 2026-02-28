/**
 * CaseDispute - Case hold with reason and evidence. Stops automation when OPEN.
 */
import { Model, DataTypes } from 'sequelize';

export class CaseDispute extends Model {
  static initModel(sequelize) {
    CaseDispute.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        debtCaseId: { type: DataTypes.UUID, allowNull: false, field: 'debt_case_id', references: { model: 'debt_cases', key: 'id' } },
        tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id', references: { model: 'tenants', key: 'id' } },
        status: {
          type: DataTypes.ENUM('OPEN', 'WAITING_TENANT', 'WAITING_DEBTOR', 'RESOLVED', 'CLOSED'),
          allowNull: false,
          defaultValue: 'OPEN',
        },
        reason: {
          type: DataTypes.ENUM(
            'PAID_ALREADY',
            'WRONG_AMOUNT',
            'WRONG_DEBTOR',
            'LEASE_ENDED',
            'UNDER_LEGAL_REVIEW',
            'PROMISE_OFFLINE',
            'DO_NOT_CONTACT',
            'OTHER'
          ),
          allowNull: false,
        },
        notes: { type: DataTypes.TEXT },
        evidenceUrls: { type: DataTypes.JSONB, defaultValue: [], field: 'evidence_urls' },
        openedBy: { type: DataTypes.UUID, field: 'opened_by' },
        openedAt: { type: DataTypes.DATE, field: 'opened_at' },
        resolvedBy: { type: DataTypes.UUID, field: 'resolved_by' },
        resolvedAt: { type: DataTypes.DATE, field: 'resolved_at' },
        resolution: { type: DataTypes.TEXT },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'CaseDispute',
        tableName: 'case_disputes',
        timestamps: true,
        underscored: true,
      }
    );
    return CaseDispute;
  }
}
