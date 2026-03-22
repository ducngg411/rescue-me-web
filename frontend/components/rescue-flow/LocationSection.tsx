'use client';

import LocationPicker from '@/components/LocationPicker';
import { SectionHeader } from './SectionHeader';
import type { RescueFlowColors } from './tokens';

export type RescueLocationData = { addressText: string; lat: number; lng: number };

export function LocationSection({
    colors,
    t,
    incidentLocation,
    onIncidentLocationChange,
    currentLocation,
    isLoadingLocation,
    onRefreshLocation,
    onUseCurrentLocation,
    locationPickerVariant = 'default',
}: {
    colors: RescueFlowColors;
    t: (key: string) => string;
    incidentLocation: RescueLocationData | null;
    onIncidentLocationChange: (loc: RescueLocationData | null) => void;
    currentLocation: RescueLocationData | null;
    isLoadingLocation: boolean;
    onRefreshLocation: () => void;
    onUseCurrentLocation: () => void;
    locationPickerVariant?: 'default' | 'rescue';
}) {
    return (
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <SectionHeader
                step={3}
                title={t('user.create.locationSection')}
                colors={colors}
                icon={
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                }
            />
            <LocationPicker
                variant={locationPickerVariant}
                label={t('user.create.locationLabel')}
                value={incidentLocation}
                onChange={onIncidentLocationChange}
                placeholder={t('user.create.locationSearchPlaceholder')}
                required
            />
            <div
                className="mt-3 rounded-xl overflow-hidden"
                style={{
                    border: `1.5px solid ${
                        isLoadingLocation ? colors.border : currentLocation ? colors.orange + '40' : colors.border
                    }`,
                    background: currentLocation ? colors.orangeLight : colors.bg,
                }}
            >
                {isLoadingLocation ? (
                    <div className="flex items-center gap-3 px-4 py-3">
                        <div
                            className="animate-spin rounded-full h-4 w-4 border-2 flex-shrink-0"
                            style={{ borderColor: colors.orange, borderTopColor: 'transparent' }}
                        />
                        <span className="text-sm" style={{ color: colors.gray }}>
                            {t('user.create.gettingLocation')}
                        </span>
                    </div>
                ) : currentLocation ? (
                    <div className="px-4 py-3">
                        <div className="flex items-start gap-3">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{ background: colors.orange }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold mb-0.5" style={{ color: colors.orange }}>
                                    {t('user.create.currentLocationLabel')}
                                </p>
                                <p className="text-sm leading-snug" style={{ color: colors.navy }}>
                                    {currentLocation.addressText}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onRefreshLocation}
                                title={t('user.create.refreshLocation')}
                                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
                                style={{ background: colors.orange + '20', color: colors.orange }}
                            >
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={onUseCurrentLocation}
                            className="mt-2.5 w-full py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
                            style={{ background: colors.orange, color: 'white' }}
                        >
                            {t('user.create.useThisLocation')}
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onRefreshLocation}
                        className="w-full flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-70"
                    >
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: colors.border }}
                        >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={colors.gray} strokeWidth={2}>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <span className="text-sm" style={{ color: colors.gray }}>
                            {t('user.create.tapToGetLocation')}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
