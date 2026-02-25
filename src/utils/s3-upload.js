import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const getS3Client = () => {
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const config = { region };
  if (accessKeyId && secretAccessKey) {
    config.credentials = { accessKeyId, secretAccessKey };
  }
  return new S3Client(config);
};

const getBucketName = () => {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) throw new Error('S3_BUCKET_NAME is required for uploads');
  return bucket;
};

/**
 * Check if logoUrl is an S3 key (stored path) vs a full URL.
 */
export const isS3Key = (logoUrl) =>
  logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('tenants/') && !logoUrl.startsWith('http');

/**
 * Resolve logo URL for display. If it's an S3 key, returns a presigned URL (1h).
 * If it's already a full URL (e.g. public bucket), returns as-is.
 */
export const resolveLogoUrl = async (logoUrl) => {
  if (!logoUrl) return null;
  if (!isS3Key(logoUrl)) return logoUrl;

  const s3 = getS3Client();
  const bucket = getBucketName();
  const command = new GetObjectCommand({ Bucket: bucket, Key: logoUrl });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
};

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Upload branding logo to S3. Returns S3 key (stored in DB; use resolveLogoUrl for display).
 * @param {string} tenantId
 * @param {string} filePath - Local file path (from multer)
 * @param {string} originalName - Original filename for extension
 * @param {string} mimetype
 * @returns {Promise<string>} S3 key (e.g. tenants/xxx/branding/logo.png)
 */
export const uploadBrandingLogo = async (tenantId, filePath, originalName, mimetype) => {
  if (!ALLOWED_LOGO_TYPES.includes(mimetype)) {
    throw new Error('Invalid file type. Use PNG, JPEG, GIF or WebP.');
  }
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_LOGO_SIZE) {
    throw new Error('Logo must be under 2MB.');
  }

  const ext = path.extname(originalName || '') || '.png';
  const key = `tenants/${tenantId}/branding/logo${ext}`;

  const s3 = getS3Client();
  const bucket = getBucketName();
  const body = fs.createReadStream(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimetype,
      CacheControl: 'public, max-age=86400',
    })
  );

  return key;
};
