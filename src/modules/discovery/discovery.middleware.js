import { config } from '../../config/index.js';

/**
 * Optional shared secret for public discovery writes (header x-mordecai-discovery-secret).
 * If DISCOVERY_INGEST_SECRET is unset, no check is applied.
 */
export const discoveryIngestSecretGuard = (req, res, next) => {
  const secret = config.discovery?.ingestSecret;
  if (!secret) {
    return next();
  }
  const sent = req.get('x-mordecai-discovery-secret');
  if (sent !== secret) {
    return res.status(403).json({
      success: false,
      message: 'Discovery ingest not authorized.',
    });
  }
  return next();
};
