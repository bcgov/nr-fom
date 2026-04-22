import * as Minio from 'minio';

// Default URL if not defined to avoid startup errors in unit tests, batch, etc.
export const minioClient =  new Minio.Client({
    endPoint:  process.env.OBJECT_STORAGE_URL || 'nrs.objectstore.gov.bc.ca',
    accessKey: process.env.OBJECT_STORAGE_ACCESS_ID,
    secretKey: process.env.OBJECT_STORAGE_SECRET
});

export async function verifyObjectStorageConnection() {
    if (!process.env.OBJECT_STORAGE_ACCESS_ID || !process.env.OBJECT_STORAGE_SECRET) {
        console.error("Object storage credentials not provided.");
        return;
    }
    try {
        const buckets = await minioClient.listBuckets();
        console.log('Succssful connection to object storage. Buckets accessible = ' + buckets.length);
    } catch (err) {
        console.error("Error connecting to object storage", err);
    }
}

if (process.env.OBJECT_STORAGE_ACCESS_ID && process.env.OBJECT_STORAGE_SECRET) {
    verifyObjectStorageConnection();
}
