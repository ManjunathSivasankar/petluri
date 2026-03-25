const fs = require('fs');
const path = require('path');

const normalizeUrlBase = (value = '') => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return withProtocol.replace(/\/$/, '');
};

const getB2Config = () => ({
    endpoint: normalizeUrlBase(process.env.B2_S3_ENDPOINT || process.env.B2_ENDPOINT || ''),
    bucket: process.env.B2_BUCKET_NAME || '',
    keyId: process.env.B2_KEY_ID || '',
    appKey: process.env.B2_APP_KEY || process.env.B2_APPLICATION_KEY || '',
    region: process.env.B2_REGION || 'us-east-005',
    publicBaseUrl: normalizeUrlBase(process.env.B2_PUBLIC_BASE_URL || '')
});

const isBackblazeEnabled = () => {
    const cfg = getB2Config();
    return Boolean(
        cfg.endpoint &&
        cfg.bucket &&
        cfg.keyId &&
        cfg.appKey
    );
};

const toPublicUrlFromLocalPath = (filePath) => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const match = normalizedPath.match(/public\/(.*)/);
    const relativePath = match ? match[1] : normalizedPath;
    return `/${relativePath}`;
};

const uploadVideoFile = async (file) => {
    if (!file) throw new Error('No file provided for upload');

    const toLocalPayload = () => ({
        provider: 'local',
        url: toPublicUrlFromLocalPath(file.path),
        key: file.filename,
        fileName: file.originalname,
        fileSizeBytes: file.size
    });

    if (!isBackblazeEnabled()) {
        return toLocalPayload();
    }

    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const cfg = getB2Config();
    const endpoint = cfg.endpoint;
    const bucket = cfg.bucket;
    const keyPrefix = process.env.B2_VIDEO_PREFIX || 'videos';
    const key = `${keyPrefix}/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;

    const client = new S3Client({
        region: cfg.region,
        endpoint,
        forcePathStyle: true,
        credentials: {
            accessKeyId: cfg.keyId,
            secretAccessKey: cfg.appKey
        }
    });

    const fileBuffer = fs.readFileSync(file.path);

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: fileBuffer,
            ContentType: file.mimetype || 'video/mp4'
        }));
    } catch (error) {
        console.error('Backblaze upload failed, falling back to local storage:', error.message);
        return toLocalPayload();
    }

    const publicBase = cfg.publicBaseUrl || `${endpoint}/${bucket}`;
    const url = `${publicBase}/${key}`;

    try {
        fs.unlinkSync(file.path);
    } catch (err) {
        console.warn('Could not remove local temp video after Backblaze upload:', err.message);
    }

    return {
        provider: 'backblaze',
        url,
        key,
        fileName: file.originalname,
        fileSizeBytes: file.size
    };
};

const deleteVideoFile = async ({ provider = 'local', key = '', url = '' }) => {
    if (provider === 'backblaze' && key && isBackblazeEnabled()) {
        const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const cfg = getB2Config();
        const client = new S3Client({
            region: cfg.region,
            endpoint: cfg.endpoint,
            forcePathStyle: true,
            credentials: {
                accessKeyId: cfg.keyId,
                secretAccessKey: cfg.appKey
            }
        });

        await client.send(new DeleteObjectCommand({
            Bucket: cfg.bucket,
            Key: key
        }));
        return;
    }

    if (url && url.startsWith('/uploads/')) {
        const localPath = path.join(__dirname, '..', 'public', url.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
        }
    }
};

module.exports = {
    uploadVideoFile,
    deleteVideoFile
};
