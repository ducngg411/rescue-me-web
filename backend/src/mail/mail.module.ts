import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { join } from 'path';

/**
 * Custom nodemailer-compatible transport that sends via Resend HTTP API.
 * This bypasses SMTP entirely (needed for DigitalOcean which blocks ports 25/465/587).
 * @nestjs-modules/mailer compiles Handlebars templates → HTML before calling send(),
 * so mail.data.html is already the rendered HTML ready to POST to Resend.
 */
const createResendTransport = (apiKey: string, defaultFrom: string) => ({
    name: 'Resend',
    version: '1.0.0',
    send(mail: any, callback: any) {
        const data = mail.data as Record<string, any>;
        const from = data.from ?? defaultFrom;
        const to: string[] = Array.isArray(data.to) ? data.to : [data.to];

        (async () => {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from,
                    to,
                    subject: data.subject,
                    html: data.html,
                    ...(data.text ? { text: data.text } : {}),
                }),
            });
            const result = (await res.json()) as any;
            if (!res.ok) {
                throw new Error(`Resend API error: ${result?.message ?? JSON.stringify(result)}`);
            }
            callback(null, { messageId: result.id, envelope: { from, to } });
        })().catch((err) => callback(err as Error));
    },
});

@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (config: ConfigService) => {
                const apiKey = (config.get<string>('MAIL_PASS') ?? '').replace(/\s+/g, '');
                const defaultFrom = config.get<string>('MAIL_FROM') ?? 'RescueMe <noreply@rescueme.asia>';
                return {
                    transport: createResendTransport(apiKey, defaultFrom),
                    defaults: { from: defaultFrom },
                    template: {
                        // Dev: src/mail/templates; Prod: dist/mail/templates
                        dir: join(__dirname, 'templates'),
                        adapter: new HandlebarsAdapter(),
                        options: { strict: true },
                    },
                };
            },
            inject: [ConfigService],
        }),
    ],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule {}

