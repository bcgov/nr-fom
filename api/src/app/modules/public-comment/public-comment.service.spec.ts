import { PublicCommentService } from './public-comment.service';

describe('PublicCommentService DATA_ENCRYPTION_KEY', () => {
  const original = process.env.DATA_ENCRYPTION_KEY;
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATA_ENCRYPTION_KEY;
    } else {
      process.env.DATA_ENCRYPTION_KEY = original;
    }
  });

  it('throws when DATA_ENCRYPTION_KEY is unset', () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(() => new PublicCommentService({} as any, logger, {} as any)).toThrow('DATA_ENCRYPTION_KEY');
  });

  it('throws when DATA_ENCRYPTION_KEY is empty', () => {
    process.env.DATA_ENCRYPTION_KEY = '';
    expect(() => new PublicCommentService({} as any, logger, {} as any)).toThrow('DATA_ENCRYPTION_KEY');
  });

  it('constructs when DATA_ENCRYPTION_KEY is set', () => {
    process.env.DATA_ENCRYPTION_KEY = 'some-key';
    expect(() => new PublicCommentService({} as any, logger, {} as any)).not.toThrow();
  });
});
