/**
 * Normalize Vietnam license plate
 * Converts to uppercase, trims whitespace, removes spaces/dots/dashes
 */
export function normalizeVietnamPlate(input: string): string {
    return input
        .toUpperCase()
        .trim()
        .replace(/[\s.-]/g, ""); // remove space, dot, dash
}

/**
 * Vietnam license plate patterns
 * Common: 51A12345 (province + letter + 4-6 digits)
 * Extended: 51AB12345, 51A112345 (province + 1-2 letters/digits + 4-6 digits)
 */
const PLATE_VN_COMMON = /^(0[1-9]|[1-8][0-9]|9[0-9])[A-Z]\d{4,6}$/;
const PLATE_VN_EXTENDED = /^(0[1-9]|[1-8][0-9]|9[0-9])[A-Z0-9]{1,2}\d{4,6}$/;

/**
 * Validate Vietnam license plate
 * @param input - License plate string
 * @param mode - "common" for strict validation, "extended" for more flexible
 * @returns true if valid Vietnam license plate
 */
export function isValidVietnamPlate(input: string, mode: "common" | "extended" = "extended"): boolean {
    const plate = normalizeVietnamPlate(input);
    return mode === "common" ? PLATE_VN_COMMON.test(plate) : PLATE_VN_EXTENDED.test(plate);
}
