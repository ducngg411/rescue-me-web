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
  @IsString()
  @IsNotEmpty()
  addressText: string;

  @IsNumber()
  @IsNotEmpty()
  lat: number;

  @IsNumber()
  @IsNotEmpty()
  lng: number;
}

export class CreateRescueRequestDto {
  @IsEnum(IncidentType)
  @IsNotEmpty()
  incidentType: IncidentType;

  @IsEnum(VehicleType)
  @IsNotEmpty()
  vehicleType: VehicleType;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsNotEmpty()
  pickupLocation: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  dropoffLocation?: LocationDto;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaObjectKeys?: string[]; // Array of object keys from pre-uploaded media
}
