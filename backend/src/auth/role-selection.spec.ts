import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SelectRoleDto } from './dto/auth.dto';
import { UserRole } from '@prisma/client';

describe('AuthController - Role Selection', () => {
    let controller: AuthController;
    let service: AuthService;

    const mockAuthService = {
        selectRole: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<AuthController>(AuthController);
        service = module.get<AuthService>(AuthService);
    });

    describe('POST /auth/profile/select-role', () => {
        it('should select USER role successfully', async () => {
            const dto: SelectRoleDto = { role: UserRole.USER };
            const mockRequest = {
                user: { id: 'test-user-id' },
            };

            const expectedResult = {
                user: {
                    id: 'test-user-id',
                    email: 'test@example.com',
                    role: UserRole.USER,
                    profileCompleted: false,
                },
                message: 'Cập nhật role thành công',
            };

            mockAuthService.selectRole.mockResolvedValue(expectedResult);

            const result = await controller.selectRole(mockRequest, dto);

            expect(service.selectRole).toHaveBeenCalledWith('test-user-id', dto);
            expect(result).toEqual(expectedResult);
        });

        it('should select PROVIDER role successfully', async () => {
            const dto: SelectRoleDto = { role: UserRole.PROVIDER };
            const mockRequest = {
                user: { id: 'test-user-id' },
            };

            const expectedResult = {
                user: {
                    id: 'test-user-id',
                    email: 'test@example.com',
                    role: UserRole.PROVIDER,
                    profileCompleted: false,
                },
                message: 'Cập nhật role thành công',
            };

            mockAuthService.selectRole.mockResolvedValue(expectedResult);

            const result = await controller.selectRole(mockRequest, dto);

            expect(service.selectRole).toHaveBeenCalledWith('test-user-id', dto);
            expect(result).toEqual(expectedResult);
        });
    });
});

describe('AuthService - Role Selection', () => {
    let service: AuthService;
    let prisma: any;

    const mockPrismaService = {
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: 'PrismaService',
                    useValue: mockPrismaService,
                },
                {
                    provide: 'JwtService',
                    useValue: { sign: jest.fn() },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        prisma = mockPrismaService;
    });

    describe('selectRole', () => {
        it('should update user role when profile not completed', async () => {
            const userId = 'test-user-id';
            const dto: SelectRoleDto = { role: UserRole.USER };

            const mockUser = {
                id: userId,
                email: 'test@example.com',
                name: 'Test User',
                profileCompleted: false,
                role: UserRole.USER,
                hashedPassword: 'hashed',
            };

            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue({ ...mockUser, role: UserRole.USER });

            const result = await service.selectRole(userId, dto);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: userId },
            });
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { role: dto.role },
            });
            expect(result.user.role).toBe(UserRole.USER);
        });

        it('should throw error when user not found', async () => {
            const userId = 'non-existent-id';
            const dto: SelectRoleDto = { role: UserRole.USER };

            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.selectRole(userId, dto)).rejects.toThrow(
                'User không tồn tại',
            );
        });

        it('should throw error when profile already completed', async () => {
            const userId = 'test-user-id';
            const dto: SelectRoleDto = { role: UserRole.PROVIDER };

            const mockUser = {
                id: userId,
                email: 'test@example.com',
                profileCompleted: true,
                role: UserRole.USER,
            };

            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(service.selectRole(userId, dto)).rejects.toThrow(
                'Không thể thay đổi role sau khi hoàn thành profile',
            );
        });
    });
});
