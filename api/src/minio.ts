import * as Minio from 'minio';

// Default URL if not defined to avoid startup errors in unit tests, batch, etc.
export const minioClient =  new Minio.Client({
    endPoint:  process.env.OBJECT_STORAGE_URL || 'nrs.objectstore.gov.bc.ca',
    accessKey: process.env.OBJECT_STORAGE_ACCESS_ID,
    secretKey: process.env.OBJECT_STORAGE_SECRET
});

export function verifyObjectStorageConnection() {
    if (!process.env.OBJECT_STORAGE_ACCESS_ID || !process.env.OBJECT_STORAGE_SECRET) {
        console.error("Object storage credentials not provided.");
        return;
    }
    minioClient.listBuckets(function(err, buckets) {
        if (err) { 
         console.error("Error connecting to object storage", err);
         return;
        } 
        
        console.log('Succssful connection to object storage. Buckets accessible = ' + buckets.length);
      });
}

verifyObjectStorageConnection();
