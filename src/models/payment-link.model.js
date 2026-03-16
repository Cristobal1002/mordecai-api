/**
 * PaymentLink - Token-based payment links with verification, tracking, expiration
 * URL format: /p/{token} — does not expose agreement ID
 */
import { Model, DataTypes } from 'sequelize';

export class PaymentLink extends Model {
  static initModel(sequelize) {
    PaymentLink.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        tenantId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'tenant_id',
          references: { model: 'tenants', key: 'id' },
        },
        debtCaseId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'debt_case_id',
          references: { model: 'debt_cases', key: 'id' },
        },
        paymentAgreementId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'payment_agreement_id',
          references: { model: 'payment_agreements', key: 'id' },
        },
        token: { type: DataTypes.STRING(128), allowNull: false, unique: true },
        shortToken: { type: DataTypes.STRING(16), allowNull: true, unique: true, field: 'short_token' },
        status: {
          type: DataTypes.ENUM('PENDING', 'VERIFIED', 'PAID', 'EXPIRED', 'BLOCKED'),
          defaultValue: 'PENDING',
        },
        expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
        clickedAt: { type: DataTypes.DATE, allowNull: true, field: 'clicked_at' },
        clickSource: { type: DataTypes.STRING(32), allowNull: true, field: 'click_source' },
        clickIp: { type: DataTypes.STRING(64), allowNull: true, field: 'click_ip' },
        clickUserAgent: { type: DataTypes.TEXT, allowNull: true, field: 'click_user_agent' },
        verificationAttempts: { type: DataTypes.SMALLINT, defaultValue: 0, field: 'verification_attempts' },
        verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
        verificationMethod: {
          type: DataTypes.ENUM('LEASE_DATA', 'OTP'),
          allowNull: true,
          field: 'verification_method',
        },
        otpCodeHash: { type: DataTypes.STRING(256), allowNull: true, field: 'otp_code_hash' },
        otpExpiresAt: { type: DataTypes.DATE, allowNull: true, field: 'otp_expires_at' },
        otpAttempts: { type: DataTypes.SMALLINT, defaultValue: 0, field: 'otp_attempts' },
        otpSentTo: { type: DataTypes.STRING(160), allowNull: true, field: 'otp_sent_to' },
        createdAt: { type: DataTypes.DATE, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
      },
      {
        sequelize,
        modelName: 'PaymentLink',
        tableName: 'payment_links',
        timestamps: true,
        underscored: true,
      }
    );
    return PaymentLink;
  }
}
