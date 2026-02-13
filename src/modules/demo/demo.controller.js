import { startDemoCall } from './demo.service.js';

export const demoController = {
  startCall: async (req, res, next) => {
    try {
      const requiredToken = process.env.DEMO_API_TOKEN;
      const providedToken =
        req.get('x-demo-token') || req.get('authorization')?.replace(/^Bearer /i, '');

      if (requiredToken && providedToken !== requiredToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid demo token',
        });
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
};
