import {
    Controller,
    Post,
    Get,
    Patch,
    Param,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RescueRequestService } from './rescue-request.service';
import { CreateRescueRequestDto } from './dto/create-rescue-request.dto';

@Controller('rescue-requests')
@UseGuards(JwtAuthGuard)
export class RescueRequestController {
    constructor(private rescueRequestService: RescueRequestService) { }

    @Post()
    async createRescueRequest(
        @Request() req,
        @Body() createRescueRequestDto: CreateRescueRequestDto,
    ) {
        return this.rescueRequestService.createRescueRequest(
            req.user.id,
            createRescueRequestDto,
        );
    }

    @Get()
    async getUserRescueRequests(@Request() req) {
        return this.rescueRequestService.getUserRescueRequests(req.user.id);
    }

    @Get(':id')
    async getRescueRequestById(@Request() req, @Param('id') id: string) {
        return this.rescueRequestService.getRescueRequestById(id, req.user.id);
    }

    @Patch(':id/cancel')
    async cancelRescueRequest(@Request() req, @Param('id') id: string) {
        return this.rescueRequestService.cancelRescueRequest(id, req.user.id);
    }
}
