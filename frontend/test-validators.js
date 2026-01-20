// Test file for Vietnamese plate validators

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

const PROVINCE_CODE_TO_NAME = {
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

function normalizeVietnamPlate(input) {
    return input
        .toUpperCase()
        .trim()
        .replace(/[\s.-]/g, "");
}

function formatVietnamPlate(input) {
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

const PLATE_VN_STANDARD = /^(\d{2})([A-Z])(\d{4,6})$/;
const PLATE_VN_EXTENDED = /^(\d{2})([A-Z][A-Z0-9])(\d{4,6})$/;
const PLATE_VN_SPECIAL = /^(80)(NG|NN|QT)(\d{5})$/;

function isValidDigitCount(plate) {
    const match = plate.match(/\d+$/);
    if (!match) return false;
    const digitCount = match[0].length;
    return digitCount >= 4 && digitCount <= 6;
}

function isValidVietnamPlate(input, mode = "strict") {
    const plate = normalizeVietnamPlate(input);
    if (!plate) return false;
    
    // Check special diplomatic plates
    const specialMatch = plate.match(PLATE_VN_SPECIAL);
    if (specialMatch) {
        return true;
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
    const provinceCode = (standardMatch || extendedMatch)[1];
    
    // In strict mode, validate province code
    if (mode === "strict") {
        return VALID_PROVINCE_CODES.has(provinceCode);
    }
    
    return true;
}

function getProvinceFromPlate(input) {
    const plate = normalizeVietnamPlate(input);
    if (!plate) return null;
    
    const match = plate.match(/^(\d{2})/);
    if (!match) return null;
    
    const provinceCode = match[1];
    return PROVINCE_CODE_TO_NAME[provinceCode] || null;
}

console.log('=== Testing Vietnamese Plate Number Validation ===\n');

const tests = [
    '29A12345',      // Valid - Hà Nội, A + 12345 (5 digits)
    '29A-12345',     // Valid - Hà Nội, with dash
    '29A 12345',     // Valid - Hà Nội, with space
    '51AB12345',     // Valid - TP.HCM, AB + 12345 (5 digits)
    '51AB-12345',    // Valid - TP.HCM, with dash
    '30A-154321',    // Valid - Hà Nội, A + 154321 (6 digits)
    '43K-98765',     // Valid - Đà Nẵng, K + 98765 (5 digits)
    '29A1-12345',    // Valid - ambiguous: could be A1+12345 or A+112345
    '51C999999',     // Valid - TP.HCM, C + 999999 (6 digits max)
    '80NG12345',     // Valid - Diplomatic plate
    '80-NG-123.45',  // Valid - Diplomatic plate formatted
    '80NN54321',     // Valid - Foreign plate
    '80QT99999',     // Valid - International org plate
    '99Z9999',       // Valid - Bắc Ninh, Z + 9999 (4 digits min)
    '01A1234',       // Invalid - province code 01 not in use
    '13A12345',      // Invalid - province code 13 not used
    'INVALID',       // Invalid - not a plate
    '1A12345',       // Invalid - province must be 2 digits
    '100A12345',     // Invalid - province too long
    '29-A12345',     // Valid - dash before letter (normalized)
    '29a12345',      // Valid - lowercase (normalized)
];

console.log('Input'.padEnd(18) + 'Normalized'.padEnd(15) + 'Valid'.padEnd(8) + 'Formatted'.padEnd(18) + 'Province');
console.log('='.repeat(90));

tests.forEach(test => {
    const normalized = normalizeVietnamPlate(test);
    const valid = isValidVietnamPlate(test);
    const formatted = formatVietnamPlate(test);
    const province = getProvinceFromPlate(test) || '-';
    const validStr = valid ? '✓ Yes' : '✗ No';
    console.log(test.padEnd(18) + normalized.padEnd(15) + validStr.padEnd(8) + formatted.padEnd(18) + province);
});

console.log('\n=== Format Ambiguity Test ===');
console.log('When user types "29A1-12345", after removing dash we get "29A112345"');
console.log('This could mean:');
console.log('  Option 1: 29 + A  + 112345 (1 char + 6 digits) ✓ Valid');
console.log('  Option 2: 29 + A1 + 12345  (2 chars + 5 digits) ✓ Valid');
console.log('Our system chooses Option 1 (greedy match on digits)');
console.log('');

console.log('\n=== Province Code Validation ===\n');

const provinceTests = [
    { input: '00A-12345', desc: 'Code 00 (invalid)' },
    { input: '01A-12345', desc: 'Code 01 (invalid - not used)' },
    { input: '11A-12345', desc: 'Code 11 (Cao Bằng)' },
    { input: '13A-12345', desc: 'Code 13 (invalid - Hà Bắc old)' },
    { input: '29A-12345', desc: 'Code 29 (Hà Nội)' },
    { input: '43A-12345', desc: 'Code 43 (Đà Nẵng)' },
    { input: '51A-12345', desc: 'Code 51 (TP.HCM)' },
    { input: '80A-12345', desc: 'Code 80 (Trung ương)' },
    { input: '99A-12345', desc: 'Code 99 (Bắc Ninh)' },
];

provinceTests.forEach(({ input, desc }) => {
    const valid = isValidVietnamPlate(input);
    const province = getProvinceFromPlate(input);
    const validStr = valid ? '✓ Valid' : '✗ Invalid';
    console.log(`${desc.padEnd(35)} → ${validStr.padEnd(10)} → ${province || 'N/A'}`);
});

console.log('\n=== Special Diplomatic Plates ===\n');

const diplomaticTests = [
    { input: '80-NG-123.45', desc: 'Diplomatic (NG)' },
    { input: '80NG12345', desc: 'Diplomatic normalized' },
    { input: '80-NN-987.65', desc: 'Foreign (NN)' },
    { input: '80-QT-555.55', desc: 'International org (QT)' },
    { input: '80AB12345', desc: 'Standard 80 plate (not special)' },
];

diplomaticTests.forEach(({ input, desc }) => {
    const valid = isValidVietnamPlate(input);
    const formatted = formatVietnamPlate(input);
    const validStr = valid ? '✓ Valid' : '✗ Invalid';
    console.log(`${desc.padEnd(35)} → ${validStr.padEnd(10)} → ${formatted}`);
});

console.log('\n=== Edge Cases ===\n');

const edgeCases = [
    { input: '', desc: 'Empty string' },
    { input: '   ', desc: 'Whitespace only' },
    { input: '29A-1234', desc: '4 digits (minimum)' },
    { input: '29A-123456', desc: '6 digits (maximum)' },
    { input: '29A-1234567', desc: '7 digits (INVALID - too many)' },
    { input: '29A-123', desc: '3 digits (INVALID - too few)' },
    { input: '29AB-12345', desc: 'Two-letter series' },
    { input: '29A1-12345', desc: 'Letter-digit series' },
    { input: '29ABC-1234', desc: '3 chars (INVALID)' },
];

edgeCases.forEach(({ input, desc }) => {
    const valid = isValidVietnamPlate(input);
    const formatted = formatVietnamPlate(input);
    const validStr = valid ? '✓ Valid' : '✗ Invalid';
    console.log(`${desc.padEnd(30)} [${input.padEnd(14)}] → ${validStr.padEnd(10)} → ${formatted}`);
});
