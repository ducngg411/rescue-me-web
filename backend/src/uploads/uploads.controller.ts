import { Controller, Post, Body, UseGuards, Req, Get, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { PresignUploadDto, PresignUploadResponseDto, UploadPurpose } from './dto/presign-upload.dto';
import { ConfirmUploadDto, ConfirmUploadResponseDto } from './dto/confirm-upload.dto';

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

    @Get()
    async getUserUploads(
        @Req() req,
        @Query('purpose') purpose?: UploadPurpose,
    ) {
        return this.uploadsService.getUserUploads(req.user.id, purpose);
    }
}
