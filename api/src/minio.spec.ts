import { s3Client, verifyObjectStorageConnection } from './minio';

describe('verifyObjectStorageConnection', () => {
  const env = process.env;
  const flush = () => new Promise(resolve => setImmediate(resolve));

  beforeEach(() => {
    process.env = { ...env, OBJECT_STORAGE_ACCESS_ID: 'id', OBJECT_STORAGE_SECRET: 'secret' };
  });

  afterEach(() => {
    process.env = env;
    jest.restoreAllMocks();
  });

  it('logs the bucket count on success', async () => {
    jest.spyOn(s3Client, 'send').mockImplementation(async () => ({ Buckets: [{}, {}] }));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    verifyObjectStorageConnection();
    await flush();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Buckets accessible = 2'));
  });

  it('logs an error when object storage is unreachable', async () => {
    jest.spyOn(s3Client, 'send').mockImplementation(async () => {
      throw new Error('Object storage connection timeout');
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    verifyObjectStorageConnection();
    await flush();

    expect(errorSpy).toHaveBeenCalledWith('Error connecting to object storage', expect.any(Error));
  });

  it('skips the check without credentials', () => {
    delete process.env.OBJECT_STORAGE_SECRET;
    const sendSpy = jest.spyOn(s3Client, 'send');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    verifyObjectStorageConnection();

    expect(errorSpy).toHaveBeenCalledWith('Object storage credentials not provided.');
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
