'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Building2, Info } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose, DocumentType, getUserUploads } from '@/lib/upload';

interface OptionalDocsStepProps {
    initialData: any;
    serviceInfo: any;
    onComplete: (data: any) => void;
    onBack: () => void;
    onSkip: () => void;
}

export default function OptionalDocsStep({ initialData, serviceInfo, onComplete, onBack, onSkip }: OptionalDocsStepProps) {
    const [uploads, setUploads] = useState({
        driverLicense: initialData?.driverLicense || null,
        businessLicense: initialData?.businessLicense || null,
    });

    const [loading, setLoading] = useState(true);

    const isBusinessProvider = serviceInfo?.providerType === 'BUSINESS';

    // Load existing uploads from server
    useEffect(() => {
        loadExistingUploads();
    }, []);

    const loadExistingUploads = async () => {
        try {
            const existingUploads = await getUserUploads(UploadPurpose.PROVIDER_VERIFICATION);

            const uploadMap: any = {};
            existingUploads.forEach((upload: any) => {
                if (upload.docType) {
                    const docTypeMap: Record<string, string> = {
                        'DRIVER_LICENSE': 'driverLicense',
                        'BUSINESS_REGISTRATION': 'businessLicense',
                    };

                    const stateKey = docTypeMap[upload.docType];
                    if (stateKey) {
                        uploadMap[stateKey] = {
                            id: upload.id,
                            publicUrl: upload.publicUrl,
                        };
                    }
                }
            });

            setUploads({
                driverLicense: uploadMap.driverLicense || null,
                businessLicense: uploadMap.businessLicense || null,
            });
        } catch (error) {
            console.error('Failed to load existing uploads:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => {
        onComplete(uploads);
    };

    const handleSkipClick = () => {
        onSkip();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Tài liệu bổ sung</h2>
                <p className="text-gray-600">
                    Tải lên các tài liệu bổ sung để tăng độ tin cậy. Bạn có thể bỏ qua bước này và upload sau.
                </p>
            </div>

            {/* Optional Documents Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-600">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Giấy tờ tùy chọn</h3>
                </div>

                {/* Driver License */}
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                        Bằng lái xe
                    </label>
                    <p className="text-sm text-gray-500 mb-2">Giúp tăng độ tin cậy với khách hàng</p>
                    <FileUpload
                        purpose={UploadPurpose.PROVIDER_VERIFICATION}
                        docType={DocumentType.DRIVER_LICENSE}
                        existingUpload={uploads.driverLicense}
                        onSuccess={(upload: any) => setUploads({ ...uploads, driverLicense: upload })}
                    />
                </div>

                {/* Business License (if business provider) */}
                {isBusinessProvider && (
                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                            Giấy đăng ký kinh doanh
                        </label>
                        <p className="text-sm text-gray-500 mb-2">
                            Bắt buộc nếu muốn hiển thị "Doanh nghiệp đã xác minh"
                        </p>
                        <FileUpload
                            purpose={UploadPurpose.PROVIDER_VERIFICATION}
                            docType={DocumentType.BUSINESS_REGISTRATION}
                            existingUpload={uploads.businessLicense}
                            onSuccess={(upload: any) => setUploads({ ...uploads, businessLicense: upload })}
                        />
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">Lưu ý</p>
                        <p className="text-sm text-blue-800">
                            Bạn có thể upload các giấy tờ này sau khi tài khoản được duyệt.
                            Đây không phải điều kiện bắt buộc để gửi hồ sơ.
                        </p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-6 border-t">
                <button
                    onClick={onBack}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                    Quay lại
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={handleSkipClick}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                    >
                        Bỏ qua
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                    >
                        Tiếp tục
                    </button>
                </div>
            </div>
        </div>
    );
}
