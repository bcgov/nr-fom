import { Test, TestingModule } from '@nestjs/testing';
import { getMailConfig, createMailTransporter, MAIL_TRANSPORTER } from './mail.config';
import { MailModule } from './mail.module';
import { MailService } from './mail.service';
import { mockLoggerFactory } from '../../app/factories/mock-logger.factory';
import { PinoLogger } from 'nestjs-pino';

import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [{ provide: PinoLogger, useValue: mockLoggerFactory() }],
  exports: [PinoLogger],
})
class TestLoggerModule {}

describe('MailConfig and MailModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getMailConfig', () => {
    it('returns SMTP_SERVER when set', async () => {
      process.env.SMTP_SERVER = 'smtp.test.gov.bc.ca';
      const config = await getMailConfig();
      expect(config).toBe('smtp.test.gov.bc.ca');
    });

    it('returns localService when SMTP_SERVER is not set', async () => {
      delete process.env.SMTP_SERVER;
      const config = await getMailConfig();
      expect(config).toEqual({
        host: 'smtp.mailtrap.io',
        port: 465,
        secure: true,
        auth: {
          user: '249d20b3906b70',
          pass: '844353993e632a',
        },
      });
    });
  });

  describe('createMailTransporter', () => {
    it('creates transporter when SMTP_SERVER is set as string', async () => {
      process.env.SMTP_SERVER = 'smtp.test.gov.bc.ca';
      const transporter = await createMailTransporter();
      expect(transporter).toBeDefined();
      expect(typeof transporter.sendMail).toBe('function');
    });

    it('creates transporter when SMTP_SERVER is unset (using localService object)', async () => {
      delete process.env.SMTP_SERVER;
      const transporter = await createMailTransporter();
      expect(transporter).toBeDefined();
      expect(typeof transporter.sendMail).toBe('function');
    });
  });

  describe('MailModule', () => {
    it('compiles module and provides MailService and MAIL_TRANSPORTER', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [TestLoggerModule, MailModule],
      }).compile();

      const transporter = module.get(MAIL_TRANSPORTER);
      const service = module.get<MailService>(MailService);

      expect(transporter).toBeDefined();
      expect(typeof transporter.sendMail).toBe('function');
      expect(service).toBeDefined();
    });
  });
});
