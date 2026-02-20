import { listDemoCallsForUser, startDemoCall, startDemoSms } from './demo.service.js';

const validateDemoToken = (req, res) => {
  const requiredToken = process.env.DEMO_API_TOKEN;
  const providedToken =
    req.get('x-demo-token') || req.get('authorization')?.replace(/^Bearer /i, '');

  if (requiredToken && providedToken !== requiredToken) {
    res.status(401).json({
      success: false,
      message: 'Invalid demo token',
    });
    return false;
  }

  return true;
};

export const demoController = {
  listCalls: async (req, res, next) => {
    try {
      const calls = await listDemoCallsForUser({
        req,
        limit: req.query?.limit,
      });

      return res.ok(calls, 'Demo calls fetched');
    } catch (error) {
      return next(error);
    }
  },

  startCall: async (req, res, next) => {
    try {
      if (!validateDemoToken(req, res)) {
        return;
      }

      const result = await startDemoCall(req.body || {});
      if (!result.ok) {
        return res.status(result.status || 400).json({
          success: false,
          message: result.message || 'Could not start demo call',
        });
      }

      return res.status(result.status || 201).json({
        success: true,
        message: 'Demo call started',
        data: result.data,
      });
    } catch (error) {
      return next(error);
    }
  },

  startSms: async (req, res, next) => {
    try {
      if (!validateDemoToken(req, res)) {
        return;
      }

      const result = await startDemoSms(req.body || {});
      if (!result.ok) {
        return res.status(result.status || 400).json({
          success: false,
          message: result.message || 'Could not send demo SMS',
        });
      }

      return res.status(result.status || 201).json({
        success: true,
        message: 'Demo SMS sent',
        data: result.data,
      });
    } catch (error) {
      return next(error);
    }
  },
};
