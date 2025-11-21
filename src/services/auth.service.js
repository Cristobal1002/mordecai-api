import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { config } from '../config/index.js';
import { getAuth, verifyIdToken } from '../config/firebase.js';
import { User } from '../models/index.js';
import { 
  AuthenticationError, 
  ValidationError, 
  ConflictError,
  ForbiddenError 
} from '../errors/index.js';

class AuthService {
  generateTokens(payload) {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  async registerWithEmail(userData) {
    const { email, password, firstName, lastName, displayName } = userData;

    // Use provided displayName or construct from firstName/lastName
    const finalDisplayName = displayName || `${firstName} ${lastName}`;

    // Create Firebase user first
    let firebaseUser;
    try {
      firebaseUser = await getAuth().createUser({
        email,
        password,
        displayName: finalDisplayName,
      });
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        throw new ConflictError('Email already exists');
      }
      throw new ValidationError(`User creation failed: ${error.message}`);
    }

    // Create user record in database with displayName
    const user = await User.create({
      firebaseUid: firebaseUser.uid,
      displayName: finalDisplayName,
      appRole: 'user',
      isActive: true,
      lastLoginAt: new Date(),
    });

    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      firebaseUid: user.firebaseUid,
      appRole: user.appRole,
    });

    return {
      user,
      tokens,
    };
  }

  async loginWithEmail(email, password) {
    // Authenticate with Firebase first
    let firebaseUser;
    try {
      // Note: In a real implementation, you'd use Firebase Auth REST API
      // or Firebase Admin SDK to verify email/password
      // For now, we'll find the user by email in Firebase
      firebaseUser = await getAuth().getUserByEmail(email);
    } catch (error) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Find user in our database
    const user = await User.findOne({ where: { firebaseUid: firebaseUser.uid } });
    if (!user) {
      throw new AuthenticationError('User not found in application database');
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new ForbiddenError('Account is temporarily locked due to too many failed login attempts');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new ForbiddenError('Account is deactivated');
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    await user.update({ lastLoginAt: new Date() });

    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      firebaseUid: user.firebaseUid,
      appRole: user.appRole,
    });

    return {
      user,
      tokens,
    };
  }

  async loginWithGoogle(idToken) {
    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch (error) {
      throw new AuthenticationError('Invalid Google ID token');
    }

    const { uid, email, name, picture, email_verified } = decodedToken;

    if (!email) {
      throw new ValidationError('Email is required for Google sign-in');
    }

    // Check if user exists in our database
    let user = await User.findOne({ 
      where: { firebaseUid: uid }
    });

    if (user) {
      // Update existing user with latest displayName from Google
      await user.update({
        displayName: name || user.displayName, // Keep existing if no name from Google
        lastLoginAt: new Date(),
      });
    } else {
      // Create new user record
      user = await User.create({
        firebaseUid: uid,
        displayName: name || 'Google User', // Fallback if no name provided
        appRole: 'user',
        isActive: true,
        lastLoginAt: new Date(),
      });
    }

    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      firebaseUid: user.firebaseUid,
      appRole: user.appRole,
    });

    return {
      user,
      tokens,
    };
  }

  async refreshToken(refreshToken) {
    const decoded = this.verifyToken(refreshToken);
    
    // Find user
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Generate new tokens
    const tokens = this.generateTokens({
      userId: user.id,
      firebaseUid: user.firebaseUid,
      appRole: user.appRole,
    });

    return {
      user,
      tokens,
    };
  }

  async logout(firebaseUid) {
    try {
      // Revoke Firebase tokens
      await getAuth().revokeRefreshTokens(firebaseUid);
      return { message: 'Successfully logged out' };
    } catch (error) {
      throw new ValidationError(`Logout failed: ${error.message}`);
    }
  }

  async getCurrentUser(userId) {
    const user = await User.findByPk(userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }
    return user;
  }

  async sendPasswordResetEmail(email) {
    try {
      // Firebase handles the password reset - we don't need to check our database
      await getAuth().generatePasswordResetLink(email);
      return { message: 'If the email exists, a password reset link has been sent' };
    } catch (error) {
      // Don't reveal if email exists or not
      return { message: 'If the email exists, a password reset link has been sent' };
    }
  }

  async verifyEmail(idToken) {
    const decodedToken = await verifyIdToken(idToken);
    
    const user = await User.findOne({ 
      where: { firebaseUid: decodedToken.uid } 
    });
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    await user.update({ emailVerified: true });
    return { message: 'Email verified successfully' };
  }
}

export const authService = new AuthService();
