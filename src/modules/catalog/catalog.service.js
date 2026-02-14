/**
 * Catalog service — Capa 1: metadata global (softwares + setup steps).
 * No depende de tenants. Solo devuelve metadata para el frontend.
 */
import { Software, SoftwareSetupStep } from '../../models/index.js';
import { NotFoundError, ConflictError } from '../../errors/index.js';

export const catalogService = {
  create: async (data) => {
    const key = String(data.key).trim().toLowerCase();
    const existing = await Software.findOne({ where: { key } });
    if (existing) {
      throw new ConflictError('A software with this key already exists');
    }
    const logoUrl = data.logoUrl != null && String(data.logoUrl).trim() ? data.logoUrl.trim() : null;
    const docsUrl = data.docsUrl != null && String(data.docsUrl).trim() ? data.docsUrl.trim() : null;
    return await Software.create({
      key,
      name: data.name,
      category: data.category,
      authType: data.authType,
      authConfig: data.authConfig ?? {},
      capabilities: data.capabilities ?? {},
      logoUrl,
      docsUrl,
      isEnabled: data.isEnabled !== false,
    });
  },

  listSoftwares: async (opts = {}) => {
    const where = { isEnabled: true };
    if (opts.category) {
      where.category = opts.category;
    }
    return await Software.findAll({
      where,
      attributes: [
        'id',
        'key',
        'name',
        'category',
        'authType',
        'authConfig',
        'capabilities',
        'logoUrl',
        'docsUrl',
      ],
      order: [['name', 'ASC']],
    });
  },

  getSoftwareByKey: async (softwareKey) => {
    const software = await Software.findOne({
      where: { key: softwareKey, isEnabled: true },
    });
    if (!software) {
      throw new NotFoundError('Software');
    }
    return software;
  },

  getSetupStepsBySoftwareKey: async (softwareKey) => {
    const software = await catalogService.getSoftwareByKey(softwareKey);
    return await SoftwareSetupStep.findAll({
      where: { softwareId: software.id },
      order: [['order', 'ASC']],
    });
  },
};
