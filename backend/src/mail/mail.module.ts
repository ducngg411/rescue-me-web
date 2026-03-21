import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { join } from 'path';

@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (config: ConfigService) => {
                const port = Number(config.get<string>('MAIL_PORT')) || 587;
                // Gmail app passwords are shown as "xxxx xxxx xxxx xxxx"; SMTP expects 16 chars without spaces.
                const mailUser = config.get<string>('MAIL_USER')?.trim() ?? '';
                const mailPass =
                    config.get<string>('MAIL_PASS')?.replace(/\s+/g, '') ?? '';
                return {
                    transport: {
                        host: config.get<string>('MAIL_HOST'),
                        port,
                        secure: port === 465,
                        requireTLS: port === 587,
                        auth: {
                            user: mailUser,
                            pass: mailPass,
                        },
                    },
                    defaults: {
                        from: config.get<string>('MAIL_FROM'),
                    },
                    template: {
                        // Compiled JS lives under dist/src/mail; nest-cli assets emit templates to dist/mail/templates
                        dir: join(__dirname, '..', '..', 'mail', 'templates'),
                        adapter: new HandlebarsAdapter(),
                        options: {
                            strict: true,
                        },
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
