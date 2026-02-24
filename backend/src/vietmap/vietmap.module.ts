import { Module } from '@nestjs/common';
import { VietMapService } from './vietmap.service';

@Module({
    providers: [VietMapService],
    exports: [VietMapService],
})
export class VietMapModule { }
