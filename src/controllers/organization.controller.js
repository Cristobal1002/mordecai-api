import { organizationService } from '../services/organization.service.js';
import { logger } from '../utils/logger.js';

class OrganizationController {
  
  /**
   * Create a new organization
   * POST /api/v1/organizations
   */
  async createOrganization(req, res, next) {
    try {
      const organizationData = req.body;
      const creatorUserId = req.user.id;
      
      const organization = await organizationService.createOrganization(organizationData, creatorUserId);
      
      res.success({
        message: 'Organization created successfully',
        data: {
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            identificacionFisica: organization.identificacionFisica,
            parentId: organization.parentId,
            telefono: organization.telefono,
            direccion: organization.direccion,
            primaryColor: organization.primaryColor,
            secondaryColor: organization.secondaryColor,
            logoUrl: organization.logoUrl,
            isActive: organization.isActive,
            planType: organization.planType,
            createdAt: organization.createdAt,
          }
        }
      }, 201);
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get user's organizations
   * GET /api/v1/organizations/my-organizations
   */
  async getUserOrganizations(req, res, next) {
    try {
      const userId = req.user.id;
      const includeInactive = req.query.includeInactive === 'true';
      
      const organizations = await organizationService.getUserOrganizations(userId, includeInactive);
      
      res.success({
        message: 'User organizations retrieved successfully',
        data: {
          organizations,
          count: organizations.length
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get organization details
   * GET /api/v1/org/:tenantSlug
   */
  async getOrganization(req, res, next) {
    try {
      // Organization is already loaded by tenant middleware
      const organization = req.tenant;
      const membership = req.orgMembership;
      
      res.success({
        message: 'Organization retrieved successfully',
        data: {
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            identificacionFisica: organization.identificacionFisica,
            parentId: organization.parentId,
            telefono: organization.telefono,
            direccion: organization.direccion,
            primaryColor: organization.primaryColor,
            secondaryColor: organization.secondaryColor,
            logoUrl: organization.logoUrl,
            isActive: organization.isActive,
            planType: organization.planType,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt,
          },
          membership: membership ? {
            role: membership.role,
            permissions: membership.permissions,
            joinedAt: membership.joinedAt,
            lastAccessAt: membership.lastAccessAt,
            department: membership.department,
            jobTitle: membership.jobTitle,
          } : null
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update organization
   * PUT /api/v1/org/:tenantSlug
   */
  async updateOrganization(req, res, next) {
    try {
      const organizationId = req.tenant.id;
      const updateData = req.body;
      const userId = req.user.id;
      
      const organization = await organizationService.updateOrganization(organizationId, updateData, userId);
      
      res.success({
        message: 'Organization updated successfully',
        data: {
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            identificacionFisica: organization.identificacionFisica,
            telefono: organization.telefono,
            direccion: organization.direccion,
            primaryColor: organization.primaryColor,
            secondaryColor: organization.secondaryColor,
            logoUrl: organization.logoUrl,
            updatedAt: organization.updatedAt,
          }
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get organization hierarchy
   * GET /api/v1/org/:tenantSlug/hierarchy
   */
  async getOrganizationHierarchy(req, res, next) {
    try {
      const organizationId = req.tenant.id;
      const userId = req.user.id;
      
      const hierarchy = await organizationService.getOrganizationHierarchy(organizationId, userId);
      
      res.success({
        message: 'Organization hierarchy retrieved successfully',
        data: hierarchy
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get organization members
   * GET /api/v1/org/:tenantSlug/members
   */
  async getOrganizationMembers(req, res, next) {
    try {
      const organizationId = req.tenant.id;
      const userId = req.user.id;
      const options = {
        page: req.query.page,
        limit: req.query.limit,
        role: req.query.role,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        search: req.query.search,
      };
      
      const result = await organizationService.getOrganizationMembers(organizationId, userId, options);
      
      res.success({
        message: 'Organization members retrieved successfully',
        data: result
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Invite user to organization
   * POST /api/v1/org/:tenantSlug/members/invite
   */
  async inviteUser(req, res, next) {
    try {
      const organizationId = req.tenant.id;
      const inviteData = req.body;
      const inviterUserId = req.user.id;
      
      const result = await organizationService.inviteUserToOrganization(
        organizationId, 
        inviteData, 
        inviterUserId
      );
      
      // Handle email invitation (new user)
      if (result.type === 'email_invitation') {
        const { invitation, invitationLink } = result;
        
        res.success({
          message: 'Email invitation sent successfully',
          data: {
            invitation: {
              id: invitation.id,
              email: invitation.email,
              role: invitation.role,
              status: invitation.status,
              expiresAt: invitation.expiresAt,
              invitedAt: invitation.invitedAt,
            },
            // Note: In production, invitationLink should be sent via email service
            // and not exposed in the API response
            invitationLink: invitationLink
          }
        }, 201);
        
        return;
      }
      
      // Handle existing user invitation
      res.success({
        message: 'User invited to organization successfully',
        data: {
          membership: {
            id: result.id,
            role: result.role,
            permissions: result.permissions,
            isActive: result.isActive,
            invitedAt: result.invitedAt,
            joinedAt: result.joinedAt,
            department: result.department,
            jobTitle: result.jobTitle,
          }
        }
      }, 201);
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Remove user from organization
   * DELETE /api/v1/org/:tenantSlug/members/:userFirebaseUid
   */
  async removeUser(req, res, next) {
    try {
      const organizationId = req.tenant.id;
      const userFirebaseUid = req.params.userFirebaseUid;
      const removerUserId = req.user.id;
      
      await organizationService.removeUserFromOrganization(organizationId, userFirebaseUid, removerUserId);
      
      res.success({
        message: 'User removed from organization successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update user role in organization
   * PUT /api/v1/org/:tenantSlug/members/:userFirebaseUid/role
   */
  async updateUserRole(req, res, next) {
    try {
      const organizationId = req.tenant.id;
      const userFirebaseUid = req.params.userFirebaseUid;
      const { role } = req.body;
      const updaterUserId = req.user.id;
      
      const membership = await organizationService.updateUserRole(
        organizationId, 
        userFirebaseUid, 
        role, 
        updaterUserId
      );
      
      res.success({
        message: 'User role updated successfully',
        data: {
          membership: {
            id: membership.id,
            role: membership.role,
            permissions: membership.permissions,
            updatedAt: membership.updatedAt,
          }
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get organization dashboard data
   * GET /api/v1/org/:tenantSlug/dashboard
   */
  async getDashboard(req, res, next) {
    try {
      const organization = req.tenant;
      const membership = req.orgMembership;
      const userId = req.user.id;
      
      // Get basic dashboard data
      const dashboardData = {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          planType: organization.planType,
          primaryColor: organization.primaryColor,
          secondaryColor: organization.secondaryColor,
          logoUrl: organization.logoUrl,
        },
        user: {
          role: membership?.role,
          permissions: membership?.permissions,
          joinedAt: membership?.joinedAt,
          lastAccessAt: membership?.lastAccessAt,
        },
        stats: {
          // These could be expanded with actual statistics
          totalMembers: 0,
          activeMembers: 0,
          subOrganizations: 0,
        }
      };
      
      // Get member count (basic stats)
      try {
        const memberStats = await organizationService.getOrganizationMembers(
          organization.id, 
          userId, 
          { limit: 1 }
        );
        dashboardData.stats.totalMembers = memberStats.pagination.total;
      } catch (error) {
        logger.warn({ error, organizationId: organization.id }, 'Could not get member stats for dashboard');
      }
      
      res.success({
        message: 'Dashboard data retrieved successfully',
        data: dashboardData
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get organization settings
   * GET /api/v1/org/:tenantSlug/settings
   */
  async getSettings(req, res, next) {
    try {
      const organization = req.tenant;
      
      res.success({
        message: 'Organization settings retrieved successfully',
        data: {
          identificacionFisica: organization.identificacionFisica,
          telefono: organization.telefono,
          direccion: organization.direccion,
          primaryColor: organization.primaryColor,
          secondaryColor: organization.secondaryColor,
          logoUrl: organization.logoUrl,
          planType: organization.planType,
          isActive: organization.isActive,
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update organization settings
   * PUT /api/v1/org/:tenantSlug/settings
   */
  async updateSettings(req, res, next) {
    try {
      const organizationId = req.tenant.id;
      const { identificacionFisica, telefono, direccion, primaryColor, secondaryColor, logoUrl } = req.body;
      const userId = req.user.id;
      
      const updateData = {};
      if (identificacionFisica !== undefined) updateData.identificacionFisica = identificacionFisica;
      if (telefono !== undefined) updateData.telefono = telefono;
      if (direccion !== undefined) updateData.direccion = direccion;
      if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
      if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      
      const organization = await organizationService.updateOrganization(organizationId, updateData, userId);
      
      res.success({
        message: 'Organization settings updated successfully',
        data: {
          identificacionFisica: organization.identificacionFisica,
          telefono: organization.telefono,
          direccion: organization.direccion,
          primaryColor: organization.primaryColor,
          secondaryColor: organization.secondaryColor,
          logoUrl: organization.logoUrl,
          updatedAt: organization.updatedAt,
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get available organization roles
   * GET /api/v1/organizations/:tenantSlug/roles
   */
  async getAvailableRoles(req, res, next) {
    try {
      // Define available roles with descriptions
      const roles = [
        {
          value: 'owner',
          label: 'Owner',
          description: 'Organization owner with full control',
          permissions: {
            users: { read: true, write: true, delete: true, invite: true },
            organizations: { read: true, write: true, delete: true, settings: true },
            reports: { read: true, write: true, export: true },
            billing: { read: true, write: true },
            api: { read: true, write: true }
          }
        },
        {
          value: 'admin',
          label: 'Administrator',
          description: 'Administrator with almost full control',
          permissions: {
            users: { read: true, write: true, delete: true, invite: true },
            organizations: { read: true, write: true, delete: false, settings: true },
            reports: { read: true, write: true, export: true },
            billing: { read: true, write: false },
            api: { read: true, write: true }
          }
        },
        {
          value: 'manager',
          label: 'Manager',
          description: 'Manager with user management and some settings access',
          permissions: {
            users: { read: true, write: true, delete: false, invite: true },
            organizations: { read: true, write: false, delete: false, settings: false },
            reports: { read: true, write: true, export: false },
            billing: { read: false, write: false },
            api: { read: true, write: false }
          }
        },
        {
          value: 'employee',
          label: 'Employee',
          description: 'Regular employee with basic access',
          permissions: {
            users: { read: true, write: false, delete: false, invite: false },
            organizations: { read: true, write: false, delete: false, settings: false },
            reports: { read: true, write: false, export: false },
            billing: { read: false, write: false },
            api: { read: false, write: false }
          }
        },
        {
          value: 'viewer',
          label: 'Viewer',
          description: 'Read-only access to organization resources',
          permissions: {
            users: { read: true, write: false, delete: false, invite: false },
            organizations: { read: true, write: false, delete: false, settings: false },
            reports: { read: true, write: false, export: false },
            billing: { read: false, write: false },
            api: { read: false, write: false }
          }
        },
        {
          value: 'guest',
          label: 'Guest',
          description: 'Limited temporary access with minimal permissions',
          permissions: {
            users: { read: false, write: false, delete: false, invite: false },
            organizations: { read: true, write: false, delete: false, settings: false },
            reports: { read: false, write: false, export: false },
            billing: { read: false, write: false },
            api: { read: false, write: false }
          }
        }
      ];
      
      res.success({
        message: 'Organization roles retrieved successfully',
        data: {
          roles
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
}

export const organizationController = new OrganizationController();
