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

            // Add vehicle photos based on supported types
            if (profile.supportedVehicleTypes?.includes('CAR')) {
                requiredDocs.push({
                    type: DocumentType.CAR_PHOTO,
                    label: 'Ảnh xe ô tô cứu hộ',
                    description: 'Ảnh xe ô tô của bạn',
                    required: true,
                    uploaded: false,
                });
            }

            if (profile.supportedVehicleTypes?.includes('MOTORCYCLE')) {
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-2">Xác minh nhà cung cấp</h1>
            <p className="text-gray-600 mb-6">
                Vui lòng tải lên các tài liệu sau để hoàn tất quá trình xác minh
            </p>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 font-medium">{error}</p>
                </div>
            )}

            {validationErrors.missingFields && validationErrors.missingFields.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="font-semibold text-yellow-800 mb-2">Thiếu thông tin hồ sơ:</h3>
                    <ul className="list-disc list-inside text-yellow-700">
                        {validationErrors.missingFields.map((field) => (
                            <li key={field}>{field}</li>
                        ))}
                    </ul>
                    <p className="mt-2 text-sm text-yellow-600">
                        Vui lòng <a href="/provider/onboarding" className="underline">hoàn thành hồ sơ</a> trước khi gửi xác minh.
                    </p>
                </div>
            )}

            {validationErrors.missingDocs && validationErrors.missingDocs.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="font-semibold text-yellow-800 mb-2">Thiếu tài liệu:</h3>
                    <ul className="list-disc list-inside text-yellow-700">
                        {validationErrors.missingDocs.map((doc) => (
                            <li key={doc}>{doc}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="space-y-6">
                {documents.map((doc) => (
                    <div key={doc.type} className="border rounded-lg p-6 bg-white shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-lg">
                                    {doc.label}
                                    {doc.required && <span className="text-red-500 ml-1">*</span>}
                                </h3>
                                <p className="text-sm text-gray-500">{doc.description}</p>
                            </div>
                            {doc.uploaded && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                    ✓ Đã tải lên
                                </span>
                            )}
                        </div>

                        {!doc.uploaded ? (
                            <FileUpload
                                purpose={UploadPurpose.PROVIDER_VERIFICATION}
                                docType={doc.type}
                                onSuccess={(result) => {
                                    if (result.publicUrl) {
                                        handleUploadSuccess(doc.type, result.publicUrl);
                                    }
                                }}
                                onError={(error) => {
                                    console.error('Upload error:', error);
                                    alert(`Upload failed: ${error}`);
                                }}
                            />
                        ) : (
                            <div className="space-y-2">
                                <img
                                    src={doc.publicUrl}
                                    alt={doc.label}
                                    className="max-w-sm max-h-64 rounded-lg border object-cover"
                                />
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
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    Tải lên lại
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-8 p-6 bg-gray-50 border rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-lg">
                            {allRequiredUploaded ? '✅ Sẵn sàng gửi hồ sơ' : '⚠️ Chưa hoàn thành'}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            {allRequiredUploaded
                                ? 'Bạn đã tải lên đầy đủ tài liệu. Nhấn nút bên dưới để gửi yêu cầu xác minh.'
                                : 'Vui lòng tải lên đầy đủ các tài liệu bắt buộc để gửi hồ sơ.'}
                        </p>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!allRequiredUploaded || submitting}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors ${allRequiredUploaded && !submitting
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {submitting ? 'Đang gửi...' : 'Gửi hồ sơ xác minh'}
                    </button>
                </div>
            </div>
        </div>
    );
}
