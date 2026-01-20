/**
 * Valid Vietnam province codes for license plates
 * Based on official Vietnamese registration system
 */
const VALID_PROVINCE_CODES = new Set([
  "11", "12", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29",
  "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "43", "47", "48", "49",
  "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "70", "71", "72", "73", "74", "75", "76", "77", "78", "79",
  "80", "81", "82", "83", "84", "85", "86", "88", "89",
  "90", "91", "92", "93", "94", "95", "97", "98", "99"
]);

/**
 * Province code to province name mapping
 */
const PROVINCE_CODE_TO_NAME: Record<string, string> = {
  "11": "Cao Bằng", "12": "Lạng Sơn", "14": "Quảng Ninh",
  "15": "Hải Phòng", "16": "Hải Phòng", "17": "Thái Bình",
  "18": "Nam Định", "19": "Phú Thọ", "20": "Thái Nguyên",
  "21": "Yên Bái", "22": "Tuyên Quang", "23": "Hà Giang",
  "24": "Lào Cai", "25": "Lai Châu", "26": "Sơn La",
  "27": "Điện Biên", "28": "Hòa Bình",
  "29": "Hà Nội", "30": "Hà Nội", "31": "Hà Nội",
  "32": "Hà Nội", "33": "Hà Nội", "40": "Hà Nội",
  "34": "Hải Dương", "35": "Ninh Bình", "36": "Thanh Hóa",
  "37": "Nghệ An", "38": "Hà Tĩnh",
  "39": "Đồng Nai", "60": "Đồng Nai",
  "41": "TP. Hồ Chí Minh", "50": "TP. Hồ Chí Minh", "51": "TP. Hồ Chí Minh",
  "52": "TP. Hồ Chí Minh", "53": "TP. Hồ Chí Minh", "54": "TP. Hồ Chí Minh",
  "55": "TP. Hồ Chí Minh", "56": "TP. Hồ Chí Minh", "57": "TP. Hồ Chí Minh",
  "58": "TP. Hồ Chí Minh", "59": "TP. Hồ Chí Minh",
  "43": "Đà Nẵng",
  "47": "Đắk Lắk", "48": "Đắk Nông", "49": "Lâm Đồng",
  "61": "Bình Dương", "62": "Long An", "63": "Tiền Giang",
  "64": "Vĩnh Long", "65": "Cần Thơ", "66": "Đồng Tháp",
  "67": "An Giang", "68": "Kiên Giang", "69": "Cà Mau",
  "70": "Tây Ninh", "71": "Bến Tre", "72": "Bà Rịa - Vũng Tàu",
  "73": "Quảng Bình", "74": "Quảng Trị", "75": "Thừa Thiên Huế",
  "76": "Quảng Ngãi", "77": "Bình Định", "78": "Phú Yên",
  "79": "Khánh Hòa", "81": "Gia Lai", "82": "Kon Tum",
  "83": "Sóc Trăng", "84": "Trà Vinh", "85": "Ninh Thuận",
  "86": "Bình Thuận", "88": "Vĩnh Phúc", "89": "Hưng Yên",
  "90": "Hà Nam", "91": "Bắc Giang", "92": "Quảng Nam",
  "93": "Bình Phước", "94": "Bạc Liêu", "95": "Hậu Giang",
  "97": "Bắc Kạn", "98": "Bắc Giang", "99": "Bắc Ninh",
  "80": "Cơ quan Trung ương"
};

/**
 * Special middle characters for diplomatic and special vehicles
 */
const SPECIAL_MIDDLE_CHARS = new Set(["NG", "NN", "QT"]);

/**
 * Format Vietnam license plate to standard display format
 * Output: 29A-12345, 51AB-12345, 80-NG-123.45
 */
export function formatVietnamPlate(input: string): string {
    const normalized = normalizeVietnamPlate(input);
    if (!normalized) return '';

    // Check for special diplomatic/foreign plates (80-NG, 80-NN, 80-QT)
    const specialMatch = normalized.match(/^(\d{2})(NG|NN|QT)(\d{3})(\d{2})$/);
    if (specialMatch) {
        const [, province, code, first, second] = specialMatch;
        return `${province}-${code}-${first}.${second}`;
    }

    // Try standard format: 2 digits + 1 letter + 4-6 digits
    // This should match first to avoid 29A12345 becoming 29A1-2345
    let match = normalized.match(/^(\d{2})([A-Z])(\d{4,6})$/);
    if (match) {
        const [, province, code, number] = match;
        return `${province}${code}-${number}`;
    }

    // Then try extended: 2 digits + 2 chars + 4-6 digits
    match = normalized.match(/^(\d{2})([A-Z][A-Z0-9])(\d{4,6})$/);
    if (match) {
        const [, province, code, number] = match;
        return `${province}${code}-${number}`;
    }

    return normalized;
}

/**
 * Normalize Vietnam license plate
 * Converts to uppercase, trims whitespace, removes spaces/dots/dashes
 * Input: "29A-12345", "29A 12345", "29A.12345", "80-NG-123.45"
 * Output: "29A12345", "80NG12345"
 */
export function normalizeVietnamPlate(input: string): string {
    return input
        .toUpperCase()
        .trim()
        .replace(/[\s.-]/g, ""); // remove space, dot, dash
}

/**
 * Vietnam license plate patterns
 * - Standard: province (2 digits) + series letter (A-Z) + digits (4-6)
 * - Extended: province (2 digits) + 2 chars (letter+letter/digit) + digits (4-6)
 * - Special diplomatic: 80 + NG/NN/QT + 5 digits
 */
const PLATE_VN_STANDARD = /^(\d{2})([A-Z])(\d{4,6})$/;
const PLATE_VN_EXTENDED = /^(\d{2})([A-Z][A-Z0-9])(\d{4,6})$/;
const PLATE_VN_SPECIAL = /^(80)(NG|NN|QT)(\d{5})$/;

/**
 * Validate that the numeric part is within valid range (4-6 digits)
 */
function isValidDigitCount(plate: string): boolean {
    // Extract just the numeric suffix
    const match = plate.match(/\d+$/);
    if (!match) return false;
    const digitCount = match[0].length;
    return digitCount >= 4 && digitCount <= 6;
}

/**
 * Validate Vietnam license plate with province code checking
 * @param input - License plate string (accepts any format: with/without dashes)
 * @param mode - "strict" for province code validation, "pattern" for pattern-only
 * @returns true if valid Vietnam license plate
 * 
 * Valid examples:
 * - 29A-12345 (Hà Nội) - 5 digits
 * - 51AB-12345 (TP.HCM) - 2 chars + 5 digits
 * - 80-NG-123.45 (Ngoại giao) - special format
 * - 43K-98765 (Đà Nẵng) - 1 char + 5 digits
 * 
 * Invalid examples:
 * - 29A-1234567 (7 digits - too many)
 * - 29A-123 (3 digits - too few)
 * - 01A-12345 (invalid province code 01)
 */
export function isValidVietnamPlate(
    input: string, 
    mode: "strict" | "pattern" = "strict"
): boolean {
    const plate = normalizeVietnamPlate(input);
    if (!plate) return false;

    // Check special diplomatic plates (exactly 5 digits)
    const specialMatch = plate.match(PLATE_VN_SPECIAL);
    if (specialMatch) {
        return true; // 80-NG/NN/QT is always valid
    }

    // Check standard/extended plates
    const standardMatch = plate.match(PLATE_VN_STANDARD);
    const extendedMatch = plate.match(PLATE_VN_EXTENDED);
    
    if (!standardMatch && !extendedMatch) {
        return false;
    }

    // Validate digit count (4-6 digits)
    if (!isValidDigitCount(plate)) {
        return false;
    }

    // Extract province code
    const provinceCode = (standardMatch || extendedMatch)![1];

    // In strict mode, validate province code
    if (mode === "strict") {
        return VALID_PROVINCE_CODES.has(provinceCode);
    }

    return true;
}

/**
 * Get province name from license plate
 * @param input - License plate string
 * @returns Province name or null if invalid
 */
export function getProvinceFromPlate(input: string): string | null {
    const plate = normalizeVietnamPlate(input);
    if (!plate) return null;

    // Extract first 2 digits
    const match = plate.match(/^(\d{2})/);
    if (!match) return null;

    const provinceCode = match[1];
    return PROVINCE_CODE_TO_NAME[provinceCode] || null;
}

