import { Controller, Post, Body, UseGuards, Req, Get, Query, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { PresignUploadDto, PresignUploadResponseDto, UploadPurpose } from './dto/presign-upload.dto';
import { ConfirmUploadDto, ConfirmUploadResponseDto } from './dto/confirm-upload.dto';
import { TrackCloudinaryUploadDto, TrackCloudinaryUploadResponseDto } from './dto/cloudinary-upload.dto';

@ApiTags('Uploads')
@ApiBearerAuth('JWT')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
    constructor(private readonly uploadsService: UploadsService) { }

    @Post('presign')
    async presignUpload(
        @Req() req,
        @Body() dto: PresignUploadDto,
    ): Promise<PresignUploadResponseDto> {
        return this.uploadsService.presignUpload(req.user.id, dto);
    }

    @Post('confirm')
    async confirmUpload(
        @Req() req,
        @Body() dto: ConfirmUploadDto,
    ): Promise<ConfirmUploadResponseDto> {
        return this.uploadsService.confirmUpload(req.user.id, dto.uploadId);
    }

    // Cloudinary endpoints
    @Post('cloudinary/track')
    async trackCloudinaryUpload(
        @Req() req,
        @Body() dto: TrackCloudinaryUploadDto,
    ): Promise<TrackCloudinaryUploadResponseDto> {
        return this.uploadsService.trackCloudinaryUpload(req.user.id, dto);
    }

    @Delete('cloudinary/:uploadId')
    async deleteCloudinaryUpload(
        @Req() req,
        @Param('uploadId') uploadId: string,
    ) {
        return this.uploadsService.deleteCloudinaryUpload(req.user.id, uploadId);
    }

    @Get()
    async getUserUploads(
        @Req() req,
        @Query('purpose') purpose?: UploadPurpose,
    ) {
        return this.uploadsService.getUserUploads(req.user.id, purpose);
    }

    @Delete(':uploadId')
    async deleteUpload(
        @Req() req,
        @Param('uploadId') uploadId: string,
    ) {
        return this.uploadsService.deleteUpload(req.user.id, uploadId);
    }
}
