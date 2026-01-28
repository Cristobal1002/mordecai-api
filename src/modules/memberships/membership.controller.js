import { membershipService } from './membership.service.js';

export const membershipController = {
  list: async (req, res, next) => {
    try {
      const members = await membershipService.listMembers(
        req.params.tenantId,
        req
      );
      return res.ok(members, 'Members fetched');
    } catch (error) {
      return next(error);
    }
  },

  invite: async (req, res, next) => {
    try {
      const invitation = await membershipService.inviteMember(
        req.params.tenantId,
        req.body,
        req
      );
      return res.created(invitation, 'Invitation created');
    } catch (error) {
      return next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const membership = await membershipService.updateMember(
        req.params.tenantId,
        req.params.userId,
        req.body,
        req
      );
      return res.ok(membership, 'Member updated');
    } catch (error) {
      return next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const result = await membershipService.removeMember(
        req.params.tenantId,
        req.params.userId,
        req
      );
      return res.ok(result, 'Member removed');
    } catch (error) {
      return next(error);
    }
  },
};
