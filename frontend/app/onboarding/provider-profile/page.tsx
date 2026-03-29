'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, CheckCircle, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { updateProviderProfile, UpdateProviderProfileData, RescueVehicle } from '@/lib/auth';
import { searchPlaces, getPlaceDetails, PlaceSearchResult } from '@/lib/vietmap';
import { normalizeVietnamPlate, isValidVietnamPlate, formatVietnamPlate } from '@/lib/validators';
import RescueMeLogo from '@/components/RescueMeLogo';

const C = { orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed', navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9', green: '#16a34a', red: '#ef4444' };

const SERVICE_TYPES = [
    { value: 'TOWING', label: 'Kéo xe', icon: '' },
    { value: 'BATTERY_JUMP', label: 'Cứu bình', icon: '🔋' },
    { value: 'TIRE_CHANGE', label: 'Thay lốp', icon: '🛞' },
    { value: 'FUEL_DELIVERY', label: 'Tiếp nhiên liệu', icon: '⛽' },
    { value: 'LOCKOUT', label: 'Mở khóa xe', icon: '🔑' },
    { value: 'BREAKDOWN_REPAIR', label: 'Sửa tại chỗ', icon: '' },
];

const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 text-sm rounded-xl border transition-all focus:outline-none focus:ring-2 ${err ? 'border-red-400 bg-red-50 focus:ring-red-100' : 'border-gray-200 bg-white focus:ring-orange-100'}`;

const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: C.orangeLight }}>{icon}</div>
        <h2 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h2>
    </div>
);

export default function ProviderProfilePage() {
    const router = useRouter();
    const { user, loading, refreshUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const addressInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const [addressQuery, setAddressQuery] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState<PlaceSearchResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isAddressSelected, setIsAddressSelected] = useState(false);

    const [formData, setFormData] = useState({
        providerType: 'INDIVIDUAL' as 'INDIVIDUAL' | 'BUSINESS',
        fullName: '', phoneNumber: '', businessName: '',
        serviceTypes: [] as string[],
        supportedVehicleTypes: [] as string[],
        serviceRadiusKm: 15,
        permanentAddress: { addressText: '', lat: 0, lng: 0 },
        businessAddress: { addressText: '', lat: 0, lng: 0 },
        rescueVehicles: [{ type: 'CAR' as 'CAR' | 'MOTORCYCLE', plateNumber: '', isPrimary: true }] as RescueVehicle[],
    });

    useEffect(() => {
        if (!loading && !user) { router.push('/auth/login'); return; }
        if (user?.profileCompleted) { router.push('/'); return; }
        if (user?.role !== 'PROVIDER') { router.push('/onboarding/user-profile'); return; }
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
        if (s.refId) {
            try {
                const d = await getPlaceDetails(s.refId);
                if (d) {
                    const addr = { addressText: d.display, lat: d.lat, lng: d.lng };
                    if (formData.providerType === 'INDIVIDUAL') setFormData(p => ({ ...p, permanentAddress: addr }));
                    else setFormData(p => ({ ...p, businessAddress: addr }));
                }
            } catch { }
        }
    };

    const toggleService = (v: string) => setFormData(p => ({ ...p, serviceTypes: p.serviceTypes.includes(v) ? p.serviceTypes.filter(x => x !== v) : [...p.serviceTypes, v] }));
    const toggleVehicle = (v: string) => setFormData(p => ({ ...p, supportedVehicleTypes: p.supportedVehicleTypes.includes(v) ? p.supportedVehicleTypes.filter(x => x !== v) : [...p.supportedVehicleTypes, v] }));

    const validate = () => {
        const e: Record<string, string> = {};
        if (!formData.fullName.trim()) e.fullName = 'Họ tên không được để trống';
        if (!formData.phoneNumber.trim()) e.phoneNumber = 'SĐT không được để trống';
        else if (!/^0[39][0-9]{8}$/.test(formData.phoneNumber)) e.phoneNumber = 'SĐT không hợp lệ';
        if (formData.providerType === 'BUSINESS') {
            if (!formData.businessName.trim()) e.businessName = 'Tên doanh nghiệp không được để trống';
            if (!formData.businessAddress.addressText) e.businessAddress = 'Địa chỉ doanh nghiệp không được để trống';
        } else {
            if (!formData.permanentAddress.addressText) e.permanentAddress = 'Địa chỉ thường trú không được để trống';
        }
        if (formData.serviceTypes.length === 0) e.serviceTypes = 'Phải chọn ít nhất một dịch vụ';
        if (formData.supportedVehicleTypes.length === 0) e.supportedVehicleTypes = 'Phải chọn ít nhất một loại xe';
        if (formData.rescueVehicles.length === 0) e.rescueVehicles = 'Phải có ít nhất một phương tiện cứu hộ';
        formData.rescueVehicles.forEach((v, i) => {
            if (!v.plateNumber.trim()) e[`rv_${i}`] = 'Biển số không được để trống';
            else if (!isValidVietnamPlate(v.plateNumber)) e[`rv_${i}`] = 'Biển số không hợp lệ';
        });
        setErrors(e); return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault(); if (!validate()) return;
        setIsSubmitting(true); setErrors({});
        try {
            const normalizedVehicles = formData.rescueVehicles.map(v => ({ ...v, plateNumber: normalizeVietnamPlate(v.plateNumber) }));
            const data: UpdateProviderProfileData = {
                providerType: formData.providerType, fullName: formData.fullName, phoneNumber: formData.phoneNumber,
                serviceTypes: formData.serviceTypes, supportedVehicleTypes: formData.supportedVehicleTypes,
                serviceRadiusKm: formData.serviceRadiusKm, rescueVehicles: normalizedVehicles,
            };
            if (formData.providerType === 'BUSINESS') { data.businessName = formData.businessName; data.businessAddress = formData.businessAddress; }
            else { data.permanentAddress = formData.permanentAddress; }
            await updateProviderProfile(data);
            await refreshUser();
            router.push('/');
        } catch (err: any) { setErrors({ general: err.response?.data?.message || 'Có lỗi xảy ra' }); }
        finally { setIsSubmitting(false); }
    };

    if (loading || !user) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
            <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
        </div>
    );

    const currentAddr = formData.providerType === 'INDIVIDUAL' ? formData.permanentAddress : formData.businessAddress;

    // Dynamic step completion
    const part1Done = !!(
        formData.fullName.trim() &&
        /^0[39][0-9]{8}$/.test(formData.phoneNumber) &&
        currentAddr.addressText &&
        (formData.providerType === 'INDIVIDUAL' || formData.businessName.trim())
    );
    const part2Done = !!(
        formData.serviceTypes.length > 0 &&
        formData.supportedVehicleTypes.length > 0 &&
        formData.rescueVehicles.length > 0 &&
        formData.rescueVehicles.every(v => v.plateNumber && isValidVietnamPlate(v.plateNumber))
    );

    return (
        <div className="min-h-screen flex" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}>
            {/* Left panel */}
            <div className="hidden lg:flex flex-col justify-between p-10 flex-shrink-0" style={{ width: '340px', background: `linear-gradient(155deg, ${C.navy} 0%, #2d2d4e 100%)` }}>
                <div className="flex items-center gap-3">
                    <RescueMeLogo size={36} textClass="text-base" textColor="white" />
                </div>
                <div className="space-y-5">
                    <div>
                        <h2 className="text-white text-xl font-bold mb-2">Hồ sơ nhà cung cấp</h2>
                        <p className="text-white/60 text-sm leading-relaxed">Điền đầy đủ thông tin để được xét duyệt và bắt đầu nhận lệnh cứu hộ.</p>
                    </div>
                    <div className="space-y-3">
                        {[
                            { n: 1, label: 'Chọn vai trò', done: true },
                            { n: 2, label: 'Thông tin cơ bản', done: part1Done },
                            { n: 3, label: 'Dịch vụ & phương tiện', done: part2Done },
                        ].map(s => (
                            <div key={s.n} className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300"
                                    style={{ background: s.done ? C.green : 'rgba(255,255,255,0.15)', color: 'white' }}>
                                    {s.done ? '✓' : s.n}
                                </div>
                                <span className="text-sm transition-colors duration-300" style={{ color: s.done ? 'white' : 'rgba(255,255,255,0.45)' }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 border border-white/10 space-y-2">
                        <p className="text-white text-xs font-semibold">Sau khi hoàn thành:</p>
                        {['Hồ sơ sẽ được gửi xét duyệt', 'Admin xem xét trong 24–48h', 'Bạn nhận thông báo kết quả'].map(t => (
                            <div key={t} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
                                <p className="text-white/70 text-xs">{t}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <p className="text-white/30 text-xs">© 2026 RescueMe. All rights reserved.</p>
            </div>

            {/* Right form */}
            <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex items-start justify-center py-10 px-6">
                    <div className="w-full max-w-xl">
                        {/* Mobile logo */}
                        <div className="flex items-center gap-2 mb-6 lg:hidden">
                            <RescueMeLogo size={32} textClass="text-base" />
                        </div>

                        <div className="mb-6">
                            <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>Hồ sơ nhà cung cấp</h1>
                            <p className="text-sm" style={{ color: C.gray }}>Thông tin sẽ được admin xét duyệt trước khi bạn có thể nhận lệnh</p>
                        </div>

                        {errors.general && (
                            <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: C.red, border: '1px solid #fecaca' }}>
                                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {errors.general}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Provider type + Basic info */}
                            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                                <SectionHeader icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} title="Thông tin cơ bản" />
                                <div className="space-y-4">
                                    {/* Provider type toggle */}
                                    <div>
                                        <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>Loại nhà cung cấp <span style={{ color: C.red }}>*</span></label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[{ value: 'INDIVIDUAL', label: 'Cá nhân', desc: 'Tự kinh doanh' }, { value: 'BUSINESS', label: 'Doanh nghiệp', desc: 'Công ty / Hộ kinh doanh' }].map(t => (
                                                <button key={t.value} type="button"
                                                    onClick={() => { setFormData(p => ({ ...p, providerType: t.value as any })); setAddressQuery(''); setIsAddressSelected(false); }}
                                                    className="p-3 rounded-xl border-2 text-left transition-all"
                                                    style={{ borderColor: formData.providerType === t.value ? C.orange : C.border, background: formData.providerType === t.value ? C.orangeLight : '#ffffff' }}>
                                                    <p className="text-xs font-bold mb-0.5" style={{ color: formData.providerType === t.value ? C.orange : C.navy }}>{t.label}</p>
                                                    <p className="text-[11px]" style={{ color: C.gray }}>{t.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Name + Phone */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>Họ và tên <span style={{ color: C.red }}>*</span></label>
                                            <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} placeholder="Nguyễn Văn A" className={inputCls(errors.fullName)} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                                            {errors.fullName && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.fullName}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>Số điện thoại <span style={{ color: C.red }}>*</span></label>
                                            <input type="tel" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="0912345678" className={inputCls(errors.phoneNumber)} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                                            {errors.phoneNumber && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.phoneNumber}</p>}
                                        </div>
                                    </div>
                                    {/* Business name (conditional) */}
                                    {formData.providerType === 'BUSINESS' && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>Tên doanh nghiệp <span style={{ color: C.red }}>*</span></label>
                                            <input type="text" value={formData.businessName} onChange={e => setFormData({ ...formData, businessName: e.target.value })} placeholder="Cứu hộ ABC" className={inputCls(errors.businessName)} style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                                            {errors.businessName && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.businessName}</p>}
                                        </div>
                                    )}
                                    {/* Address */}
                                    <div className="relative">
                                        <label className="block text-xs font-semibold mb-1.5" style={{ color: C.navy }}>
                                            {formData.providerType === 'INDIVIDUAL' ? 'Địa chỉ thường trú' : 'Địa chỉ doanh nghiệp'} <span style={{ color: C.red }}>*</span>
                                        </label>
                                        {formData.providerType === 'BUSINESS' && (
                                            <p className="text-[11px] leading-snug mb-1.5" style={{ color: C.gray }}>
                                                Địa chỉ này dùng để hiển thị vị trí cứu hộ của bạn trên bản đồ và trong mục “cứu hộ gần đây” cho khách — nên chọn đúng điểm hoạt động (cơ sở / bãi xe), không nhất thiết trùng tên doanh nghiệp trên giấy phép.
                                            </p>
                                        )}
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.gray }} />
                                            <input ref={addressInputRef} type="text" value={addressQuery}
                                                onChange={e => {
                                                    const v = e.target.value; setAddressQuery(v);
                                                    if (isAddressSelected) {
                                                        setIsAddressSelected(false);
                                                        if (formData.providerType === 'INDIVIDUAL') setFormData(p => ({ ...p, permanentAddress: { addressText: '', lat: 0, lng: 0 } }));
                                                        else setFormData(p => ({ ...p, businessAddress: { addressText: '', lat: 0, lng: 0 } }));
                                                    }
                                                    if (v.trim().length >= 2) setShowSuggestions(true);
                                                }}
                                                onFocus={() => { if (addressSuggestions.length > 0 && !isAddressSelected) setShowSuggestions(true); }}
                                                placeholder="Nhập địa chỉ..." autoComplete="off"
                                                className={inputCls(errors.permanentAddress || errors.businessAddress)} style={{ paddingLeft: '2.25rem', color: C.navy, fontFamily: 'Lexend, sans-serif' }} />
                                        </div>
                                        {showSuggestions && (addressSuggestions.length > 0 || isSearching) && (
                                            <div ref={suggestionsRef} className="absolute z-10 w-full mt-1 bg-white rounded-xl border shadow-lg max-h-52 overflow-y-auto" style={{ borderColor: C.border }}>
                                                {isSearching ? (
                                                    <div className="px-4 py-3 text-sm flex items-center gap-2" style={{ color: C.gray }}>
                                                        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                                        Đang tìm kiếm...
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
                                        {(errors.permanentAddress || errors.businessAddress) && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.permanentAddress || errors.businessAddress}</p>}
                                        {currentAddr.addressText && (
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <CheckCircle className="w-3.5 h-3.5" style={{ color: C.green }} />
                                                <p className="text-xs" style={{ color: C.green }}>Đã chọn địa chỉ</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Services */}
                            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                                <SectionHeader icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} title="Dịch vụ cung cấp" />
                                <div>
                                    <label className="block text-xs font-semibold mb-2" style={{ color: C.navy }}>Loại dịch vụ <span style={{ color: C.red }}>*</span></label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {SERVICE_TYPES.map(s => {
                                            const active = formData.serviceTypes.includes(s.value);
                                            return (
                                                <button key={s.value} type="button" onClick={() => toggleService(s.value)}
                                                    className="p-2.5 rounded-xl border-2 text-center transition-all"
                                                    style={{ borderColor: active ? C.orange : C.border, background: active ? C.orangeLight : '#ffffff' }}>
                                                    <p className="text-[11px] font-semibold" style={{ color: active ? C.orange : C.navy }}>{s.label}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {errors.serviceTypes && <p className="mt-1.5 text-xs" style={{ color: C.red }}>{errors.serviceTypes}</p>}
                                </div>

                                <div className="mt-4">
                                    <label className="block text-xs font-semibold mb-2" style={{ color: C.navy }}>Xe khách hàng bạn phục vụ <span style={{ color: C.red }}>*</span></label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[{ value: 'CAR', label: 'Ô tô' }, { value: 'MOTORCYCLE', label: 'Xe máy' }].map(v => {
                                            const active = formData.supportedVehicleTypes.includes(v.value);
                                            return (
                                                <button key={v.value} type="button" onClick={() => toggleVehicle(v.value)}
                                                    className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all"
                                                    style={{ borderColor: active ? C.orange : C.border, background: active ? C.orangeLight : '#ffffff' }}>
                                                    <span className="text-sm font-semibold" style={{ color: active ? C.orange : C.navy }}>{v.label}</span>
                                                    {active && <CheckCircle className="w-4 h-4 ml-auto" style={{ color: C.orange }} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {errors.supportedVehicleTypes && <p className="mt-1.5 text-xs" style={{ color: C.red }}>{errors.supportedVehicleTypes}</p>}
                                </div>

                                {/* Service radius */}
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold mb-2" style={{ color: C.navy }}>
                                        Bán kính hoạt động: <span style={{ color: C.orange }}>{formData.serviceRadiusKm} km</span>
                                    </label>
                                    <input type="range" min="5" max="50" step="5" value={formData.serviceRadiusKm}
                                        onChange={e => setFormData({ ...formData, serviceRadiusKm: parseInt(e.target.value) })}
                                        className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ accentColor: C.orange }} />
                                    <div className="flex justify-between text-xs mt-1" style={{ color: C.gray }}><span>5 km</span><span>50 km</span></div>
                                </div>
                            </div>

                            {/* Rescue vehicles */}
                            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                                <SectionHeader icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>} title="Phương tiện cứu hộ của bạn" />
                                <div className="space-y-3">
                                    {formData.rescueVehicles.map((vehicle, idx) => {
                                        const errKey = `rv_${idx}`;
                                        const plateOk = vehicle.plateNumber && isValidVietnamPlate(vehicle.plateNumber);
                                        return (
                                            <div key={idx} className="p-3 rounded-xl border" style={{ borderColor: C.border, background: C.bg }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-semibold" style={{ color: C.navy }}>Phương tiện {idx + 1}{vehicle.isPrimary && <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: C.orangeLight, color: C.orange }}>Chính</span>}</p>
                                                    {formData.rescueVehicles.length > 1 && (
                                                        <button type="button" onClick={() => {
                                                            const nv = formData.rescueVehicles.filter((_, i) => i !== idx);
                                                            if (vehicle.isPrimary && nv.length > 0) nv[0].isPrimary = true;
                                                            setFormData({ ...formData, rescueVehicles: nv });
                                                        }} className="p-1 rounded-lg hover:bg-red-50 transition-colors" style={{ color: C.red }}>
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[11px] font-medium mb-1" style={{ color: C.gray }}>Loại xe</label>
                                                        <select value={vehicle.type}
                                                            onChange={e => { const nv = [...formData.rescueVehicles]; nv[idx].type = e.target.value as any; setFormData({ ...formData, rescueVehicles: nv }); }}
                                                            className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-100 bg-white" style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}>
                                                            <option value="CAR">Ô tô</option>
                                                            <option value="MOTORCYCLE">Xe máy</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-medium mb-1" style={{ color: C.gray }}>Biển số xe</label>
                                                        <input type="text" value={vehicle.plateNumber}
                                                            onChange={e => {
                                                                const v = e.target.value.toUpperCase();
                                                                const nv = [...formData.rescueVehicles]; nv[idx].plateNumber = v;
                                                                setFormData({ ...formData, rescueVehicles: nv });
                                                                if (errors[errKey]) setErrors(p => { const { [errKey]: _, ...r } = p; return r; });
                                                            }}
                                                            onBlur={() => {
                                                                if (vehicle.plateNumber && isValidVietnamPlate(vehicle.plateNumber)) {
                                                                    const nv = [...formData.rescueVehicles]; nv[idx].plateNumber = formatVietnamPlate(vehicle.plateNumber); setFormData({ ...formData, rescueVehicles: nv });
                                                                }
                                                            }}
                                                            placeholder="29A-12345" className={inputCls(errors[errKey])} style={{ fontFamily: 'monospace', textTransform: 'uppercase', color: C.navy, fontSize: '12px' }} />
                                                    </div>
                                                </div>
                                                {errors[errKey] ? <p className="mt-1 text-xs" style={{ color: C.red }}>{errors[errKey]}</p>
                                                    : plateOk ? <div className="mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" style={{ color: C.green }} /><p className="text-xs" style={{ color: C.green }}>Hợp lệ</p></div> : null}
                                            </div>
                                        );
                                    })}

                                    <button type="button"
                                        onClick={() => setFormData({ ...formData, rescueVehicles: [...formData.rescueVehicles, { type: 'CAR', plateNumber: '', isPrimary: false }] })}
                                        className="w-full py-2.5 rounded-xl border-2 border-dashed text-xs font-semibold flex items-center justify-center gap-2 transition-colors hover:border-orange-300 hover:text-orange-500"
                                        style={{ borderColor: C.border, color: C.gray }}>
                                        <Plus className="w-3.5 h-3.5" /> Thêm phương tiện
                                    </button>
                                    {errors.rescueVehicles && <p className="text-xs" style={{ color: C.red }}>{errors.rescueVehicles}</p>}
                                </div>
                            </div>

                            <button type="submit" disabled={isSubmitting} className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
                                style={{ background: isSubmitting ? C.border : `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                                {isSubmitting ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /><span>Đang lưu...</span></> : <><span>Gửi hồ sơ xét duyệt</span><ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
