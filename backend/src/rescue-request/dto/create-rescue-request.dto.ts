import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum IncidentType {
  BREAKDOWN = 'BREAKDOWN',
  ACCIDENT = 'ACCIDENT',
  FLAT_TIRE = 'FLAT_TIRE',
  BATTERY_DEAD = 'BATTERY_DEAD',
  OUT_OF_FUEL = 'OUT_OF_FUEL',
  LOCKED_OUT = 'LOCKED_OUT',
  OTHER = 'OTHER',
}

export enum VehicleType {
  CAR = 'CAR',
  MOTORCYCLE = 'MOTORCYCLE',
}

// Location DTO
export class LocationDto {
  @ApiProperty({ example: '123 Nguyễn Trãi, Quận 1, TP.HCM' })
  @IsString()
  @IsNotEmpty()
  addressText: string;

  @ApiProperty({ example: 10.7769 })
  @IsNumber()
  @IsNotEmpty()
  lat: number;

  @ApiProperty({ example: 106.7009 })
  @IsNumber()
  @IsNotEmpty()
  lng: number;
}

export class CreateRescueRequestDto {
  @ApiProperty({ enum: IncidentType, example: IncidentType.FLAT_TIRE })
  @IsEnum(IncidentType)
  @IsNotEmpty()
  incidentType: IncidentType;

  @ApiProperty({ enum: VehicleType, example: VehicleType.MOTORCYCLE })
  @IsEnum(VehicleType)
  @IsNotEmpty()
  vehicleType: VehicleType;

  @ApiProperty({ type: () => LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  @IsNotEmpty()
  pickupLocation: LocationDto;

  @ApiPropertyOptional({ type: () => LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  dropoffLocation?: LocationDto;

  @ApiPropertyOptional({ example: 'Xe bị xịt lốp trước, cần thay lốp gấp' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  /** Customer vehicle plate for this request (required for accurate provider display, esp. guests) */
  @ApiPropertyOptional({ example: '59T1-1234' })
  @IsString()
  @IsOptional()
  licensePlate?: string;

  @ApiPropertyOptional({ example: 'Đen' })
  @IsString()
  @IsOptional()
  vehicleColor?: string;

  @ApiPropertyOptional({ type: [String], example: ['uploads/img1.jpg'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaObjectKeys?: string[]; // Array of object keys from pre-uploaded media (images)

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  videoUrls?: string[]; // Array of Cloudinary video URLs (deprecated, use videoUploadIds)

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  videoUploadIds?: string[]; // Array of Upload IDs for Cloudinary videos
}
