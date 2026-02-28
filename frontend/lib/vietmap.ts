const VIETMAP_API_KEY = process.env.NEXT_PUBLIC_VIETMAP_API_KEY || '';
const AUTOCOMPLETE_URL = 'https://maps.vietmap.vn/api/autocomplete/v3';
const PLACE_URL = 'https://maps.vietmap.vn/api/place/v3';

export interface PlaceSearchResult {
    displayName: string;
    address: string;
    lat: number;
    lng: number;
    refId?: string;
}

export interface PlaceDetails {
    display: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    city?: string;
    district?: string;
    ward?: string;
}

/**
 * Search for places using VietMap Autocomplete API v3
 * Returns list with ref_id for later use with Place API
 */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
    if (!query.trim()) return [];

    try {
        const url = `${AUTOCOMPLETE_URL}?apikey=${VIETMAP_API_KEY}&text=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();

            // Autocomplete API v3 returns {data: [...]} format
            let results: any[] = [];
            if (data && typeof data === 'object' && Array.isArray(data.data)) {
                results = data.data;
            } else if (Array.isArray(data)) {
                results = data;
            }

            // Convert to PlaceSearchResult list (includes ref_id)
            return results.map((item: any) => ({
                displayName: item.display || item.name || item.address || '',
                address: item.address || item.display || '',
                lat: 0.0, // Will be filled by Place API v3
                lng: 0.0, // Will be filled by Place API v3
                refId: item.ref_id?.toString(),
            }));
        }
        return [];
    } catch (error) {
        console.error('Error searching places:', error);
        return [];
    }
}

/**
 * Get place details (exact coordinates) using VietMap Place API v3
 * Uses ref_id from autocomplete result
 */
export async function getPlaceDetails(refId: string): Promise<PlaceDetails | null> {
    if (!refId) return null;

    try {
        const url = `${PLACE_URL}?apikey=${VIETMAP_API_KEY}&refid=${refId}`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            return {
                display: data.display || '',
                name: data.name || '',
                address: data.address || '',
                lat: parseFloat(data.lat) || 0.0,
                lng: parseFloat(data.lng) || 0.0,
                city: data.city?.toString(),
                district: data.district?.toString(),
                ward: data.ward?.toString(),
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting place details:', error);
        return null;
    }
}

/**
 * Reverse geocode - convert coordinates to address using v4 API
 * display_type=1: New merged format (2 levels: ward, city) - more concise
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const url = `https://maps.vietmap.vn/api/reverse/v4?apikey=${VIETMAP_API_KEY}&lat=${lat}&lng=${lng}&display_type=1`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            // v4 returns array of results
            if (data && Array.isArray(data) && data.length > 0) {
                const result = data[0];
                // Use display for full address, fallback to address or name
                return result.display || result.address || result.name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            }
            return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
        console.error('Error reverse geocoding:', error);
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
}
