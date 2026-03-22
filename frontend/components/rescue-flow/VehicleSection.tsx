'use client';

import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { SectionHeader } from './SectionHeader';
import type { RescueFlowColors } from './tokens';

export type RescueVehicle = {
    type: 'CAR' | 'MOTORCYCLE';
    licensePlate: string;
    color?: string;
};

export function VehicleSection({
    colors,
    t,
    vehicles,
    vehicleIndex,
    onSelectVehicle,
    showAddVehicle,
    onOpenAddVehicle,
    onCloseAddVehicle,
    newVehicle,
    setNewVehicle,
    onAddVehicle,
    isPlateInvalid,
    isColorInvalid,
    isAddBtnDisabled,
    showPlateError,
    showColorError,
    onPlateBlur,
    onColorBlur,
    vehicleTypeOrder = ['CAR', 'MOTORCYCLE'],
}: {
    colors: RescueFlowColors;
    t: (key: string) => string;
    vehicles: RescueVehicle[];
    vehicleIndex: number;
    onSelectVehicle: (index: number) => void;
    showAddVehicle: boolean;
    onOpenAddVehicle: () => void;
    onCloseAddVehicle: () => void;
    newVehicle: { type: 'CAR' | 'MOTORCYCLE'; licensePlate: string; color: string };
    setNewVehicle: Dispatch<SetStateAction<{ type: 'CAR' | 'MOTORCYCLE'; licensePlate: string; color: string }>>;
    onAddVehicle: () => void;
    isPlateInvalid: boolean;
    isColorInvalid: boolean;
    isAddBtnDisabled: boolean;
    showPlateError: boolean;
    showColorError: boolean;
    onPlateBlur?: () => void;
    onColorBlur?: () => void;
    vehicleTypeOrder?: Array<'CAR' | 'MOTORCYCLE'>;
}) {
    const inputStyle: CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1.5px solid #e5e7eb',
        color: colors.navy,
        fontSize: '14px',
        outline: 'none',
        background: colors.white,
    };

    return (
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <SectionHeader
                step={2}
                title={t('user.create.vehicleSection')}
                colors={colors}
                icon={
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M6 13h.01M18 13h.01"
                        />
                    </svg>
                }
            />
            {vehicles.length === 0 ? (
                <div className="text-center py-6 rounded-xl" style={{ border: '1.5px dashed #e5e7eb' }}>
                    <div
                        className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center"
                        style={{ background: colors.orangeLight }}
                    >
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={colors.orange} strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <p className="text-xs mb-3" style={{ color: colors.gray }}>
                        {t('user.create.noVehicle')}
                    </p>
                    <button
                        type="button"
                        onClick={onOpenAddVehicle}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                        style={{ background: colors.orange }}
                    >
                        {t('user.create.addVehicleBtn')}
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {vehicles.map((vehicle, index) => {
                        const active = vehicleIndex === index;
                        return (
                            <button
                                key={index}
                                type="button"
                                onClick={() => onSelectVehicle(index)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                                style={{
                                    border: `1.5px solid ${active ? colors.orange : '#e5e7eb'}`,
                                    background: active ? colors.orangeLight : colors.white,
                                }}
                            >
                                <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{
                                        background: active ? colors.orange : '#f1f5f9',
                                        color: active ? 'white' : colors.gray,
                                    }}
                                >
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M6 13h.01M18 13h.01"
                                        />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold" style={{ color: active ? colors.orange : colors.navy }}>
                                        {t('user.create.' + vehicle.type.toLowerCase())} — {vehicle.licensePlate}
                                    </p>
                                    {vehicle.color && (
                                        <p className="text-xs" style={{ color: colors.gray }}>
                                            {t('user.create.colorLabel')} {vehicle.color}
                                        </p>
                                    )}
                                </div>
                                {active && (
                                    <div
                                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ background: colors.orange }}
                                    >
                                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={onOpenAddVehicle}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                        style={{
                            color: colors.orange,
                            background: colors.orangeLight,
                            border: `1.5px dashed ${colors.orange}50`,
                        }}
                    >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        {t('user.create.addVehicleNewBtn')}
                    </button>
                </div>
            )}

            {showAddVehicle && (
                <div className="mt-3 p-4 rounded-xl space-y-3" style={{ background: colors.bg, border: `1.5px solid ${colors.border}` }}>
                    <p className="text-sm font-semibold" style={{ color: colors.navy }}>
                        {t('user.create.addNewVehicleTitle')}
                    </p>
                    <div className="flex gap-2">
                        {vehicleTypeOrder.map((vType) => (
                            <button
                                key={vType}
                                type="button"
                                onClick={() => setNewVehicle({ ...newVehicle, type: vType })}
                                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                                style={{
                                    background: newVehicle.type === vType ? colors.orange : colors.white,
                                    color: newVehicle.type === vType ? 'white' : colors.gray,
                                    border: `1.5px solid ${newVehicle.type === vType ? colors.orange : '#e5e7eb'}`,
                                }}
                            >
                                {t('user.create.' + vType.toLowerCase())}
                            </button>
                        ))}
                    </div>
                    <div>
                        <input
                            type="text"
                            value={newVehicle.licensePlate}
                            onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value.toUpperCase() })}
                            placeholder={t('user.create.platePlaceholder')}
                            style={{
                                ...inputStyle,
                                border: showPlateError ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                            }}
                            onFocus={(e) => {
                                if (!showPlateError) e.target.style.border = `1.5px solid ${colors.orange}`;
                            }}
                            onBlur={(e) => {
                                onPlateBlur?.();
                                if (!showPlateError && !isPlateInvalid) e.target.style.border = '1.5px solid #e5e7eb';
                            }}
                        />
                        {showPlateError && (
                            <p className="text-[11px] text-red-500 mt-1.5 pl-1">{t('user.create.toasts.plateInvalid')}</p>
                        )}
                    </div>
                    <div>
                        <input
                            type="text"
                            value={newVehicle.color}
                            onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                            placeholder={t('user.create.colorPlaceholder')}
                            style={{
                                ...inputStyle,
                                border: showColorError ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                            }}
                            onFocus={(e) => {
                                if (!showColorError) e.target.style.border = `1.5px solid ${colors.orange}`;
                            }}
                            onBlur={(e) => {
                                onColorBlur?.();
                                if (!showColorError && !isColorInvalid) e.target.style.border = '1.5px solid #e5e7eb';
                            }}
                        />
                        {showColorError && (
                            <p className="text-[11px] text-red-500 mt-1.5 pl-1">{t('user.create.toasts.colorInvalid')}</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onAddVehicle}
                            disabled={isAddBtnDisabled}
                            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: isAddBtnDisabled ? '#fdba74' : colors.orange }}
                        >
                            {t('user.create.addBtn')}
                        </button>
                        <button
                            type="button"
                            onClick={onCloseAddVehicle}
                            className="flex-1 py-2 rounded-xl text-sm font-medium"
                            style={{ background: colors.white, color: colors.gray, border: '1px solid #e5e7eb' }}
                        >
                            {t('user.create.cancelBtn')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
