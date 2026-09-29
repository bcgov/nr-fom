import nodemailer, { Transporter } from 'nodemailer';

export const MAIL_TRANSPORTER = 'MAIL_TRANSPORTER';

export async function getMailConfig(): Promise<any> {
    if (process.env.SMTP_SERVER) {
        return process.env.SMTP_SERVER;
    }
    console.warn('SMTP_SERVER is not set; emails will not be sent.');
    return { jsonTransport: true };
}

export async function createMailTransporter(): Promise<Transporter> {
    const config = await getMailConfig();
    return nodemailer.createTransport({
        secure: true,
        ...(typeof config === 'string' ? { url: config } : config),
    }, {
        from: '"No Reply" <noreply@example.com>',
    });
}
