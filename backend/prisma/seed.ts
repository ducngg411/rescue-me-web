import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create Admin User
    const adminEmail = 'admin@rescue.com';
    const adminPassword = 'Admin@123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            hashedPassword: hashedPassword,
            authProvider: 'EMAIL',
            fullName: 'System Administrator',
            phoneNumber: '0900000000',
            role: 'ADMIN',
            profileCompleted: true,
        },
    });

    console.log('✅ Admin user created:', {
        email: adminEmail,
        password: adminPassword,
        role: admin.role,
    });

    // Create Test Provider 1 - PENDING
    const pendingProvider = await prisma.user.upsert({
        where: { email: 'provider1@test.com' },
        update: {},
        create: {
            email: 'provider1@test.com',
            hashedPassword: await bcrypt.hash('Provider@123', 10),
            authProvider: 'EMAIL',
            fullName: 'Nguyễn Văn A',
            phoneNumber: '0901111111',
            role: 'PROVIDER',
            providerType: 'INDIVIDUAL',
            serviceName: 'Cứu Hộ Nhanh A',
            address: 'Quận 1, TP.HCM',
            serviceRadiusKm: 20,
            pricePerKm: 15000,
            baseFee: 200000,
            emergencyAvailable: true,
            carPlateNumber: '59A-12345',
            motorcyclePlateNumber: '51G-67890',
            verificationStatus: 'PENDING',
            submittedAt: new Date(),
            profileCompleted: true,
        },
    });

    console.log('✅ Pending provider created:', pendingProvider.email);

    // Create Test Provider 2 - APPROVED
    const approvedProvider = await prisma.user.upsert({
        where: { email: 'provider2@test.com' },
        update: {},
        create: {
            email: 'provider2@test.com',
            hashedPassword: await bcrypt.hash('Provider@123', 10),
            authProvider: 'EMAIL',
            fullName: 'Trần Thị B',
            phoneNumber: '0902222222',
            role: 'PROVIDER',
            providerType: 'INDIVIDUAL',
            serviceName: 'Sửa Xe Đường B',
            address: 'Quận 3, TP.HCM',
            serviceRadiusKm: 15,
            pricePerKm: 10000,
            baseFee: 150000,
            emergencyAvailable: false,
            verificationStatus: 'APPROVED',
            approvedAt: new Date(),
            submittedAt: new Date(Date.now() - 86400000), // 1 day ago
            isOnline: true,
            profileCompleted: true,
        },
    });

    console.log('✅ Approved provider created:', approvedProvider.email);

    // Create Test Provider 3 - REJECTED
    const rejectedProvider = await prisma.user.upsert({
        where: { email: 'provider3@test.com' },
        update: {},
        create: {
            email: 'provider3@test.com',
            hashedPassword: await bcrypt.hash('Provider@123', 10),
            authProvider: 'EMAIL',
            fullName: 'Lê Văn C',
            phoneNumber: '0903333333',
            role: 'PROVIDER',
            providerType: 'BUSINESS',
            serviceName: 'Cứu Hộ C',
            address: 'Quận 5, TP.HCM',
            serviceRadiusKm: 10,
            pricePerKm: 20000,
            baseFee: 250000,
            emergencyAvailable: true,
            carPlateNumber: '59B-11111',
            verificationStatus: 'REJECTED',
            rejectReasonCode: 'INVALID_LICENSE',
            rejectReasonDetail: 'Giấy phép kinh doanh không hợp lệ',
            submittedAt: new Date(Date.now() - 172800000), // 2 days ago
            profileCompleted: true,
        },
    });

    console.log('✅ Rejected provider created:', rejectedProvider.email);

    // Create Test Provider 4 - SUSPENDED
    const suspendedProvider = await prisma.user.upsert({
        where: { email: 'provider4@test.com' },
        update: {},
        create: {
            email: 'provider4@test.com',
            hashedPassword: await bcrypt.hash('Provider@123', 10),
            authProvider: 'EMAIL',
            fullName: 'Phạm Thị D',
            phoneNumber: '0904444444',
            role: 'PROVIDER',
            providerType: 'BUSINESS',
            serviceName: 'Sửa Xe D',
            address: 'Quận 7, TP.HCM',
            serviceRadiusKm: 25,
            pricePerKm: 12000,
            baseFee: 180000,
            emergencyAvailable: true,
            verificationStatus: 'SUSPENDED',
            suspendedAt: new Date(),
            suspensionReason: 'Nhiều khiếu nại từ khách hàng',
            approvedAt: new Date(Date.now() - 259200000), // 3 days ago
            submittedAt: new Date(Date.now() - 345600000), // 4 days ago
            isOnline: false,
            profileCompleted: true,
        },
    });

    console.log('✅ Suspended provider created:', suspendedProvider.email);

    // Create Test Provider 5 - DRAFT
    const draftProvider = await prisma.user.upsert({
        where: { email: 'provider5@test.com' },
        update: {},
        create: {
            email: 'provider5@test.com',
            hashedPassword: await bcrypt.hash('Provider@123', 10),
            authProvider: 'EMAIL',
            fullName: 'Hoàng Văn E',
            phoneNumber: '0905555555',
            role: 'PROVIDER',
            providerType: 'INDIVIDUAL',
            verificationStatus: 'DRAFT',
            profileCompleted: false,
        },
    });

    console.log('✅ Draft provider created:', draftProvider.email);

    // Create Regular Users
    const user1 = await prisma.user.upsert({
        where: { email: 'user1@test.com' },
        update: {},
        create: {
            email: 'user1@test.com',
            hashedPassword: await bcrypt.hash('User@123', 10),
            authProvider: 'EMAIL',
            fullName: 'Nguyễn Thị F',
            phoneNumber: '0906666666',
            role: 'USER',
            profileCompleted: true,
        },
    });

    console.log('✅ Regular user created:', user1.email);

    console.log('\n✨ Database seeding completed!');
    console.log('\n📋 Test Accounts:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ ADMIN ACCOUNT                                           │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ Email:    ${adminEmail.padEnd(43)} │`);
    console.log(`│ Password: ${adminPassword.padEnd(43)} │`);
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('\n┌─────────────────────────────────────────────────────────┐');
    console.log('│ PROVIDER ACCOUNTS (Password: Provider@123)              │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ provider1@test.com - PENDING (Cứu Hộ Nhanh A)          │');
    console.log('│ provider2@test.com - APPROVED (Sửa Xe Đường B)          │');
    console.log('│ provider3@test.com - REJECTED (Cứu Hộ C)               │');
    console.log('│ provider4@test.com - SUSPENDED (Sửa Xe D)              │');
    console.log('│ provider5@test.com - DRAFT (Hoàng Văn E)               │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('\n┌─────────────────────────────────────────────────────────┐');
    console.log('│ USER ACCOUNTS (Password: User@123)                      │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ user1@test.com - Regular User                          │');
    console.log('└─────────────────────────────────────────────────────────┘');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
