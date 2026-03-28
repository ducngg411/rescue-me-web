import {
    buildCustomerKnownSnapshot,
    computeOrderedMissingFields,
    formatMissingFieldsDirective,
} from './guided-missing-fields';

describe('guided-missing-fields', () => {
    it('lists mandatory missing before optional', () => {
        const missing = computeOrderedMissingFields({});
        expect(missing).toEqual([
            'incidentType',
            'vehicleType',
            'contactPhone',
            'pickupLocation',
        ]);
    });

    it('appends optional only when mandatory complete', () => {
        const missing = computeOrderedMissingFields({
            incidentType: 'FLAT_TIRE',
            vehicleType: 'CAR',
            contactPhone: '0377386704',
            pickupLocation: { addressText: 'A', lat: 1, lng: 2 },
        });
        expect(missing).toEqual(['licensePlate', 'vehicleColor']);
    });

    it('empty missing when draft complete', () => {
        const missing = computeOrderedMissingFields({
            incidentType: 'FLAT_TIRE',
            vehicleType: 'CAR',
            contactPhone: '0377386704',
            pickupLocation: { addressText: 'A', lat: 1, lng: 2 },
            licensePlate: '29A12345',
            vehicleColor: 'Đen',
        });
        expect(missing).toEqual([]);
    });

    it('known snapshot omits empty fields', () => {
        const snap = buildCustomerKnownSnapshot({
            vehicleType: 'CAR',
            contactPhone: '0901000000',
        });
        expect(snap).toEqual({ vehicleType: 'CAR', contactPhone: '0901000000' });
    });

    it('formatMissingFieldsDirective lists ordered missing keys', () => {
        const text = formatMissingFieldsDirective(['vehicleType']);
        expect(text).toContain('[MISSING_FOR_ORDER]');
        expect(text).toContain('vehicleType');
        expect(text).toContain('[CUSTOMER_KNOWN]');
        expect(text).toContain('cấm hỏi lại');
    });
});
