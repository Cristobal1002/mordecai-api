import { membershipService } from '../memberships/membership.service.js';

export const invitationController = {
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
