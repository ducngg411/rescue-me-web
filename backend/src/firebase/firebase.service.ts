import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseService.name);
    private app: admin.app.App;

    onModuleInit() {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!projectId || !clientEmail || !privateKey || privateKey.includes('YOUR_PRIVATE_KEY_HERE')) {
            this.logger.warn('Firebase Admin SDK not configured — phone auth will be unavailable.');
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
}
