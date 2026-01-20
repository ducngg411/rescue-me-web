import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRescueRequestDto } from './dto/create-rescue-request.dto';

@Injectable()
export class RescueRequestService {
    constructor(private prisma: PrismaService) { }

    async createRescueRequest(userId: string, dto: CreateRescueRequestDto) {
        // Validate user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Create rescue request
        const rescueRequest = await this.prisma.rescueRequest.create({
            data: {
                userId,
                incidentType: dto.incidentType,
                vehicleType: dto.vehicleType,
                description: dto.description,
                pickupLocation: dto.pickupLocation as any,
                dropoffLocation: dto.dropoffLocation as any,
                status: 'CREATED',
                // Create associated media if provided
                media: dto.mediaObjectKeys
                    ? {
                        create: dto.mediaObjectKeys.map((objectKey) => {
                            // Extract file info from object key
                            const fileName = objectKey.split('/').pop() || 'unknown';
                            return {
                                objectKey,
                                fileName,
                                fileSize: 0, // Will be updated later if needed
                                contentType: 'image/jpeg', // Default, should be passed from frontend
                                publicUrl: `${process.env.S3_PUBLIC_URL}/${objectKey}`,
                            };
                        }),
                    }
                    : undefined,
            },
            include: {
                media: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumber: true,
                    },
                },
            },
        });

        return rescueRequest;
    }

    async getUserRescueRequests(userId: string) {
        return this.prisma.rescueRequest.findMany({
            where: { userId },
            include: {
                media: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async getRescueRequestById(requestId: string, userId: string) {
        const request = await this.prisma.rescueRequest.findFirst({
            where: {
                id: requestId,
                userId, // Ensure user can only access their own requests
            },
            include: {
                media: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumber: true,
                    },
                },
            },
        });

        if (!request) {
            throw new NotFoundException('Rescue request not found');
        }

        return request;
    }

    async cancelRescueRequest(requestId: string, userId: string) {
        // Check if request exists and belongs to user
        const request = await this.getRescueRequestById(requestId, userId);

        // Only allow cancellation if status is CREATED or SEARCHING
        if (!['CREATED', 'SEARCHING'].includes(request.status)) {
            throw new Error('Cannot cancel request in current status');
        }

        return this.prisma.rescueRequest.update({
            where: { id: requestId },
            data: { status: 'CANCELLED' },
            include: {
                media: true,
            },
        });
    }
}
