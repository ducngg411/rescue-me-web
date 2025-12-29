import { z } from 'zod';

// Regex for Vietnamese phone numbers
const phoneRegex = /^0[0-9]{9}$/;

// Regex for Vietnamese license plates
// Format: 29A-12345 or 29A12345
const licensePlateRegex = /^[0-9]{2}[A-Z]{1,2}[-]?[0-9]{4,5}$/;

export const completeProfileSchema = z.object({
    phoneNumber: z
        .string()
        .regex(phoneRegex, 'Phone number must have 10 digits and start with 0')
        .min(10, 'Phone number must have exactly 10 digits')
        .max(10, 'Phone number must have exactly 10 digits'),

    vehicleType: z.enum(['CAR', 'TRUCK', 'MOTORCYCLE'], {
        message: 'Please select a vehicle type',
    }),

    licensePlate: z
        .string()
        .min(1, 'Please enter a license plate number')
        .regex(
            licensePlateRegex,
            'Invalid license plate format. Example: 29A-12345'
        )
        .transform((val) => val.toUpperCase()),

    vehicleColor: z
        .string()
        .min(2, 'Vehicle color must be at least 2 characters')
        .max(20, 'Vehicle color must not exceed 20 characters'),
});

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
