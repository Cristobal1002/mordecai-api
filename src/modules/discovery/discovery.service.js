import { Sequelize } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { DiscoverySession } from '../../models/discovery-session.model.js';

export const discoveryService = {
  /**
   * @param {string} clientSessionId
   * @param {{ answers: Record<string, unknown>, currentStepIndex: number, completed?: boolean }} payload
   * @param {import('express').Request} req
   */
  async upsert(clientSessionId, payload, req) {
    if (!sequelize) {
      throw new Error('Database unavailable');
    }
    const { answers, currentStepIndex, completed } = payload;
    const ipAddress = req.ip || null;
    const userAgent = req.get('user-agent') || null;

    const patch = {
      answers,
      currentStepIndex,
      ipAddress,
      userAgent,
    };

    const existing = await DiscoverySession.findOne({
      where: { clientSessionId },
    });

    if (existing) {
      await existing.update({
        ...patch,
        completedAt: completed ? new Date() : existing.completedAt,
        ipAddress: existing.ipAddress || ipAddress,
        userAgent: existing.userAgent || userAgent,
      });
      await existing.reload();
      return existing.toJSON();
    }

    try {
      const created = await DiscoverySession.create({
        clientSessionId,
        ...patch,
        completedAt: completed ? new Date() : null,
      });
      return created.toJSON();
    } catch (err) {
      // Dos PUT casi a la vez: ambos ven "no existe" y el segundo create choca con uq_discovery_sessions_client_session.
      if (err instanceof Sequelize.UniqueConstraintError) {
        const row = await DiscoverySession.findOne({ where: { clientSessionId } });
        if (!row) throw err;
        await row.update({
          ...patch,
          completedAt: completed ? new Date() : row.completedAt,
          ipAddress: row.ipAddress || ipAddress,
          userAgent: row.userAgent || userAgent,
        });
        await row.reload();
        return row.toJSON();
      }
      throw err;
    }
  },

  async getByClientSessionId(clientSessionId) {
    if (!sequelize) {
      throw new Error('Database unavailable');
    }
    const row = await DiscoverySession.findOne({
      where: { clientSessionId },
    });
    return row ? row.toJSON() : null;
  },
};
