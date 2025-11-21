import { sequelize } from '../config/database.js';
import { defineUserModel } from './user.model.js';

// Initialize optimized models
export const User = defineUserModel(sequelize);

// Define associations here if needed
// Example: User.hasMany(Post);

export { sequelize };

/**
 * Inicializa todos los modelos de Sequelize y sus relaciones
 * @param {Sequelize} sequelize - Instancia de Sequelize
 */
export const initModels = (sequelize) => {
  // Models are now initialized above with optimized schema
  // The User model now stores minimal data:
  // - firebaseUid (primary identifier)
  // - role (app-specific authorization)
  // - isActive (account status)
  // - preferences (app-specific settings)
  // - security fields (loginAttempts, lockedUntil, lastLoginAt)
  // Firebase handles: email, name, profile picture, email verification
};

