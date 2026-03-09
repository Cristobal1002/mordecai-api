/**
 * Analytics service — KPIs y vistas agregadas para el dashboard de inteligencia financiera.
 */
import { Op } from 'sequelize';
import {
  ArCharge,
  ArPayment,
  ArAdjustment,
  ArBalance,
  ArAgingSnapshot,
  ArPortfolioAgingSnapshot,
  ArLeaseAgingSnapshot,
  PmsPortfolio,
  PmsLease,
  PmsDebtor,
  PmsProperty,
} from '../../models/index.js';
import { tenantRepository } from '../tenants/tenant.repository.js';
import { NotFoundError } from '../../errors/index.js';

async function ensureTenant(tenantId) {
  const tenant = await tenantRepository.findById(tenantId);
  if (!tenant) throw new NotFoundError('Tenant');
  return tenant;
}

function baseWhere(tenantId, connectionId) {
  const where = { tenantId };
  if (connectionId) where.pmsConnectionId = connectionId;
  return where;
}

export const analyticsService = {
  async getPortfolioSummary(tenantId, opts = {}) {
    await ensureTenant(tenantId);
    const connectionId = opts.connectionId || null;
    const where = baseWhere(tenantId, connectionId);

    const today = new Date().toISOString().slice(0, 10);
    const [balanceSum, pastDueSum, adjustmentsSum, latestAging, paymentsForDso, riskCounts] = await Promise.all([
      ArBalance.sum('balanceCents', { where: { ...where, asOfDate: today } }),
      ArBalance.sum('pastDueTotalCents', { where: { ...where, asOfDate: today } }),
      ArAdjustment.sum('amountCents', { where }),
      ArAgingSnapshot.findOne({
        where: { ...where, asOfDate: today },
        attributes: ['totalCents'],
        raw: true,
      }),
      ArPayment.sum('amountCents', {
        where: { ...where, paidAt: { [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
      }),
      PmsLease.findAll({
        where: { ...where },
        attributes: ['riskTier'],
        raw: true,
      }),
    ]);

    const totalBruto = Number(balanceSum) || 0;
    const totalVencido = (Number(pastDueSum) ?? Number(latestAging?.totalCents)) || 0;
    const totalAjustes = Number(adjustmentsSum) || 0;
    const totalNeto = Math.max(0, totalBruto - totalAjustes);

    const riskConcentration = { critico: 0, alto: 0, medio: 0, bajo: 0, alDia: 0 };
    for (const r of riskCounts || []) {
      const t = String(r.riskTier || 'al_dia').toLowerCase();
      if (t === 'critico') riskConcentration.critico++;
      else if (t === 'alto') riskConcentration.alto++;
      else if (t === 'medio') riskConcentration.medio++;
      else if (t === 'bajo') riskConcentration.bajo++;
      else riskConcentration.alDia++;
    }

    const totalPaid = Number(paymentsForDso) || 0;
    const dso = totalPaid > 0 && totalBruto > 0
      ? Math.round((totalBruto / (totalPaid / 90)) * 10) / 10
      : null;

    return {
      totalBruto,
      totalNeto,
      totalVencido,
      totalAjustes,
      dso,
      riskConcentration,
    };
  },

  async getAgingByPortfolio(tenantId, opts = {}) {
    await ensureTenant(tenantId);
    const connectionId = opts.connectionId || null;
    const portfolioId = opts.portfolioId || null;
    const asOfDate = opts.asOfDate || new Date().toISOString().slice(0, 10);

    // 1. Obtener TODOS los portafolios del tenant (congruente con Data Explorer)
    const portfolioWhere = { tenantId };
    if (connectionId) portfolioWhere.pmsConnectionId = connectionId;
    if (portfolioId) portfolioWhere.id = portfolioId;

    const portfolios = await PmsPortfolio.findAll({
      where: portfolioWhere,
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      raw: true,
    });

    if (portfolios.length === 0) return [];

    const portfolioIds = portfolios.map((p) => p.id);

    // 2. Obtener aging snapshots para esos portafolios y fecha
    const snapshotWhere = {
      tenantId,
      asOfDate,
      pmsPortfolioId: { [Op.in]: portfolioIds },
    };
    if (connectionId) snapshotWhere.pmsConnectionId = connectionId;

    const snapshots = await ArPortfolioAgingSnapshot.findAll({
      where: snapshotWhere,
      attributes: ['pmsPortfolioId', 'bucket030Cents', 'bucket3160Cents', 'bucket6190Cents', 'bucket90PlusCents', 'totalCents', 'pastDueTotalCents'],
      raw: true,
    });

    const snapshotByPortfolio = new Map(
      (snapshots || []).map((s) => [
        s.pmsPortfolioId,
        {
          bucket0_30: Number(s.bucket030Cents) || 0,
          bucket31_60: Number(s.bucket3160Cents) || 0,
          bucket61_90: Number(s.bucket6190Cents) || 0,
          bucket90plus: Number(s.bucket90PlusCents) || 0,
          total: Number(s.totalCents) || 0,
          pastDueTotalCents: Number(s.pastDueTotalCents) ?? (Number(s.bucket030Cents) || 0) + (Number(s.bucket3160Cents) || 0) + (Number(s.bucket6190Cents) || 0) + (Number(s.bucket90PlusCents) || 0),
        },
      ])
    );

    // 3. Merge: todos los portafolios con aging donde exista, 0 donde no
    return portfolios.map((p) => {
      const snap = snapshotByPortfolio.get(p.id) || {
        bucket0_30: 0,
        bucket31_60: 0,
        bucket61_90: 0,
        bucket90plus: 0,
        total: 0,
        pastDueTotalCents: 0,
      };
      return {
        portfolioId: p.id,
        portfolioName: p.name || null,
        bucket0_30: snap.bucket0_30,
        bucket31_60: snap.bucket31_60,
        bucket61_90: snap.bucket61_90,
        bucket90plus: snap.bucket90plus,
        total: snap.total,
        pastDueTotalCents: snap.pastDueTotalCents,
      };
    });
  },

  async getAgingTrend(tenantId, opts = {}) {
    await ensureTenant(tenantId);
    const connectionId = opts.connectionId || null;
    const days = Math.min(365, Math.max(1, Number(opts.days) || 30));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const fromDate = cutoff.toISOString().slice(0, 10);

    const where = { tenantId, asOfDate: { [Op.gte]: fromDate } };
    if (connectionId) where.pmsConnectionId = connectionId;

    const rows = await ArAgingSnapshot.findAll({
      where,
      order: [['asOfDate', 'ASC']],
      attributes: [
        'asOfDate',
        'bucket030Cents',
        'bucket3160Cents',
        'bucket6190Cents',
        'bucket90PlusCents',
        'totalCents',
      ],
      raw: true,
    });

    return (rows || []).map((r) => ({
      date: r.asOfDate ? String(r.asOfDate).slice(0, 10) : null,
      bucket0_30: Number(r.bucket030Cents) || 0,
      bucket31_60: Number(r.bucket3160Cents) || 0,
      bucket61_90: Number(r.bucket6190Cents) || 0,
      bucket90plus: Number(r.bucket90PlusCents) || 0,
      total: Number(r.totalCents) || 0,
    }));
  },

  async getTransitionMatrix(tenantId, opts = {}) {
    await ensureTenant(tenantId);
    const connectionId = opts.connectionId || null;
    const fromDate = opts.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = opts.toDate || new Date().toISOString().slice(0, 10);

    const where = { tenantId };
    if (connectionId) where.pmsConnectionId = connectionId;

    const [fromSnaps, toSnaps] = await Promise.all([
      ArLeaseAgingSnapshot.findAll({
        where: { ...where, asOfDate: fromDate },
        attributes: ['pmsLeaseId', 'bucketLabel'],
        raw: true,
      }),
      ArLeaseAgingSnapshot.findAll({
        where: { ...where, asOfDate: toDate },
        attributes: ['pmsLeaseId', 'bucketLabel', 'balanceCents'],
        raw: true,
      }),
    ]);

    const fromByLease = new Map(fromSnaps.map((s) => [s.pmsLeaseId, s.bucketLabel]));
    const toByLease = new Map(toSnaps.map((s) => [s.pmsLeaseId, { bucketLabel: s.bucketLabel, balanceCents: Number(s.balanceCents) || 0 }]));

    const buckets = ['current', '1_30', '31_60', '61_90', '91_plus'];
    const matrix = {};
    const matrixBalance = {};
    for (const bFrom of buckets) {
      matrix[bFrom] = {};
      matrixBalance[bFrom] = {};
      for (const bTo of buckets) {
        matrix[bFrom][bTo] = 0;
        matrixBalance[bFrom][bTo] = 0;
      }
    }

    for (const [leaseId, toData] of toByLease) {
      const fromBucket = fromByLease.get(leaseId) || 'current';
      const f = String(fromBucket).toLowerCase();
      const t = String((toData.bucketLabel || 'current')).toLowerCase();
      const balanceCents = toData.balanceCents || 0;
      if (matrix[f] && matrix[f][t] !== undefined) {
        matrix[f][t]++;
        matrixBalance[f][t] += balanceCents;
      }
    }

    return { fromDate, toDate, matrix, matrixBalance };
  },

  async getTopDebtors(tenantId, opts = {}) {
    await ensureTenant(tenantId);
    const connectionId = opts.connectionId || null;
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 10));
    const sortBy = opts.sortBy || 'vencido';

    const where = { tenantId };
    if (connectionId) where.pmsConnectionId = connectionId;

    const today = new Date().toISOString().slice(0, 10);
    const latestBalances = await ArBalance.findAll({
      where: { ...where, asOfDate: today },
      attributes: ['pmsLeaseId', 'balanceCents', 'pastDueTotalCents'],
      include: [
        {
          model: PmsLease,
          as: 'pmsLease',
          required: true,
          attributes: ['id', 'pmsDebtorId', 'riskTier'],
          include: [
            { model: PmsDebtor, as: 'pmsDebtor', required: true, attributes: ['id', 'displayName'] },
          ],
        },
      ],
      raw: true,
    });

    const byDebtor = new Map();
    for (const row of latestBalances || []) {
      const debtorId = row['pmsLease.pmsDebtor.id'];
      const name = row['pmsLease.pmsDebtor.displayName'];
      const totalCents = Number(row.balanceCents) || 0;
      const vencidoCents = Number(row.pastDueTotalCents) || 0;
      const riskTier = row['pmsLease.riskTier'] || 'al_dia';

      if (!byDebtor.has(debtorId)) {
        byDebtor.set(debtorId, {
          debtorId,
          name: name || 'Unknown',
          totalCents: 0,
          vencidoCents: 0,
          riskTier,
          daysOverdue: 0,
        });
      }
      const d = byDebtor.get(debtorId);
      d.totalCents += totalCents;
      d.vencidoCents += vencidoCents;
    }

    let sorted = [...byDebtor.values()].filter((d) => d.totalCents > 0);
    if (sortBy === 'vencido') {
      sorted.sort((a, b) => (b.vencidoCents || 0) - (a.vencidoCents || 0));
    } else if (sortBy === 'total') {
      sorted.sort((a, b) => b.totalCents - a.totalCents);
    } else if (sortBy === 'daysOverdue') {
      const tierOrder = { critico: 5, alto: 4, medio: 3, bajo: 2, al_dia: 1 };
      sorted.sort((a, b) => (tierOrder[b.riskTier] || 0) - (tierOrder[a.riskTier] || 0));
    }
    return sorted.slice(0, limit);
  },

  async getRecovery(tenantId, opts = {}) {
    await ensureTenant(tenantId);
    const connectionId = opts.connectionId || null;
    const days = Math.min(365, Math.max(1, Number(opts.days) || 30));
    const groupBy = opts.groupBy || 'portfolio';

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const fromDate = cutoff.toISOString().slice(0, 10);

    const where = {
      tenantId,
      paidAt: { [Op.gte]: new Date(fromDate + 'T00:00:00Z') },
    };
    if (connectionId) where.pmsConnectionId = connectionId;

    const payments = await ArPayment.findAll({
      where,
      attributes: ['amountCents', 'pmsLeaseId'],
      include: [
        {
          model: PmsLease,
          as: 'pmsLease',
          required: false,
          attributes: ['id', 'pmsPropertyId'],
          include: [
            {
              model: PmsProperty,
              as: 'pmsProperty',
              required: false,
              attributes: ['id', 'pmsPortfolioId'],
              include: [
                {
                  model: PmsPortfolio,
                  as: 'pmsPortfolio',
                  required: false,
                  attributes: ['id', 'name'],
                },
              ],
            },
          ],
        },
      ],
      raw: true,
    });

    const byKey = new Map();
    for (const p of payments || []) {
      const amt = Number(p.amountCents) || 0;
      if (groupBy === 'portfolio') {
        const portfolioId = p['pmsLease.pmsProperty.pmsPortfolio.id'] || 'unassigned';
        const portfolioName = p['pmsLease.pmsProperty.pmsPortfolio.name'] || 'Sin portfolio';
        const key = String(portfolioId);
        if (!byKey.has(key)) {
          byKey.set(key, { portfolioId: key, portfolioName, totalCents: 0 });
        }
        byKey.get(key).totalCents += amt;
      } else {
        const propertyId = p['pmsLease.pmsProperty.id'] || 'unassigned';
        const key = String(propertyId);
        if (!byKey.has(key)) {
          byKey.set(key, { propertyId: key, totalCents: 0 });
        }
        byKey.get(key).totalCents += amt;
      }
    }

    return {
      fromDate,
      days,
      groupBy,
      items: [...byKey.values()],
    };
  },

  async getRiskByPortfolio(tenantId, opts = {}) {
    await ensureTenant(tenantId);
    const connectionId = opts.connectionId || null;
    const where = baseWhere(tenantId, connectionId);

    const leases = await PmsLease.findAll({
      where,
      attributes: ['id', 'riskTier'],
      include: [
        {
          model: PmsProperty,
          as: 'pmsProperty',
          required: false,
          attributes: ['id', 'pmsPortfolioId'],
          include: [
            {
              model: PmsPortfolio,
              as: 'pmsPortfolio',
              required: false,
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
      raw: true,
    });

    const byPortfolio = new Map();
    for (const row of leases || []) {
      const portfolioId = row['pmsProperty.pmsPortfolio.id'] || 'unassigned';
      const portfolioName = row['pmsProperty.pmsPortfolio.name'] || 'Sin portfolio';
      const tier = String(row.riskTier || 'al_dia').toLowerCase();

      if (!byPortfolio.has(portfolioId)) {
        byPortfolio.set(portfolioId, {
          portfolioId,
          portfolioName,
          critico: 0,
          alto: 0,
          medio: 0,
          bajo: 0,
          alDia: 0,
        });
      }
      const p = byPortfolio.get(portfolioId);
      if (tier === 'critico') p.critico++;
      else if (tier === 'alto') p.alto++;
      else if (tier === 'medio') p.medio++;
      else if (tier === 'bajo') p.bajo++;
      else p.alDia++;
    }

    return [...byPortfolio.values()].map((p) => ({
      ...p,
      total: p.critico + p.alto + p.medio + p.bajo + p.alDia,
    }));
  },

  async getRiskByLease(tenantId, opts = {}) {
    await ensureTenant(tenantId);
    const connectionId = opts.connectionId || null;
    const portfolioId = opts.portfolioId || null;
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
    const sortBy = opts.sortBy || 'risk';

    const today = new Date().toISOString().slice(0, 10);
    const balanceWhere = baseWhere(tenantId, connectionId);
    balanceWhere.asOfDate = today;

    if (portfolioId) {
      const props = await PmsProperty.findAll({
        where: { pmsPortfolioId: portfolioId },
        attributes: ['id'],
        raw: true,
      });
      const propIds = props.map((p) => p.id);
      if (propIds.length > 0) {
        const leasesInPortfolio = await PmsLease.findAll({
          where: { ...baseWhere(tenantId, connectionId), pmsPropertyId: { [Op.in]: propIds } },
          attributes: ['id'],
          raw: true,
        });
        const leaseIds = leasesInPortfolio.map((l) => l.id);
        if (leaseIds.length > 0) {
          balanceWhere.pmsLeaseId = { [Op.in]: leaseIds };
        }
      }
    }

    const balances = await ArBalance.findAll({
      where: balanceWhere,
      attributes: ['pmsLeaseId', 'balanceCents'],
      include: [
        {
          model: PmsLease,
          as: 'pmsLease',
          required: true,
          attributes: ['id', 'leaseNumber', 'externalId', 'riskTier'],
          include: [
            { model: PmsDebtor, as: 'pmsDebtor', required: true, attributes: ['id', 'displayName'] },
            {
              model: PmsProperty,
              as: 'pmsProperty',
              required: false,
              attributes: ['id'],
              include: [
                {
                  model: PmsPortfolio,
                  as: 'pmsPortfolio',
                  required: false,
                  attributes: ['id', 'name'],
                },
              ],
            },
          ],
        },
      ],
      raw: true,
    });

    const items = (balances || []).map((row) => ({
      leaseId: row['pmsLease.id'],
      leaseNumber: row['pmsLease.leaseNumber'] || row['pmsLease.externalId'] || '—',
      debtorName: row['pmsLease.pmsDebtor.displayName'] || '—',
      portfolioName: row['pmsLease.pmsProperty.pmsPortfolio.name'] || '—',
      riskTier: row['pmsLease.riskTier'] || 'al_dia',
      balanceCents: Number(row.balanceCents) || 0,
    }));

    const tierOrder = { critico: 5, alto: 4, medio: 3, bajo: 2, al_dia: 1 };
    if (sortBy === 'risk') {
      items.sort((a, b) => (tierOrder[b.riskTier] || 0) - (tierOrder[a.riskTier] || 0));
    } else if (sortBy === 'balance') {
      items.sort((a, b) => b.balanceCents - a.balanceCents);
    }

    return items.slice(0, limit);
  },
};
