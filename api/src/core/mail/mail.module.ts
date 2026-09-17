import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { createMailTransporter, MAIL_TRANSPORTER } from './mail.config';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORTER,
      useFactory: async () => createMailTransporter(),
    },
    MailService,
  ],
  exports: [MailService, MAIL_TRANSPORTER],
})
export class MailModule {}
