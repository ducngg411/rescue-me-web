import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = process.env.ADMIN_EMAIL ?? 'admin@rescue.com';
    const password = process.env.ADMIN_PASSWORD ?? 'Admin@123';

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.upsert({
        where: { email },
        update: {
            role: 'ADMIN',
            hashedPassword,
        },
        create: {
            email,
            hashedPassword,
            authProvider: 'EMAIL',
            fullName: 'System Administrator',
            phoneNumber: '0900000000',
            role: 'ADMIN',
            profileCompleted: true,
        },
    });

    console.log(' Admin user ready:');
    console.log('   Email   :', admin.email);
    console.log('   Password:', password);
    console.log('   Role    :', admin.role);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
