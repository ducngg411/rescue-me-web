'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Bike, MapPin, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { updateUserProfile, UpdateUserProfileData } from '@/lib/auth';
import { searchPlaces, getPlaceDetails, PlaceSearchResult } from '@/lib/vietmap';
import { normalizeVietnamPlate, isValidVietnamPlate, formatVietnamPlate } from '@/lib/validators';
import RescueMeLogo from '@/components/RescueMeLogo';

const C = { orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed', navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9', green: '#16a34a', red: '#ef4444' };
const VEHICLE_COLOR_KEYS = ['white', 'black', 'gray', 'silver', 'red', 'blue', 'green', 'yellow', 'orange', 'brown'] as const;

const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 text-sm rounded-xl border transition-all focus:outline-none focus:ring-2 ${err ? 'border-red-400 bg-red-50 focus:ring-red-100' : 'border-gray-200 bg-white focus:ring-orange-100'}`;

export default function UserProfilePage() {
    const router = useRouter();
    const { user, loading, refreshUser } = useAuth();
    const { t } = useLanguage();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showCustomColor, setShowCustomColor] = useState(false);
    const addressInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const [addressQuery, setAddressQuery] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState<PlaceSearchResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isAddressSelected, setIsAddressSelected] = useState(false);

    const [formData, setFormData] = useState<UpdateUserProfileData>({
        fullName: '', phoneNumber: '', contactEmail: '',
        defaultAddress: undefined, vehicleType: 'CAR', licensePlate: '', vehicleColor: VEHICLE_COLOR_KEYS[0],
    });

    useEffect(() => {
        if (!loading && !user) { router.push('/auth/login'); return; }
        if (user?.profileCompleted) { router.push('/user'); return; }
        if (user?.role !== 'USER') { router.push('/provider/onboarding'); return; }
    }, [user, loading, router]);

    useEffect(() => {
        if (isAddressSelected) return;
        const t = setTimeout(async () => {
            if (addressQuery.trim().length < 2) { setAddressSuggestions([]); return; }
            setIsSearching(true);
            try { const r = await searchPlaces(addressQuery); setAddressSuggestions(r); setShowSuggestions(true); }
            catch { } finally { setIsSearching(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [addressQuery, isAddressSelected]);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
                addressInputRef.current && !addressInputRef.current.contains(e.target as Node))
                setShowSuggestions(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const handleSelectAddress = async (s: PlaceSearchResult) => {
        setIsAddressSelected(true); setAddressQuery(s.displayName); setShowSuggestions(false); setAddressSuggestions([]);
        if (s.refId) { try { const d = await getPlaceDetails(s.refId); if (d) setFormData(p => ({ ...p, defaultAddress: { addressText: d.display, lat: d.lat, lng: d.lng } })); } catch { } }
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!formData.fullName.trim()) e.fullName = t('onboarding.userProfile.errors.fullNameRequired');
        if (!formData.phoneNumber.trim()) e.phoneNumber = t('onboarding.userProfile.errors.phoneRequired');
        else if (!/^0[39][0-9]{8}$/.test(formData.phoneNumber)) e.phoneNumber = t('onboarding.userProfile.errors.phoneInvalid');
        if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) e.contactEmail = t('onboarding.userProfile.errors.emailInvalid');
        if (!formData.licensePlate.trim()) e.licensePlate = t('onboarding.userProfile.errors.plateRequired');
        else if (!isValidVietnamPlate(formData.licensePlate)) e.licensePlate = t('onboarding.userProfile.errors.plateInvalid');
        if (!formData.vehicleColor.trim()) e.vehicleColor = t('onboarding.userProfile.errors.colorRequired');
        setErrors(e); return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault(); if (!validate()) return;
        setIsSubmitting(true); setErrors({});
        try {
            await updateUserProfile({ ...formData, licensePlate: normalizeVietnamPlate(formData.licensePlate) });
            await refreshUser(); router.push('/user');
        } catch (err: any) {
            const msg = err.response?.data?.message;
            if (Array.isArray(msg)) {
                const map: Record<string, string> = {};
                msg.forEach((m: string) => {
                    if (m.includes('Họ tên')) map.fullName = m;
                    else if (m.includes('điện thoại')) map.phoneNumber = m;
                    else if (m.includes('Email')) map.contactEmail = m;
                    else if (m.includes('Biển số')) map.licensePlate = m;
                    else map.general = m;
                });
                setErrors(map);
            } else setErrors({ general: msg || t('onboarding.userProfile.errors.generic') });
        } finally { setIsSubmitting(false); }
    };

    if (loading || !user) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
            <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
        </div>
    );

    const plateOk = formData.licensePlate && isValidVietnamPlate(formData.licensePlate);

    // Dynamic step completion
    const part1Done = !!(formData.fullName.trim() && /^0[39][0-9]{8}$/.test(formData.phoneNumber));
    const part2Done = !!(plateOk && formData.vehicleColor.trim());

    return (
        <div className="h-screen flex overflow-hidden" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}>
            {/* Left panel */}
            <div className="hidden lg:flex flex-col justify-between p-12 flex-shrink-0 h-screen overflow-y-auto" style={{ width: '420px', background: `linear-gradient(155deg, ${C.navy} 0%, #2d2d4e 100%)` }}>
                <div className="flex items-center gap-3">
                    <RescueMeLogo size={36} textClass="text-base" textColor="white" />
                </div>
                <div className="space-y-5">
                    <div>
                        <h2 className="text-white text-xl font-bold mb-2">{t('onboarding.userProfile.sidebar.title')}</h2>
                        <p className="text-white/60 text-sm leading-relaxed">{t('onboarding.userProfile.sidebar.subtitle')}</p>
                    </div>
                    <div className="space-y-3">
                        {[
                            { n: 1, label: t('onboarding.userProfile.sidebar.steps.selectRole'), done: true },
                            { n: 2, label: t('onboarding.userProfile.sidebar.steps.personalInfo'), done: part1Done },
                            { n: 3, label: t('onboarding.userProfile.sidebar.steps.vehicleInfo'), done: part2Done },
                        ].map((s, i) => (
                            <div key={s.n} className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300"
                                    style={{ background: s.done ? C.green : 'rgba(255,255,255,0.15)', color: 'white' }}>
                                    {s.done ? '✓' : s.n}
                                </div>
                                <span className="text-sm transition-colors duration-300" style={{ color: s.done ? 'white' : 'rgba(255,255,255,0.45)' }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                        <p className="text-white/80 text-xs leading-relaxed">💡 <strong className="text-white">{t('onboarding.userProfile.sidebar.tipLabel')}</strong> {t('onboarding.userProfile.sidebar.tipText')}</p>
                    </div>
                </div>
                <p className="text-white/30 text-xs">{t('onboarding.role.footerRights')}</p>
            </div>

            {/* Right form */}
            <div className="flex-1 overflow-y-auto h-screen">
                <div className="min-h-full flex flex-col py-10 px-6 max-w-2xl mx-auto">
                    <div className="w-full max-w-lg">
                        {/* Mobile logo */}
                        <div className="flex items-center gap-2 mb-6 lg:hidden">
                            <RescueMeLogo size={32} textClass="text-base" />
                        </div>

                        <div className="mb-6">
                            <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>{t('onboarding.userProfile.header.title')}</h1>
                            <p className="text-sm" style={{ color: C.gray }}>{t('onboarding.userProfile.header.subtitle')}</p>
                        </div>

                        {errors.general && (
                            <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: C.red, border: '1px solid #fecaca' }}>
                                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {errors.general}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {/* Personal info card */}
                            <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
                                <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: C.orangeLight }}>
                                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                    <h2 className="text-sm font-bold" style={{ color: C.navy }}>{t('onboarding.userProfile.personal.title')}</h2>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('onboarding.userProfile.personal.fullName')} <span style={{ color: C.red }}>*</span></label>
                                        <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} placeholder={t('onboarding.userProfile.personal.fullNamePlaceholder')} className={inputCls(errors.fullName)} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                                        {errors.fullName && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.fullName}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('onboarding.userProfile.personal.phone')} <span style={{ color: C.red }}>*</span></label>
                                            <input type="tel" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder={t('onboarding.userProfile.personal.phonePlaceholder')} className={inputCls(errors.phoneNumber)} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                                            {errors.phoneNumber && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.phoneNumber}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('onboarding.userProfile.personal.contactEmail')}</label>
                                            <input type="email" value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} placeholder="email@example.com" className={inputCls(errors.contactEmail)} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                                            {errors.contactEmail && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.contactEmail}</p>}
                                        </div>
                                    </div>
                                    {/* Address */}
                                    <div className="relative">
                                        <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('onboarding.userProfile.personal.defaultAddress')}</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.gray }} />
                                            <input ref={addressInputRef} type="text" value={addressQuery}
                                                onChange={e => { const v = e.target.value; setAddressQuery(v); if (isAddressSelected) { setIsAddressSelected(false); setFormData(p => ({ ...p, defaultAddress: undefined })); } if (v.trim().length >= 2) setShowSuggestions(true); }}
                                                onFocus={() => { if (addressSuggestions.length > 0 && !isAddressSelected) setShowSuggestions(true); }}
                                                placeholder={t('onboarding.userProfile.personal.addressPlaceholder')} autoComplete="off"
                                                className={inputCls()} style={{ paddingLeft: '2.25rem', color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                                        </div>
                                        {showSuggestions && (addressSuggestions.length > 0 || isSearching) && (
                                            <div ref={suggestionsRef} className="absolute z-10 w-full mt-1 bg-white rounded-xl border shadow-lg max-h-52 overflow-y-auto" style={{ borderColor: C.border }}>
                                                {isSearching ? (
                                                    <div className="px-4 py-3 text-sm flex items-center gap-2" style={{ color: C.gray }}>
                                                        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                                        {t('onboarding.userProfile.personal.searchingAddress')}
                                                    </div>
                                                ) : addressSuggestions.map((s, i) => (
                                                    <button key={i} type="button" onClick={() => handleSelectAddress(s)} className="w-full px-4 py-2.5 text-left border-b last:border-b-0 hover:bg-orange-50 transition-colors" style={{ borderColor: C.border }}>
                                                        <div className="flex items-start gap-2">
                                                            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: C.orange }} />
                                                            <div><p className="text-xs font-medium" style={{ color: C.navy }}>{s.displayName}</p>{s.address && s.address !== s.displayName && <p className="text-[11px] mt-0.5" style={{ color: C.gray }}>{s.address}</p>}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {formData.defaultAddress && (
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <CheckCircle className="w-3.5 h-3.5" style={{ color: C.green }} />
                                                <p className="text-xs" style={{ color: C.green }}>{t('onboarding.userProfile.personal.addressSelected')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Vehicle card */}
                            <div className="bg-white rounded-2xl border p-5 mb-6" style={{ borderColor: C.border }}>
                                <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: C.orangeLight }}>
                                        <Car className="w-3.5 h-3.5" style={{ color: C.orange }} />
                                    </div>
                                    <h2 className="text-sm font-bold" style={{ color: C.navy }}>{t('onboarding.userProfile.vehicle.title')}</h2>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('onboarding.userProfile.vehicle.type')} <span style={{ color: C.red }}>*</span></label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[{ value: 'CAR', label: t('onboarding.userProfile.vehicle.typeOptions.car'), icon: <Car className="w-5 h-5" /> }, { value: 'MOTORCYCLE', label: t('onboarding.userProfile.vehicle.typeOptions.motorcycle'), icon: <Bike className="w-5 h-5" /> }].map(v => (
                                                <button key={v.value} type="button" onClick={() => setFormData({ ...formData, vehicleType: v.value as any })}
                                                    className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all"
                                                    style={{ borderColor: formData.vehicleType === v.value ? C.orange : C.border, background: formData.vehicleType === v.value ? C.orangeLight : '#ffffff', color: formData.vehicleType === v.value ? C.orange : C.gray }}>
                                                    {v.icon}<span className="text-sm font-semibold">{v.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('onboarding.userProfile.vehicle.licensePlate')} <span style={{ color: C.red }}>*</span></label>
                                            <input type="text" value={formData.licensePlate}
                                                onChange={e => { const v = e.target.value.toUpperCase(); setFormData({ ...formData, licensePlate: v }); if (errors.licensePlate) setErrors(p => { const { licensePlate, ...r } = p; return r; }); }}
                                                onBlur={() => { if (formData.licensePlate && isValidVietnamPlate(formData.licensePlate)) setFormData(p => ({ ...p, licensePlate: formatVietnamPlate(p.licensePlate) })); }}
                                                placeholder="51A-12345" className={inputCls(errors.licensePlate)} style={{ fontFamily: 'monospace', textTransform: 'uppercase', color: C.navy }} />
                                            {errors.licensePlate ? <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.licensePlate}</p>
                                                : plateOk ? <div className="mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" style={{ color: C.green }} /><p className="text-xs" style={{ color: C.green }}>{t('onboarding.userProfile.vehicle.plateValid')}</p></div> : null}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>{t('onboarding.userProfile.vehicle.color')} <span style={{ color: C.red }}>*</span></label>
                                            <select value={showCustomColor ? 'custom' : formData.vehicleColor}
                                                onChange={e => { if (e.target.value === 'custom') { setShowCustomColor(true); setFormData({ ...formData, vehicleColor: '' }); } else { setShowCustomColor(false); setFormData({ ...formData, vehicleColor: e.target.value }); } }}
                                                className="w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-100" style={{ borderColor: C.border, color: C.navy, background: 'white', fontFamily: 'Lexend, sans-serif' }}>
                                                {VEHICLE_COLOR_KEYS.map(c => <option key={c} value={c}>{t(`onboarding.userProfile.vehicle.colorOptions.${c}`)}</option>)}
                                                <option value="custom">{t('onboarding.userProfile.vehicle.colorCustom')}</option>
                                            </select>
                                            {errors.vehicleColor && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.vehicleColor}</p>}
                                        </div>
                                    </div>
                                    {showCustomColor && (
                                        <input type="text" value={formData.vehicleColor} onChange={e => setFormData({ ...formData, vehicleColor: e.target.value })} placeholder={t('onboarding.userProfile.vehicle.colorCustomPlaceholder')} className={inputCls()} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => router.push('/onboarding/role')}
                                className="w-full py-3 rounded-2xl font-medium text-sm mb-3 flex items-center justify-center gap-2 border transition-all"
                                style={{ color: C.gray, borderColor: C.border, background: 'white' }}
                            >
                                {t('onboarding.userProfile.backRole')}
                            </button>

                            <button type="submit" disabled={isSubmitting} className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
                                style={{ background: isSubmitting ? C.border : `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                                {isSubmitting ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /><span>{t('onboarding.userProfile.submitting')}</span></> : <><span>{t('onboarding.userProfile.submit')}</span><ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
