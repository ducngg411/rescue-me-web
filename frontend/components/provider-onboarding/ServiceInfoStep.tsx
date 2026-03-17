'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Plus, Trash2, MapPin } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { searchPlaces, getPlaceDetails, PlaceSearchResult } from '@/lib/vietmap';
import { normalizeVietnamPlate, isValidVietnamPlate, formatVietnamPlate } from '@/lib/validators';

const C = { orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed', navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9', green: '#16a34a', red: '#ef4444' };

const inputCls = (err?: boolean) =>
    `w-full px-3 py-2.5 text-sm rounded-xl border transition-all focus:outline-none focus:ring-2 bg-white font-[Lexend] ${err ? 'border-red-400 bg-red-50 focus:ring-red-100' : 'border-gray-200 focus:ring-orange-100'}`;

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
            <div className="w-1 h-4 rounded-full" style={{ background: C.orange }} />
            <h2 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h2>
        </div>
        {children}
    </div>
);

interface ServiceInfoStepProps {
    initialData: any;
    onComplete: (data: any) => void;
    onBack: () => void;
    isShell?: boolean;
}

export default function ServiceInfoStep({ initialData, onComplete, onBack, isShell }: ServiceInfoStepProps) {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        providerType: initialData?.providerType || 'INDIVIDUAL',
        fullName: initialData?.fullName || '',
        phoneNumber: initialData?.phoneNumber || '',
        businessName: initialData?.businessName || '',
        serviceTypes: initialData?.serviceTypes || [],
        supportedVehicleTypes: initialData?.supportedVehicleTypes || [],
        serviceRadiusKm: initialData?.serviceRadiusKm || 15,
        permanentAddress: initialData?.permanentAddress || { addressText: '', lat: 0, lng: 0 },
        businessAddress: initialData?.businessAddress || { addressText: '', lat: 0, lng: 0 },
        rescueVehicles: initialData?.rescueVehicles || [{ type: 'CAR', plateNumber: '', isPrimary: true }],
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [addressQuery, setAddressQuery] = useState(
        initialData?.providerType === 'INDIVIDUAL'
            ? initialData?.permanentAddress?.addressText || ''
            : initialData?.businessAddress?.addressText || ''
    );
    const [addressSuggestions, setAddressSuggestions] = useState<PlaceSearchResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [addressSelected, setAddressSelected] = useState(!!initialData?.permanentAddress?.addressText || !!initialData?.businessAddress?.addressText);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const addressInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (addressSelected) return;
        const t = setTimeout(async () => {
            if (addressQuery.trim().length < 2) { setAddressSuggestions([]); return; }
            try {
                const r = await searchPlaces(addressQuery);
                setAddressSuggestions(r);
                setShowSuggestions(r.length > 0);
            } catch { setAddressSuggestions([]); }
        }, 300);
        return () => clearTimeout(t);
    }, [addressQuery, addressSelected]);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
                addressInputRef.current && !addressInputRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const handleSelectAddress = async (place: PlaceSearchResult) => {
        try {
            const details = place.refId ? await getPlaceDetails(place.refId) : null;
            const address = { addressText: place.displayName || details?.name || '', lat: details?.lat || 0, lng: details?.lng || 0 };
            if (formData.providerType === 'INDIVIDUAL') setFormData(p => ({ ...p, permanentAddress: address }));
            else setFormData(p => ({ ...p, businessAddress: address }));
            setAddressQuery(address.addressText);
            setShowSuggestions(false);
            setAddressSelected(true);
        } catch { }
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!formData.fullName.trim()) e.fullName = t('provider.onboarding.serviceInfo.errors.fullNameRequired');
        if (!formData.phoneNumber.trim()) e.phoneNumber = t('provider.onboarding.serviceInfo.errors.phoneRequired');
        if (formData.serviceTypes.length === 0) e.serviceTypes = t('provider.onboarding.serviceInfo.errors.serviceTypesRequired');
        if (formData.supportedVehicleTypes.length === 0) e.supportedVehicleTypes = t('provider.onboarding.serviceInfo.errors.supportedVehicleTypesRequired');
        if (!formData.serviceRadiusKm || formData.serviceRadiusKm < 5 || formData.serviceRadiusKm > 50) e.serviceRadiusKm = t('provider.onboarding.serviceInfo.errors.serviceRadiusInvalid');
        if (formData.providerType === 'BUSINESS') {
            if (!formData.businessName.trim()) e.businessName = t('provider.onboarding.serviceInfo.errors.businessNameRequired');
            if (!formData.businessAddress.addressText) e.businessAddress = t('provider.onboarding.serviceInfo.errors.addressRequired');
        } else {
            if (!formData.permanentAddress.addressText) e.permanentAddress = t('provider.onboarding.serviceInfo.errors.addressRequired');
        }
        if (!formData.rescueVehicles || formData.rescueVehicles.length === 0) {
            e.rescueVehicles = t('provider.onboarding.serviceInfo.errors.rescueVehiclesRequired');
        } else {
            formData.rescueVehicles.forEach((v: any, i: number) => {
                if (!v.plateNumber.trim()) e[`rv_${i}`] = t('provider.onboarding.serviceInfo.errors.plateRequired');
                else if (!isValidVietnamPlate(v.plateNumber)) e[`rv_${i}`] = t('provider.onboarding.serviceInfo.errors.plateInvalid');
            });
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = () => { if (validate()) onComplete(formData); };

    const currentAddr = formData.providerType === 'INDIVIDUAL' ? formData.permanentAddress : formData.businessAddress;
    const serviceTypes = [
        { value: 'TOWING', label: t('provider.onboarding.serviceInfo.serviceTypeOptions.TOWING') },
        { value: 'BATTERY_JUMP', label: t('provider.onboarding.serviceInfo.serviceTypeOptions.BATTERY_JUMP') },
        { value: 'TIRE_CHANGE', label: t('provider.onboarding.serviceInfo.serviceTypeOptions.TIRE_CHANGE') },
        { value: 'FUEL_DELIVERY', label: t('provider.onboarding.serviceInfo.serviceTypeOptions.FUEL_DELIVERY') },
        { value: 'LOCKOUT', label: t('provider.onboarding.serviceInfo.serviceTypeOptions.LOCKOUT') },
        { value: 'BREAKDOWN_REPAIR', label: t('provider.onboarding.serviceInfo.serviceTypeOptions.BREAKDOWN_REPAIR') },
    ];

    return (
        <div>
            {/* Basic info card */}
            <SectionCard title={t('provider.onboarding.serviceInfo.basicInfo.title')}>
                <div className="space-y-4">
                    {/* Provider type */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('provider.onboarding.serviceInfo.basicInfo.providerType')} <span style={{ color: C.red }}>*</span></label>
                        <div className="grid grid-cols-2 gap-3">
                            {[{ value: 'INDIVIDUAL', label: t('provider.onboarding.serviceInfo.basicInfo.providerTypeOptions.individual.label'), desc: t('provider.onboarding.serviceInfo.basicInfo.providerTypeOptions.individual.desc') }, { value: 'BUSINESS', label: t('provider.onboarding.serviceInfo.basicInfo.providerTypeOptions.business.label'), desc: t('provider.onboarding.serviceInfo.basicInfo.providerTypeOptions.business.desc') }].map(type => (
                                <button key={type.value} type="button"
                                    onClick={() => { setFormData(p => ({ ...p, providerType: type.value as any })); setAddressQuery(''); setAddressSelected(false); }}
                                    className="p-3 rounded-xl border-2 text-left transition-all"
                                    style={{ borderColor: formData.providerType === type.value ? C.orange : C.border, background: formData.providerType === type.value ? C.orangeLight : '#fff' }}>
                                    <p className="text-xs font-bold mb-0.5" style={{ color: formData.providerType === type.value ? C.orange : C.navy }}>{type.label}</p>
                                    <p className="text-[11px]" style={{ color: C.gray }}>{type.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('provider.onboarding.serviceInfo.basicInfo.fullName')} <span style={{ color: C.red }}>*</span></label>
                            <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} placeholder={t('provider.onboarding.serviceInfo.basicInfo.fullNamePlaceholder')} className={inputCls(!!errors.fullName)} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                            {errors.fullName && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.fullName}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('provider.onboarding.serviceInfo.basicInfo.phone')} <span style={{ color: C.red }}>*</span></label>
                            <input type="tel" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="0912345678" className={inputCls(!!errors.phoneNumber)} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                            {errors.phoneNumber && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.phoneNumber}</p>}
                        </div>
                    </div>

                    {formData.providerType === 'BUSINESS' && (
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('provider.onboarding.serviceInfo.basicInfo.businessName')} <span style={{ color: C.red }}>*</span></label>
                            <input type="text" value={formData.businessName} onChange={e => setFormData({ ...formData, businessName: e.target.value })} placeholder={t('provider.onboarding.serviceInfo.basicInfo.businessNamePlaceholder')} className={inputCls(!!errors.businessName)} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                            {errors.businessName && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.businessName}</p>}
                        </div>
                    )}

                    {/* Address */}
                    <div className="relative">
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>
                            {formData.providerType === 'INDIVIDUAL' ? t('provider.onboarding.serviceInfo.basicInfo.permanentAddress') : t('provider.onboarding.serviceInfo.basicInfo.businessAddress')} <span style={{ color: C.red }}>*</span>
                        </label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.gray }} />
                            <input ref={addressInputRef} type="text" value={addressQuery}
                                onChange={e => { const v = e.target.value; setAddressQuery(v); setAddressSelected(false); if (formData.providerType === 'INDIVIDUAL') setFormData(p => ({ ...p, permanentAddress: { addressText: '', lat: 0, lng: 0 } })); else setFormData(p => ({ ...p, businessAddress: { addressText: '', lat: 0, lng: 0 } })); if (v.trim().length >= 2) setShowSuggestions(true); }}
                                onFocus={() => { if (addressSuggestions.length > 0 && !addressSelected) setShowSuggestions(true); }}
                                placeholder={t('provider.onboarding.serviceInfo.basicInfo.addressPlaceholder')} autoComplete="off"
                                className={inputCls(!!(errors.permanentAddress || errors.businessAddress))} style={{ paddingLeft: '2.25rem', color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                        </div>
                        {showSuggestions && addressSuggestions.length > 0 && (
                            <div ref={suggestionsRef} className="absolute z-10 w-full mt-1 bg-white rounded-xl border shadow-lg max-h-52 overflow-y-auto" style={{ borderColor: C.border }}>
                                {addressSuggestions.map((s, i) => (
                                    <button key={i} type="button" onClick={() => handleSelectAddress(s)} className="w-full px-4 py-2.5 text-left border-b last:border-b-0 hover:bg-orange-50 transition-colors" style={{ borderColor: C.border }}>
                                        <div className="flex items-start gap-2">
                                            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: C.orange }} />
                                            <p className="text-xs" style={{ color: C.navy }}>{s.displayName}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {(errors.permanentAddress || errors.businessAddress) && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.permanentAddress || errors.businessAddress}</p>}
                        {currentAddr.addressText && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" style={{ color: C.green }} />
                                <p className="text-xs" style={{ color: C.green }}>{t('provider.onboarding.serviceInfo.basicInfo.addressSelected')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </SectionCard>

            {/* Services card */}
            <SectionCard title={t('provider.onboarding.serviceInfo.services.title')}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold mb-2" style={{ color: C.navy }}>{t('provider.onboarding.serviceInfo.services.serviceType')} <span style={{ color: C.red }}>*</span></label>
                        <div className="grid grid-cols-3 gap-2">
                            {serviceTypes.map(s => {
                                const active = formData.serviceTypes.includes(s.value);
                                return (
                                    <button key={s.value} type="button" onClick={() => setFormData(p => ({ ...p, serviceTypes: active ? p.serviceTypes.filter((x: string) => x !== s.value) : [...p.serviceTypes, s.value] }))}
                                        className="p-2.5 rounded-xl border-2 text-center transition-all"
                                        style={{ borderColor: active ? C.orange : C.border, background: active ? C.orangeLight : '#fff' }}>
                                        <p className="text-[11px] font-semibold" style={{ color: active ? C.orange : C.navy }}>{s.label}</p>
                                    </button>
                                );
                            })}
                        </div>
                        {errors.serviceTypes && <p className="mt-1.5 text-xs" style={{ color: C.red }}>{errors.serviceTypes}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-2" style={{ color: C.navy }}>{t('provider.onboarding.serviceInfo.services.customerVehicleType')} <span style={{ color: C.red }}>*</span></label>
                        <div className="grid grid-cols-2 gap-3">
                            {[{ value: 'CAR', label: t('provider.onboarding.serviceInfo.services.vehicleTypeOptions.car') }, { value: 'MOTORCYCLE', label: t('provider.onboarding.serviceInfo.services.vehicleTypeOptions.motorcycle') }].map(v => {
                                const active = formData.supportedVehicleTypes.includes(v.value);
                                return (
                                    <button key={v.value} type="button" onClick={() => setFormData(p => ({ ...p, supportedVehicleTypes: active ? p.supportedVehicleTypes.filter((x: string) => x !== v.value) : [...p.supportedVehicleTypes, v.value] }))}
                                        className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all"
                                        style={{ borderColor: active ? C.orange : C.border, background: active ? C.orangeLight : '#fff' }}>
                                        <span className="text-sm font-semibold" style={{ color: active ? C.orange : C.navy }}>{v.label}</span>
                                        {active && <CheckCircle className="w-4 h-4 ml-auto" style={{ color: C.orange }} />}
                                    </button>
                                );
                            })}
                        </div>
                        {errors.supportedVehicleTypes && <p className="mt-1.5 text-xs" style={{ color: C.red }}>{errors.supportedVehicleTypes}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-2" style={{ color: C.navy }}>
                            {t('provider.onboarding.serviceInfo.services.serviceRadius')}: <span style={{ color: C.orange }}>{formData.serviceRadiusKm} km</span>
                        </label>
                        <input type="range" min="5" max="50" step="5" value={formData.serviceRadiusKm}
                            onChange={e => setFormData({ ...formData, serviceRadiusKm: parseInt(e.target.value) })}
                            className="w-full cursor-pointer accent-orange-500" />
                        <div className="flex justify-between text-xs mt-1" style={{ color: C.gray }}><span>5 km</span><span>50 km</span></div>
                        {errors.serviceRadiusKm && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.serviceRadiusKm}</p>}
                    </div>
                </div>
            </SectionCard>

            {/* Rescue vehicles card */}
            <SectionCard title={t('provider.onboarding.serviceInfo.rescueVehicles.title')}>
                <div className="space-y-3">
                    {formData.rescueVehicles.map((vehicle: any, idx: number) => {
                        const errKey = `rv_${idx}`;
                        const plateOk = vehicle.plateNumber && isValidVietnamPlate(vehicle.plateNumber);
                        return (
                            <div key={idx} className="p-3 rounded-xl border" style={{ borderColor: C.border, background: C.bg }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold" style={{ color: C.navy }}>
                                        {t('provider.onboarding.serviceInfo.rescueVehicles.vehicle')} {idx + 1}
                                        {vehicle.isPrimary && <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: C.orangeLight, color: C.orange }}>{t('provider.onboarding.serviceInfo.rescueVehicles.primary')}</span>}
                                    </p>
                                    {formData.rescueVehicles.length > 1 && (
                                        <button type="button" onClick={() => {
                                            const nv = formData.rescueVehicles.filter((_: any, i: number) => i !== idx);
                                            if (vehicle.isPrimary && nv.length > 0) nv[0].isPrimary = true;
                                            setFormData({ ...formData, rescueVehicles: nv });
                                        }} className="p-1 rounded-lg hover:bg-red-50" style={{ color: C.red }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] font-medium mb-1" style={{ color: C.gray }}>{t('provider.onboarding.serviceInfo.rescueVehicles.vehicleType')}</label>
                                        <select value={vehicle.type}
                                            onChange={e => { const nv = [...formData.rescueVehicles]; nv[idx].type = e.target.value; setFormData({ ...formData, rescueVehicles: nv }); }}
                                            className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-100 bg-white" style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}>
                                            <option value="CAR">{t('provider.onboarding.serviceInfo.services.vehicleTypeOptions.car')}</option>
                                            <option value="MOTORCYCLE">{t('provider.onboarding.serviceInfo.services.vehicleTypeOptions.motorcycle')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium mb-1" style={{ color: C.gray }}>{t('provider.onboarding.serviceInfo.rescueVehicles.plateNumber')}</label>
                                        <input type="text" value={vehicle.plateNumber}
                                            onChange={e => { const v = e.target.value.toUpperCase(); const nv = [...formData.rescueVehicles]; nv[idx].plateNumber = v; setFormData({ ...formData, rescueVehicles: nv }); if (errors[errKey]) setErrors(p => { const { [errKey]: _, ...r } = p; return r; }); }}
                                            onBlur={() => { if (vehicle.plateNumber && isValidVietnamPlate(vehicle.plateNumber)) { const nv = [...formData.rescueVehicles]; nv[idx].plateNumber = formatVietnamPlate(vehicle.plateNumber); setFormData({ ...formData, rescueVehicles: nv }); } }}
                                            placeholder="29A-12345" className={inputCls(!!errors[errKey])} style={{ fontFamily: 'monospace', textTransform: 'uppercase', color: C.navy, fontSize: '12px' }} />
                                    </div>
                                </div>
                                {errors[errKey] ? <p className="mt-1 text-xs" style={{ color: C.red }}>{errors[errKey]}</p>
                                    : plateOk ? <div className="mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" style={{ color: C.green }} /><p className="text-xs" style={{ color: C.green }}>{t('provider.onboarding.serviceInfo.rescueVehicles.valid')}</p></div> : null}
                            </div>
                        );
                    })}
                    <button type="button"
                        onClick={() => setFormData({ ...formData, rescueVehicles: [...formData.rescueVehicles, { type: 'CAR', plateNumber: '', isPrimary: false }] })}
                        className="w-full py-2.5 rounded-xl border-2 border-dashed text-xs font-semibold flex items-center justify-center gap-2 transition-colors hover:border-orange-300 hover:text-orange-500 bg-white"
                        style={{ borderColor: C.border, color: C.gray }}>
                        <Plus className="w-3.5 h-3.5" /> {t('provider.onboarding.serviceInfo.rescueVehicles.addVehicle')}
                    </button>
                    {errors.rescueVehicles && <p className="text-xs" style={{ color: C.red }}>{errors.rescueVehicles}</p>}
                </div>
            </SectionCard>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
                <button onClick={onBack} className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50"
                    style={{ borderColor: C.border, color: C.gray }}>
                    {t('provider.onboarding.common.back')}
                </button>
                <button onClick={handleSubmit} className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 transition-all"
                    style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}>
                    {t('provider.onboarding.common.continue')} →
                </button>
            </div>
        </div>
    );
}
