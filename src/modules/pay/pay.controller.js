import { payService } from './pay.service.js';

export const payController = {
  getByToken: async (req, res, next) => {
    try {
      const { token } = req.params;
      const result = await payService.getByToken(token, req);

      if (result.status === 404) {
        return res.status(404).json({ success: false, message: 'Payment link not found' });
      }
      if (result.status === 410) {
        return res.status(410).json({ success: false, message: 'This payment link has expired' });
      }
      if (result.status === 423) {
        return res.status(423).json({ success: false, message: 'This payment link is no longer available' });
      }

      return res.status(200).json({ success: true, data: result.payload });
    } catch (error) {
      next(error);
    }
  },

  verify: async (req, res, next) => {
    try {
      const { token } = req.params;
      const result = await payService.verify(token, req.body);

      if (result.status === 404) {
        return res.status(404).json({ success: false, message: 'Payment link not found' });
      }
      if (result.status === 410) {
        return res.status(410).json({ success: false, message: 'This payment link has expired' });
      }
      if (result.status === 423) {
        return res.status(423).json({ success: false, message: 'This payment link is no longer available' });
      }
      if (result.status === 429) {
        return res.status(429).json({ success: false, message: result.message || 'Too many attempts' });
      }
      if (result.status === 401) {
        return res.status(401).json({ success: false, message: result.message || 'Verification failed' });
      }
      if (result.status === 500) {
        return res.status(500).json({ success: false, message: result.message || 'Internal error' });
      }

      return res.status(200).json({ success: true, data: result.payload });
    } catch (error) {
      next(error);
    }
  },

  getDetails: async (req, res, next) => {
    try {
      const { token } = req.params;
      const authHeader = req.get('Authorization');
      const result = await payService.getDetails(token, authHeader);

      if (result.status === 401) {
        return res.status(401).json({ success: false, message: result.message });
      }
      if (result.status === 404) {
        return res.status(404).json({ success: false, message: 'Payment link not found' });
      }
      if (result.status === 410) {
        return res.status(410).json({ success: false, message: 'This payment link has expired' });
      }

      return res.status(200).json({ success: true, data: result.payload });
    } catch (error) {
      next(error);
    }
  },

  sendOtp: async (req, res, next) => {
    try {
      const { token } = req.params;
      const result = await payService.sendOtp(token);

      if (result.status === 404) return res.status(404).json({ success: false, message: 'Payment link not found' });
      if (result.status === 410) return res.status(410).json({ success: false, message: 'This payment link has expired' });
      if (result.status === 423) return res.status(423).json({ success: false, message: 'This payment link is no longer available' });
      if (result.status === 429) return res.status(429).json({ success: false, message: result.message });
      if (result.status === 400) return res.status(400).json({ success: false, message: result.message });
      if (result.status === 503) return res.status(503).json({ success: false, message: result.message });

      return res.status(200).json({ success: true, data: result.payload });
    } catch (error) {
      next(error);
    }
  },

  verifyOtp: async (req, res, next) => {
    try {
      const { token } = req.params;
      const result = await payService.verifyOtp(token, req.body);

      if (result.status === 404) return res.status(404).json({ success: false, message: 'Payment link not found' });
      if (result.status === 410) return res.status(410).json({ success: false, message: 'This payment link has expired' });
      if (result.status === 423) return res.status(423).json({ success: false, message: 'This payment link is no longer available' });
      if (result.status === 429) return res.status(429).json({ success: false, message: result.message });
      if (result.status === 400) return res.status(400).json({ success: false, message: result.message });
      if (result.status === 401) return res.status(401).json({ success: false, message: result.message });

      return res.status(200).json({ success: true, data: result.payload });
    } catch (error) {
      next(error);
    }
  },
};
