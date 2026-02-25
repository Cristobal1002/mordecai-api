import { Router } from 'express';
import health from './health.route.js';

import exampleRoutes from '../modules/example/example.routes.js';
import tenantRoutes from '../modules/tenants/tenant.routes.js';
import flowPolicyRoutes from '../modules/flow-policies/flow-policy.routes.js';
import strategyRoutes from '../modules/strategies/strategy.routes.js';
import templateRoutes from '../modules/templates/template.routes.js';
import paymentChannelRoutes from '../modules/payment-channels/payment-channel.routes.js';
import automationRoutes from '../modules/automations/automation.routes.js';
import caseRoutes from '../modules/cases/case.routes.js';
import propertyManagersRoutes from '../modules/property-managers/property-managers.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import importRoutes from '../modules/imports/import.routes.js';
import debtorRoutes from '../modules/debtors/debtor.routes.js';
import debtCaseRoutes from '../modules/debt-cases/debt-case.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import membershipRoutes from '../modules/memberships/membership.routes.js';
import brandingRoutes from '../modules/branding/branding.routes.js';
import invitationRoutes from '../modules/invitations/invitation.routes.js';
import twilioRoutes from '../modules/twilio/twilio.routes.js';
import catalogRoutes from '../modules/catalog/catalog.routes.js';
import elevenRoutes from '../modules/elevenlabs/eleven.routes.js';
import demoRoutes from '../modules/demo/demo.routes.js';
import payRoutes from '../modules/pay/pay.routes.js';

import { config } from '../config/index.js';

const routes = (app) => {
  const router = Router();

  router.use('/health', health);
  // Agregar módulos aquí
  router.use('/examples', exampleRoutes);
  router.use('/auth', authRoutes);
  router.use('/catalog', catalogRoutes);
  router.use('/tenants', tenantRoutes);
  router.use('/tenants', membershipRoutes);
  router.use('/tenants', brandingRoutes);
  router.use('/invitations', invitationRoutes);
  router.use('/tenants', flowPolicyRoutes);
  router.use('/tenants', strategyRoutes);
  router.use('/tenants', templateRoutes);
  router.use('/tenants', paymentChannelRoutes);
  router.use('/tenants', automationRoutes);
  router.use('/tenants', caseRoutes);
  router.use('/tenants', propertyManagersRoutes);
  router.use('/tenants', dashboardRoutes);
  router.use('/import-batches', importRoutes);
  router.use('/debtors', debtorRoutes);
  router.use('/debt-cases', debtCaseRoutes);
  router.use('/twilio', twilioRoutes);
  router.use('/eleven', elevenRoutes);
  router.use('/demo', demoRoutes);

  app.use(`/api/${config.app.apiVersion}`, router);

  // Public payment link routes (no auth) — /pay/:token
  app.use('/pay', payRoutes);
};

export default routes;
