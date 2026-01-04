'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose, DocumentType } from '@/lib/upload';

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

    const isBusinessProvider = serviceInfo?.providerType === 'BUSINESS';

    const handleSubmit = () => {
        onComplete(uploads);
    };

    const handleSkipClick = () => {
        onSkip();
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Giấy tờ bổ sung (Không bắt buộc)</h2>
            <p className="text-gray-600 mb-6">
                Upload các giấy tờ bổ sung để tăng độ tin cậy. Bạn có thể bỏ qua bước này và upload sau.
            </p>

            {/* Driver License */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bằng lái xe (Tùy chọn)
                </label>
                <FileUpload
                    purpose={UploadPurpose.PROVIDER_VERIFICATION}
                    docType={DocumentType.DRIVER_LICENSE}
                    onSuccess={(upload: any) => setUploads({ ...uploads, driverLicense: upload })}
                />
                <p className="text-sm text-gray-500 mt-1">
                    Giúp tăng độ tin cậy với khách hàng
                </p>
            </div>

            {/* Business License (if business provider) */}
            {isBusinessProvider && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Giấy phép kinh doanh (Tùy chọn)
                    </label>
                    <FileUpload
                        purpose={UploadPurpose.PROVIDER_VERIFICATION}
                        docType={DocumentType.BUSINESS_REGISTRATION}
                        onSuccess={(upload: any) => setUploads({ ...uploads, businessLicense: upload })}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                        Bắt buộc nếu muốn hiển thị "Doanh nghiệp đã xác minh"
                    </p>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                    💡 <strong>Lưu ý:</strong> Bạn có thể upload các giấy tờ này sau khi tài khoản được duyệt (APPROVED).
                    Đây không phải điều kiện bắt buộc để submit hồ sơ.
                </p>
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-8">
                <button
                    onClick={onBack}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    Quay lại
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={handleSkipClick}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Bỏ qua
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Tiếp tục
                    </button>
                </div>
            </div>
        </div>
    );
}
