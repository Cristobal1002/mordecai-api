import { catalogService } from './catalog.service.js';

export const catalogController = {
  create: async (req, res, next) => {
    try {
      const data = await catalogService.create(req.body);
      res.created(data, 'Software created successfully');
    } catch (error) {
      next(error);
    }
  },

  listSoftwares: async (req, res, next) => {
    try {
      const category = req.query?.category;
      const data = await catalogService.listSoftwares({ category });
      res.ok(data, 'Softwares retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  getSetupSteps: async (req, res, next) => {
    try {
      const { softwareKey } = req.params;
      const data = await catalogService.getSetupStepsBySoftwareKey(softwareKey);
      res.ok(data, 'Setup steps retrieved successfully');
    } catch (error) {
      next(error);
    }
  },
};
