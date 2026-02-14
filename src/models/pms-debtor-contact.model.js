/**
 * Emails, phones, postal addresses per pms_debtor.
 */
import { Model, DataTypes } from 'sequelize';

export class PmsDebtorContact extends Model {
  static initModel(sequelize) {
    PmsDebtorContact.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        pmsDebtorId: { type: DataTypes.UUID, allowNull: false, field: 'pms_debtor_id', references: { model: 'pms_debtors', key: 'id' } },
        contactType: { type: DataTypes.STRING(32), allowNull: false, field: 'contact_type' },
        value: { type: DataTypes.STRING(512), allowNull: false },
        label: { type: DataTypes.STRING(64) },
        isPrimary: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_primary' },
        externalId: { type: DataTypes.STRING(256), field: 'external_id' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      { sequelize, modelName: 'PmsDebtorContact', tableName: 'pms_debtor_contacts', timestamps: true, underscored: true }
    );
    return PmsDebtorContact;
  }
}
