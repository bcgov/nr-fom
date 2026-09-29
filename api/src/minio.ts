import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';

// Default URL if not defined to avoid startup errors in unit tests, batch, etc.
// Path-style and us-east-1 match the previous minio client defaults for non-AWS endpoints.
export const s3Client = new S3Client({
    endpoint: `https://${process.env.OBJECT_STORAGE_URL || 'nrs.objectstore.gov.bc.ca'}`,
    forcePathStyle: true,
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.OBJECT_STORAGE_ACCESS_ID,
        secretAccessKey: process.env.OBJECT_STORAGE_SECRET
    }
});

export function verifyObjectStorageConnection() {
    if (!process.env.OBJECT_STORAGE_ACCESS_ID || !process.env.OBJECT_STORAGE_SECRET) {
        console.error("Object storage credentials not provided.");
        return;
    }
    s3Client.send(new ListBucketsCommand({}))
        .then(({ Buckets }) => {
            console.log('Successful connection to object storage. Buckets accessible = ' + Buckets?.length);
        })
        .catch(err => {
            console.error("Error connecting to object storage", err);
        });
}

verifyObjectStorageConnection();


