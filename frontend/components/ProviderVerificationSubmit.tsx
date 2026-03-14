'use client';

import React, { useState, useEffect } from 'react';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose, DocumentType, getUserUploads } from '@/lib/upload';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

interface VerificationDocument {
    type: DocumentType;
    label: string;
    description: string;
    required: boolean;
    uploaded: boolean;
    publicUrl?: string;
}

interface SubmitResponse {
    success: boolean;
    message?: string;
    missingFields?: string[];
    missingDocs?: string[];
    verificationStatus?: string;
    submittedAt?: string;
}

export default function ProviderVerificationSubmit() {
    const router = useRouter();
    const [providerType, setProviderType] = useState<'INDIVIDUAL' | 'BUSINESS' | null>(null);
    const [supportedVehicles, setSupportedVehicles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<{
        missingFields?: string[];
        missingDocs?: string[];
    }>({});

    const [documents, setDocuments] = useState<VerificationDocument[]>([]);

    // Load provider profile and uploaded docs
    useEffect(() => {
        loadProviderData();
    }, []);

    const loadProviderData = async () => {
        try {
            setLoading(true);

            // Get provider profile
            const profileRes = await api.get('/me/provider/profile');
            const profile = profileRes.data;

            setProviderType(profile.providerType);
            setSupportedVehicles(profile.supportedVehicleTypes || []);

            // Build required documents list
            const requiredDocs: VerificationDocument[] = [
                {
                    type: DocumentType.CITIZEN_ID_FRONT,
                    label: 'CMND/CCCD - Mặt trước',
                    description: 'Ảnh rõ nét mặt trước CMND/CCCD',
                    required: true,
                    uploaded: false,
                },
                {
                    type: DocumentType.CITIZEN_ID_BACK,
                    label: 'CMND/CCCD - Mặt sau',
                    description: 'Ảnh rõ nét mặt sau CMND/CCCD',
                    required: true,
                    uploaded: false,
                },
                {
                    type: DocumentType.SELFIE,
                    label: 'Ảnh chân dung (Selfie)',
                    description: 'Ảnh selfie cầm CMND/CCCD',
                    required: true,
                    uploaded: false,
                },
                {
                    type: DocumentType.DRIVER_LICENSE,
                    label: 'Giấy phép lái xe',
                    description: 'Ảnh giấy phép lái xe',
                    required: true,
                    uploaded: false,
                },
            ];

            // Add vehicle photos based on rescue vehicles (not supportedVehicleTypes)
            const rescueVehicles = profile.rescueVehicles || [];
            if (rescueVehicles.some((v: any) => v.type === 'CAR')) {
                requiredDocs.push({
                    type: DocumentType.CAR_PHOTO,
                    label: 'Ảnh xe ô tô cứu hộ',
                    description: 'Ảnh xe ô tô của bạn',
                    required: true,
                    uploaded: false,
                });
            }

            if (rescueVehicles.some((v: any) => v.type === 'MOTORCYCLE')) {
                requiredDocs.push({
                    type: DocumentType.MOTORBIKE_PHOTO,
                    label: 'Ảnh xe máy cứu hộ',
                    description: 'Ảnh xe máy của bạn',
                    required: true,
                    uploaded: false,
                });
            }

            // Add business registration if BUSINESS
            if (profile.providerType === 'BUSINESS') {
                requiredDocs.push({
                    type: DocumentType.BUSINESS_REGISTRATION,
                    label: 'Giấy đăng ký kinh doanh',
                    description: 'Giấy phép kinh doanh/Giấy chứng nhận đăng ký hộ kinh doanh',
                    required: true,
                    uploaded: false,
                });
            }

            // Get uploaded documents
            const uploadsRes = await getUserUploads(UploadPurpose.PROVIDER_VERIFICATION);
            const uploads = uploadsRes || [];

            // Mark uploaded docs
            const uploadedDocTypes = new Set(
                uploads.map((u: any) => u.docType).filter(Boolean)
            );

            const docsWithStatus = requiredDocs.map((doc) => ({
                ...doc,
                uploaded: uploadedDocTypes.has(doc.type),
                publicUrl: uploads.find((u: any) => u.docType === doc.type)?.publicUrl,
            }));

            setDocuments(docsWithStatus);
        } catch (err: any) {
            console.error('Failed to load provider data:', err);
            setError('Failed to load provider information');
        } finally {
            setLoading(false);
        }
    };

    const handleUploadSuccess = async (docType: DocumentType, publicUrl: string) => {
        setDocuments((prev) =>
            prev.map((doc) =>
                doc.type === docType ? { ...doc, uploaded: true, publicUrl } : doc
            )
        );
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            setError(null);
            setValidationErrors({});

            const response = await api.post<SubmitResponse>('/me/provider/submit-verification');

            if (response.data.success) {
                alert(response.data.message || 'Hồ sơ đã được gửi thành công! Vui lòng đợi xác minh.');
                router.push('/provider/dashboard');
            } else {
                // Show validation errors
                setValidationErrors({
                    missingFields: response.data.missingFields,
                    missingDocs: response.data.missingDocs,
                });
                setError(response.data.message || 'Vui lòng hoàn thành đầy đủ thông tin và tài liệu');
            }
        } catch (err: any) {
            console.error('Submit failed:', err);
            setError(err.response?.data?.message || 'Gửi hồ sơ thất bại. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    const allRequiredUploaded = documents
        .filter((doc) => doc.required)
        .every((doc) => doc.uploaded);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-9 h-9 rounded-full border-[3px] border-t-transparent animate-spin mx-auto mb-4" style={{ borderColor: '#f97316', borderTopColor: 'transparent' }}></div>
                    <p className="text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Xác minh nhà cung cấp</h1>
                <p className="text-gray-600">
                    Vui lòng tải lên các tài liệu sau để hoàn tất quá trình xác minh
                </p>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm">
                    <div className="flex items-start gap-3">
                        <span className="text-red-500 text-xl"></span>
                        <p className="text-red-800 font-medium">{error}</p>
                    </div>
                </div>
            )}

            {/* Missing Fields Alert */}
            {validationErrors.missingFields && validationErrors.missingFields.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg shadow-sm">
                    <div className="flex items-start gap-3">
                        <span className="text-yellow-500 text-xl"></span>
                        <div className="flex-1">
                            <h3 className="font-semibold text-yellow-800 mb-2">Thiếu thông tin hồ sơ:</h3>
                            <ul className="list-disc list-inside text-yellow-700 space-y-1">
                                {validationErrors.missingFields.map((field) => (
                                    <li key={field}>{field}</li>
                                ))}
                            </ul>
                            <p className="mt-3 text-sm text-yellow-600">
                                Vui lòng{' '}
                                <a href="/provider/onboarding" className="underline font-medium hover:text-yellow-800">
                                    hoàn thành hồ sơ
                                </a>{' '}
                                trước khi gửi xác minh.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Missing Docs Alert */}
            {validationErrors.missingDocs && validationErrors.missingDocs.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg shadow-sm">
                    <div className="flex items-start gap-3">
                        <span className="text-yellow-500 text-xl">📄</span>
                        <div className="flex-1">
                            <h3 className="font-semibold text-yellow-800 mb-2">Thiếu tài liệu:</h3>
                            <ul className="list-disc list-inside text-yellow-700 space-y-1">
                                {validationErrors.missingDocs.map((doc) => (
                                    <li key={doc}>{doc}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Documents Grid */}
            <div className="grid gap-6 md:grid-cols-2">
                {documents.map((doc) => (
                    <div
                        key={doc.type}
                        className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                            doc.uploaded
                                ? 'border-green-400 bg-green-50'
                                : doc.required
                                    ? 'border-gray-200 hover:border-orange-300'
                                    : 'border-gray-100'
                            }`}
                    >
                        {/* Document Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                                    {doc.label}
                                    {doc.required && !doc.uploaded && <span className="text-red-500">*</span>}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                            </div>
                            {doc.uploaded && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium whitespace-nowrap">
                                    ✓ Hoàn tất
                                </span>
                            )}
                        </div>

                        {/* Document Upload/Preview */}
                        {!doc.uploaded ? (
                            <FileUpload
                                purpose={UploadPurpose.PROVIDER_VERIFICATION}
                                docType={doc.type}
                                label=""
                                onSuccess={(result) => {
                                    if (result.publicUrl) handleUploadSuccess(doc.type, result.publicUrl);
                                }}
                                onError={(error) => console.error('Upload error:', error)}
                            />
                        ) : (
                            <div className="space-y-3">
                                <img src={doc.publicUrl} alt={doc.label} className="w-full h-36 object-cover rounded-xl border border-green-200" />
                                <button
                                    onClick={() => {
                                        setDocuments((prev) =>
                                            prev.map((d) =>
                                                d.type === doc.type
                                                    ? { ...d, uploaded: false, publicUrl: undefined }
                                                    : d
                                            )
                                        );
                                    }}
                                    className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                                >↺ Tải lên lại
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Submit Section */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            {allRequiredUploaded ? (
                                <>
                                    <span className="text-2xl"></span>
                                    <h3 className="text-xl font-bold text-green-700">Sẵn sàng gửi hồ sơ</h3>
                                </>
                            ) : (
                                <>
                                    <span className="text-2xl"></span>
                                    <h3 className="text-xl font-bold text-yellow-700">Chưa hoàn thành</h3>
                                </>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 ml-11">
                            {allRequiredUploaded
                                ? 'Bạn đã tải lên đầy đủ tài liệu. Nhấn nút bên dưới để gửi yêu cầu xác minh.'
                                : 'Vui lòng tải lên đầy đủ các tài liệu bắt buộc để gửi hồ sơ.'}
                        </p>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!allRequiredUploaded || submitting}
                        className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
                            allRequiredUploaded && !submitting
                                ? 'text-white'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        style={allRequiredUploaded && !submitting ? { background: 'linear-gradient(135deg, #f97316 0%, #ea6c0a 100%)' } : {}}
                    >
                        {submitting ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Đang gửi...
                            </span>
                        ) : (
                            'Gửi hồ sơ xác minh →'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
