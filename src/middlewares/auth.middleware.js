import { authService } from '../services/auth.service.js';
import { AuthenticationError } from '../errors/index.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token is required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = authService.verifyToken(token);
    
    // Get current user
    const user = await authService.getCurrentUser(decoded.userId);
    
    req.user = user;
    req.userId = user.id;
    req.firebaseUid = user.firebaseUid;
    
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = authService.verifyToken(token);
      const user = await authService.getCurrentUser(decoded.userId);
      
      req.user = user;
      req.userId = user.id;
      req.firebaseUid = user.firebaseUid;
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    next();
  }
};
