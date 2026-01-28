/**
 * Inicializa todos los modelos de Sequelize y sus relaciones
 * @param {Sequelize} sequelize - Instancia de Sequelize
 */
import { Tenant } from './tenant.model.js';
import { User } from './user.model.js';
import { TenantUser } from './tenant-user.model.js';
import { TenantInvitation } from './tenant-invitation.model.js';
import { Debtor } from './debtor.model.js';
import { FlowPolicy } from './flow-policy.model.js';
import { ImportBatch } from './import-batch.model.js';
import { DebtCase } from './debt-case.model.js';
import { PaymentAgreement } from './payment-agreement.model.js';
import { InteractionLog } from './interaction-log.model.js';

export const initModels = (sequelize) => {
  // Inicializar modelos
  Tenant.initModel(sequelize);
  User.initModel(sequelize);
  TenantUser.initModel(sequelize);
  TenantInvitation.initModel(sequelize);
  Debtor.initModel(sequelize);
  FlowPolicy.initModel(sequelize);
  ImportBatch.initModel(sequelize);
  DebtCase.initModel(sequelize);
  PaymentAgreement.initModel(sequelize);
  InteractionLog.initModel(sequelize);

  // Definir relaciones

  // Tenant hasMany...
  Tenant.hasMany(Debtor, { foreignKey: 'tenant_id', as: 'debtors' });
  Tenant.hasMany(FlowPolicy, { foreignKey: 'tenant_id', as: 'flowPolicies' });
  Tenant.hasMany(ImportBatch, { foreignKey: 'tenant_id', as: 'importBatches' });
  Tenant.hasMany(DebtCase, { foreignKey: 'tenant_id', as: 'debtCases' });
  Tenant.hasMany(PaymentAgreement, { foreignKey: 'tenant_id', as: 'paymentAgreements' });
  Tenant.hasMany(InteractionLog, { foreignKey: 'tenant_id', as: 'interactionLogs' });
  Tenant.hasMany(TenantUser, { foreignKey: 'tenant_id', as: 'memberships' });
  Tenant.hasMany(TenantInvitation, { foreignKey: 'tenant_id', as: 'invitations' });

  // User hasMany...
  User.hasMany(TenantUser, { foreignKey: 'user_id', as: 'memberships' });
  User.hasMany(TenantInvitation, { foreignKey: 'created_by', as: 'sentInvitations' });

  // Debtor hasMany...
  Debtor.hasMany(DebtCase, { foreignKey: 'debtor_id', as: 'debtCases' });
  Debtor.hasMany(InteractionLog, { foreignKey: 'debtor_id', as: 'interactionLogs' });

  // FlowPolicy hasMany...
  FlowPolicy.hasMany(DebtCase, { foreignKey: 'flow_policy_id', as: 'debtCases' });

  // ImportBatch hasMany...
  ImportBatch.hasMany(DebtCase, { foreignKey: 'import_batch_id', as: 'debtCases' });

  // DebtCase hasMany...
  DebtCase.hasMany(PaymentAgreement, { foreignKey: 'debt_case_id', as: 'paymentAgreements' });
  DebtCase.hasMany(InteractionLog, { foreignKey: 'debt_case_id', as: 'interactionLogs' });

  // BelongsTo relationships
  Debtor.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  FlowPolicy.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  ImportBatch.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  DebtCase.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  DebtCase.belongsTo(Debtor, { foreignKey: 'debtor_id', as: 'debtor' });
  DebtCase.belongsTo(FlowPolicy, { foreignKey: 'flow_policy_id', as: 'flowPolicy' });
  DebtCase.belongsTo(ImportBatch, { foreignKey: 'import_batch_id', as: 'importBatch' });
  PaymentAgreement.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  PaymentAgreement.belongsTo(DebtCase, { foreignKey: 'debt_case_id', as: 'debtCase' });
  InteractionLog.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  InteractionLog.belongsTo(DebtCase, { foreignKey: 'debt_case_id', as: 'debtCase' });
  InteractionLog.belongsTo(Debtor, { foreignKey: 'debtor_id', as: 'debtor' });

  TenantUser.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  TenantUser.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  TenantInvitation.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  TenantInvitation.belongsTo(User, { foreignKey: 'created_by', as: 'createdByUser' });
};

export {
  Tenant,
  User,
  TenantUser,
  TenantInvitation,
  Debtor,
  FlowPolicy,
  ImportBatch,
  DebtCase,
  PaymentAgreement,
  InteractionLog,
};

