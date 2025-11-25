import { DataTypes, Op } from 'sequelize';
import crypto from 'crypto';

export const defineOrganizationInvitationModel = (sequelize) => {
  const OrganizationInvitation = sequelize.define(
    'OrganizationInvitation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
        comment: 'Email of the invited user (user may not exist yet)',
      },
      invitationToken: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique invitation token (used in Firebase action code)',
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        comment: 'Organization inviting the user',
      },
      invitedBy: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'User who sent the invitation',
      },
      role: {
        type: DataTypes.ENUM('owner', 'admin', 'manager', 'employee', 'viewer', 'guest'),
        allowNull: false,
        defaultValue: 'employee',
        comment: 'Role the user will have in the organization',
      },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'expired', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Invitation status',
      },
      firebaseActionCode: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Firebase action code used in the invitation link',
      },
      invitedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'When the invitation was sent',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'When the invitation expires (default: 7 days)',
      },
      acceptedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the invitation was accepted',
      },
    },
    {
      tableName: 'organization_invitations',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['invitationToken'],
          name: 'org_invitations_token_unique',
        },
        {
          fields: ['email'],
          name: 'org_invitations_email_index',
        },
        {
          fields: ['organizationId'],
          name: 'org_invitations_org_index',
        },
        {
          fields: ['status'],
          name: 'org_invitations_status_index',
        },
        {
          fields: ['expiresAt'],
          name: 'org_invitations_expires_index',
        },
        {
          fields: ['email', 'organizationId', 'status'],
          name: 'org_invitations_email_org_status_index',
        },
      ],
    }
  );

  // Instance methods
  OrganizationInvitation.prototype.isExpired = function() {
    return this.expiresAt < new Date();
  };

  OrganizationInvitation.prototype.isValid = function() {
    return this.status === 'pending' && !this.isExpired();
  };

  OrganizationInvitation.prototype.accept = async function() {
    return this.update({
      status: 'accepted',
      acceptedAt: new Date(),
    });
  };

  OrganizationInvitation.prototype.cancel = async function() {
    return this.update({
      status: 'cancelled',
    });
  };

  // Static methods
  OrganizationInvitation.findByToken = async function(token) {
    return await this.findOne({
      where: { invitationToken: token, status: 'pending' },
    });
  };

  OrganizationInvitation.findValidByEmail = async function(email, organizationId) {
    return await this.findOne({
      where: {
        email,
        organizationId,
        status: 'pending',
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
    });
  };

  OrganizationInvitation.generateToken = function() {
    return crypto.randomBytes(32).toString('hex');
  };

  // Hooks
  OrganizationInvitation.addHook('beforeCreate', async (invitation) => {
    // Generate unique invitation token if not provided
    if (!invitation.invitationToken) {
      let token;
      let exists = true;
      // Ensure token uniqueness
      while (exists) {
        token = OrganizationInvitation.generateToken();
        const existing = await OrganizationInvitation.findOne({
          where: { invitationToken: token }
        });
        exists = !!existing;
      }
      invitation.invitationToken = token;
    }

    // Set default expiration date (7 days from now)
    if (!invitation.expiresAt) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);
      invitation.expiresAt = expirationDate;
    }
  });

  return OrganizationInvitation;
};

