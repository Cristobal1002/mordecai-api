import { membershipService } from '../memberships/membership.service.js';

export const invitationController = {
  preview: async (req, res, next) => {
    try {
      const preview = await membershipService.getInvitationPreview(req.params.token);
      return res.ok(preview, 'Invitation preview');
    } catch (error) {
      return next(error);
    }
  },

  accept: async (req, res, next) => {
    try {
      const result = await membershipService.acceptInvitation(
        req.params.token,
        req
      );
      return res.ok(result, 'Invitation accepted');
    } catch (error) {
      return next(error);
    }
  },
};
