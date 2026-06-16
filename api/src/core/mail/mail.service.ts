import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Project } from '../../app/modules/project/project.entity';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService, private logger: PinoLogger) {}

  async sendDistrictNotification(project: Project) {

    // Email address used for PROD, populated from the Db
    const districtEmail = project.district!.email + "@gov.bc.ca"; // production - table stores emails without the @gov.bc.ca suffix.

    // Use ${districtEmail} in PROD, otherwise provided in var for lower environments (DEV, TEST, DEMO)
    const to = process.env.FOM_EMAIL_NOTIFY ? `${process.env.FOM_EMAIL_NOTIFY}` : `${districtEmail}`

    // Link to FOM
    const host = process.env.HOSTNAME? `https://${process.env.HOSTNAME}`: 'http://localhost:4200';
    const fomViewLink = `${host}/admin/a/${project.id}`;

    // From email address
    const from = '"FOMDoNotReply" <Do-Not-Reply@gov.bc.ca'; // override default from;

    // Log and send email
    this.logger.info(`Sending FOM ${project.id} finalized notification email to ${to}`);
    await this.mailerService.sendMail({
      to: to,
      from: from,
      subject: `New Final FOM submission received for ${host}/admin/`,
      html: `<h3>FOM ${project.id} ${project.name} ${project.forestClient.name} has been finalized and is available for review.</h3>
        <p>
          Please use this <a href="${fomViewLink}" target="_blank">link</a> to access FOM details.
        </p>
      `
    });
  }
}
