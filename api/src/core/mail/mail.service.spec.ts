import { Test, TestingModule } from '@nestjs/testing';
import { MailerModule, MailerService } from '@nestjs-modules/mailer';
import { PinoLogger } from 'nestjs-pino';
import { MailService } from './mail.service';
import { Project } from '../../app/modules/project/project.entity';
import { District } from '../../app/modules/district/district.entity';
import { ForestClient } from '../../app/modules/forest-client/forest-client.entity';
import { mockLoggerFactory } from '../../app/factories/mock-logger.factory';

describe('MailService', () => {
  let service: MailService;
  let mockMailerService: { sendMail: jest.Mock };
  const originalEnv = process.env;

  const createMockProject = (): Project => {
    const project = new Project();
    project.id = 1001;
    project.name = 'Test Project';

    const district = new District();
    district.id = 1;
    district.name = 'Cascades Natural Resource District';
    district.email = 'FLNR.CascadesDistrict';
    project.district = district;

    const forestClient = new ForestClient();
    forestClient.id = '00001011';
    forestClient.name = 'Test Forest Client Ltd';
    project.forestClient = forestClient;

    return project;
  };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.FOM_EMAIL_NOTIFY;
    delete process.env.HOSTNAME;

    mockMailerService = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mockMailerService },
        { provide: PinoLogger, useValue: mockLoggerFactory() },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendDistrictNotification', () => {
    it('sends email to district address in PROD when FOM_EMAIL_NOTIFY is unset', async () => {
      const project = createMockProject();

      await service.sendDistrictNotification(project);

      expect(mockMailerService.sendMail).toHaveBeenCalledTimes(1);
      const callArg = mockMailerService.sendMail.mock.calls[0][0];

      expect(callArg.to).toBe('FLNR.CascadesDistrict@gov.bc.ca');
      expect(callArg.from).toBe('"FOMDoNotReply" <Do-Not-Reply@gov.bc.ca');
      expect(callArg.subject).toContain('New Final FOM submission received for http://localhost:4200/admin/');
      expect(callArg.html).toContain('FOM 1001 Test Project Test Forest Client Ltd has been finalized');
      expect(callArg.html).toContain('http://localhost:4200/admin/a/1001');
    });

    it('overrides recipient address when FOM_EMAIL_NOTIFY environment variable is set', async () => {
      process.env.FOM_EMAIL_NOTIFY = 'dev-team@example.com';
      const project = createMockProject();

      await service.sendDistrictNotification(project);

      expect(mockMailerService.sendMail).toHaveBeenCalledTimes(1);
      const callArg = mockMailerService.sendMail.mock.calls[0][0];
      expect(callArg.to).toBe('dev-team@example.com');
    });

    it('uses HOSTNAME in view link and subject when set', async () => {
      process.env.HOSTNAME = 'fom.nrs.gov.bc.ca';
      const project = createMockProject();

      await service.sendDistrictNotification(project);

      expect(mockMailerService.sendMail).toHaveBeenCalledTimes(1);
      const callArg = mockMailerService.sendMail.mock.calls[0][0];
      expect(callArg.subject).toContain('https://fom.nrs.gov.bc.ca/admin/');
      expect(callArg.html).toContain('https://fom.nrs.gov.bc.ca/admin/a/1001');
    });

    it('propagates error when mailerService fails', async () => {
      mockMailerService.sendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));
      const project = createMockProject();

      await expect(service.sendDistrictNotification(project)).rejects.toThrow('SMTP connection refused');
    });
  });

  describe('Nodemailer runtime integration (jsonTransport)', () => {
    it('compiles message structure through real MailerService and Nodemailer v10 without sending email', async () => {
      const integrationModule: TestingModule = await Test.createTestingModule({
        imports: [
          MailerModule.forRoot({
            transport: {
              jsonTransport: true,
            },
            defaults: {
              from: '"No Reply" <noreply@example.com>',
            },
          }),
        ],
        providers: [
          MailService,
          { provide: PinoLogger, useValue: mockLoggerFactory() },
        ],
      }).compile();

      const realMailService = integrationModule.get<MailService>(MailService);
      const project = createMockProject();

      await expect(realMailService.sendDistrictNotification(project)).resolves.not.toThrow();
    });
  });
});
