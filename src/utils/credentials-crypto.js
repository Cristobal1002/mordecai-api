/**
 * Encrypt/decrypt PMS connection credentials at rest.
 * Uses AES-256-GCM. Key must be 32 bytes (base64 or hex).
 *
 * CREDENTIALS_ENCRYPTION_KEY format:
 *   - Base64-encoded 32-byte key (recommended).
 *   - Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *   - Or:      openssl rand -base64 32
 */
import crypto from 'crypto';
import { config } from '../config/index.js';
import { ServiceUnavailableError } from '../errors/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PAYLOAD_VERSION = 1;

function getKeyBuffer() {
  const raw = config.credentialsEncryptionKey;
  if (!raw || typeof raw !== 'string') {
    throw new ServiceUnavailableError(
      'Credentials encryption is not configured. Set CREDENTIALS_ENCRYPTION_KEY in the server environment (e.g. a base64 32-byte key: openssl rand -base64 32).'
    );
  }
  const key =
    raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new ServiceUnavailableError(
      `CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Generate with: openssl rand -base64 32`
    );
  }
  return key;
}

/**
 * Encrypt a credentials object for storage. Returns a JSON-serializable object.
 * @param {Record<string, string>} plain - e.g. { accessKey, secret, account }
 * @returns {object} { v, iv, authTag, cipher } (all base64)
 */
export function encryptCredentials(plain) {
  if (plain == null || (typeof plain === 'object' && Object.keys(plain).length === 0)) {
    return null;
  }
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const json = JSON.stringify(plain);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    v: PAYLOAD_VERSION,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    cipher: encrypted.toString('base64'),
  };
}

/**
 * Decrypt stored credentials. Accepts the value stored in DB (object with v, iv, authTag, cipher).
 * @param {object | null} stored - encrypted payload or null
 * @returns {Record<string, string> | null}
 */
export function decryptCredentials(stored) {
  if (stored == null) return null;
  if (typeof stored !== 'object' || stored.v !== PAYLOAD_VERSION) {
    throw new ServiceUnavailableError('Invalid or unsupported credentials payload (wrong format or version)');
  }
  const { iv, authTag, cipher } = stored;
  if (!iv || !authTag || !cipher) {
    throw new ServiceUnavailableError('Invalid credentials payload: missing iv, authTag, or cipher');
  }
  const key = getKeyBuffer();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const decrypted = decipher.update(cipher, 'base64', 'utf8') + decipher.final('utf8');
  return JSON.parse(decrypted);
}

/**
 * Returns true if the value looks like our encrypted payload (so we don't double-encrypt).
 */
export function isEncryptedPayload(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    value.v === PAYLOAD_VERSION &&
    typeof value.iv === 'string' &&
    typeof value.authTag === 'string' &&
    typeof value.cipher === 'string'
  );
}
