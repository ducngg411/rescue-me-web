import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

export interface FcmPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseService.name);
    private app: admin.app.App | null = null;

    onModuleInit() {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!projectId || !clientEmail || !privateKey || privateKey.includes('YOUR_PRIVATE_KEY_HERE')) {
            this.logger.warn('Firebase Admin SDK not configured — phone auth and FCM will be unavailable.');
            return;
        }

        if (admin.apps.length === 0) {
            this.app = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            this.logger.log('Firebase Admin SDK initialized.');
        } else {
            this.app = admin.apps[0]!;
        }
    }

    async verifyPhoneToken(firebaseIdToken: string): Promise<{ phoneNumber: string }> {
        if (!this.app) {
            throw new Error('Firebase Admin SDK chưa được cấu hình');
        }

        const decoded = await admin.auth(this.app).verifyIdToken(firebaseIdToken);

        if (!decoded.phone_number) {
            throw new Error('Firebase token không chứa số điện thoại');
        }

        return { phoneNumber: decoded.phone_number };
    }

    /**
     * Send FCM push notification to a single device token.
     * Returns true if successful, false otherwise (token invalid / app not configured).
     */
    async sendToDevice(fcmToken: string, payload: FcmPayload): Promise<boolean> {
        if (!this.app) return false;

        try {
            await admin.messaging(this.app).send({
                token: fcmToken,
                notification: {
                    title: payload.title,
                    body: payload.body,
                },
                data: payload.data ?? {},
                webpush: {
                    notification: {
                        title: payload.title,
                        body: payload.body,
                        icon: '/RescueMe_Logo.svg',
                        badge: '/RescueMe_Logo.svg',
                        requireInteraction: true,  // keep notification until user interacts
                        vibrate: [200, 100, 200],
                    },
                    fcmOptions: {
                        link: payload.data?.url ?? '/provider/active',
                    },
                },
            });
            return true;
        } catch (err: any) {
            // Common: token expired / unregistered — not an error worth logging loudly
            if (err.code === 'messaging/registration-token-not-registered' ||
                err.code === 'messaging/invalid-registration-token') {
                this.logger.debug(`FCM token invalid/expired — skipping: ${fcmToken.slice(0, 20)}...`);
            } else {
                this.logger.warn(`FCM sendToDevice failed: ${err.message}`);
            }
            return false;
        }
    }

    /**
     * Send FCM push notification to multiple device tokens (up to 500 per call).
     * Returns count of successfully sent messages.
     */
    async sendMulticast(fcmTokens: string[], payload: FcmPayload): Promise<number> {
        if (!this.app || fcmTokens.length === 0) return 0;

        // FCM multicast max 500 tokens per call — chunk if needed
        const chunks: string[][] = [];
        for (let i = 0; i < fcmTokens.length; i += 500) {
            chunks.push(fcmTokens.slice(i, i + 500));
        }

        let successCount = 0;

        for (const chunk of chunks) {
            try {
                const response = await admin.messaging(this.app).sendEachForMulticast({
                    tokens: chunk,
                    notification: {
                        title: payload.title,
                        body: payload.body,
                    },
                    data: payload.data ?? {},
                    webpush: {
                        notification: {
                            title: payload.title,
                            body: payload.body,
                            icon: '/RescueMe_Logo.svg',
                            badge: '/RescueMe_Logo.svg',
                            requireInteraction: true,
                            vibrate: [200, 100, 200],
                        },
                        fcmOptions: {
                            link: payload.data?.url ?? '/provider/active',
                        },
                    },
                });
                successCount += response.successCount;
                if (response.failureCount > 0) {
                    this.logger.debug(`FCM multicast: ${response.successCount} sent, ${response.failureCount} failed`);
                }
            } catch (err: any) {
                this.logger.warn(`FCM sendMulticast chunk failed: ${err.message}`);
            }
        }

        return successCount;
    }
}
