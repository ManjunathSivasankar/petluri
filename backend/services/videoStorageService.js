const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectVersionsCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

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

// Persistent S3 Client for B2
let _s3Client = null;
const getS3Client = () => {
    if (_s3Client) return _s3Client;
    
    const cfg = getB2Config();
    if (!cfg.endpoint || !cfg.keyId || !cfg.appKey) return null;

    _s3Client = new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        forcePathStyle: false,
        credentials: {
            accessKeyId: cfg.keyId,
            secretAccessKey: cfg.appKey
        },
        // Optimize for streaming
        maxAttempts: 3
    });
    return _s3Client;
};

const toPublicUrlFromLocalPath = (filePath) => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const match = normalizedPath.match(/public\/(.*)/);
    const relativePath = match ? match[1] : normalizedPath;
    return `/${relativePath}`;
};

const uploadVideoFile = async (file) => {
    if (!file) throw new Error('No file provided for upload');

    if (!isBackblazeEnabled()) {
        throw new Error('Backblaze B2 is not configured. Local video storage is disabled.');
    }

    const cfg = getB2Config();
    const client = getS3Client();
    if (!client) throw new Error('Failed to initialize B2 client');

    const bucket = cfg.bucket;
    const keyPrefix = process.env.B2_VIDEO_PREFIX || 'videos';
    const key = `${keyPrefix}/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;

    const fileBuffer = fs.readFileSync(file.path);

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: fileBuffer,
            ContentType: file.mimetype || 'video/mp4'
        }));
    } catch (error) {
        throw new Error(`Backblaze B2 upload failed: ${error.message}`);
    }

    const publicBase = cfg.publicBaseUrl || `${cfg.endpoint}/${bucket}`;
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

const deleteVideoFile = async ({ key = '' }) => {
    if (!key || !isBackblazeEnabled()) return;

    const client = getS3Client();
    if (!client) return;
    
    const cfg = getB2Config();

    try {
        const versions = await client.send(new ListObjectVersionsCommand({
            Bucket: cfg.bucket,
            Prefix: key
        }));

        const toDelete = (versions.Versions || [])
            .filter(v => v.Key === key)
            .map(v => ({ Key: v.Key, VersionId: v.VersionId }));
            
        const markers = (versions.DeleteMarkers || [])
            .filter(m => m.Key === key)
            .map(m => ({ Key: m.Key, VersionId: m.VersionId }));

        const allVersions = [...toDelete, ...markers];

        if (allVersions.length > 0) {
            await client.send(new DeleteObjectsCommand({
                Bucket: cfg.bucket,
                Delete: { Objects: allVersions }
            }));
            console.log(`Permanently deleted ${allVersions.length} versions/markers of ${key}`);
        }
    } catch (error) {
        console.error(`Failed to permanently delete B2 file ${key}:`, error.message);
    }
};

const streamVideoFile = async ({ key, range }) => {
    if (!key || !isBackblazeEnabled()) {
        throw new Error('Backblaze B2 is not enabled or key is missing');
    }

    const client = getS3Client();
    if (!client) throw new Error('B2 S3 Client not initialized');

    const cfg = getB2Config();
    const command = new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Range: range
    });

    return await client.send(command);
};

module.exports = {
    uploadVideoFile,
    deleteVideoFile,
    streamVideoFile
};
