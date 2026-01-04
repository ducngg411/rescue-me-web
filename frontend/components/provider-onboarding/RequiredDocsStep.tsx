'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose, DocumentType } from '@/lib/upload';

interface RequiredDocsStepProps {
    initialData: any;
    serviceInfo: any; // From Step 1
    onComplete: (data: any) => void;
    onBack: () => void;
}

export default function RequiredDocsStep({ initialData, serviceInfo, onComplete, onBack }: RequiredDocsStepProps) {
    const [uploads, setUploads] = useState({
        citizenIdFront: initialData?.citizenIdFront || null,
        citizenIdBack: initialData?.citizenIdBack || null,
        selfie: initialData?.selfie || null,
        carPhoto: initialData?.carPhoto || null,
        motorbikePhoto: initialData?.motorbikePhoto || null,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const needsCarPhoto = serviceInfo?.supportedVehicleTypes?.includes('CAR') || false;
    const needsMotorbikePhoto = serviceInfo?.supportedVehicleTypes?.includes('MOTORCYCLE') || false;

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!uploads.citizenIdFront) newErrors.citizenIdFront = 'CCCD mặt trước là bắt buộc';
        if (!uploads.citizenIdBack) newErrors.citizenIdBack = 'CCCD mặt sau là bắt buộc';
        if (!uploads.selfie) newErrors.selfie = 'Ảnh selfie là bắt buộc';
        if (needsCarPhoto && !uploads.carPhoto) newErrors.carPhoto = 'Ảnh ô tô là bắt buộc';
        if (needsMotorbikePhoto && !uploads.motorbikePhoto) newErrors.motorbikePhoto = 'Ảnh xe máy là bắt buộc';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            onComplete(uploads);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Giấy tờ bắt buộc (Tier 1)</h2>
            <p className="text-gray-600 mb-6">
                Upload các giấy tờ bắt buộc để xác minh tài khoản của bạn. Chỉ chấp nhận file ảnh (JPEG, PNG, WebP) dưới 5MB.
            </p>

            {/* CCCD Front */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    CCCD mặt trước <span className="text-red-500">*</span>
                </label>
                <FileUpload
                    purpose={UploadPurpose.PROVIDER_VERIFICATION}
                    docType={DocumentType.CITIZEN_ID_FRONT}
                    onSuccess={(upload: any) => setUploads({ ...uploads, citizenIdFront: upload })}
                />
                {errors.citizenIdFront && <p className="mt-1 text-sm text-red-500">{errors.citizenIdFront}</p>}
            </div>

            {/* CCCD Back */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    CCCD mặt sau <span className="text-red-500">*</span>
                </label>
                <FileUpload
                    purpose={UploadPurpose.PROVIDER_VERIFICATION}
                    docType={DocumentType.CITIZEN_ID_BACK}
                    onSuccess={(upload: any) => setUploads({ ...uploads, citizenIdBack: upload })}
                />
                {errors.citizenIdBack && <p className="mt-1 text-sm text-red-500">{errors.citizenIdBack}</p>}
            </div>

            {/* Selfie */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ảnh selfie cầm CCCD <span className="text-red-500">*</span>
                </label>
                <FileUpload
                    purpose={UploadPurpose.PROVIDER_VERIFICATION}
                    docType={DocumentType.SELFIE}
                    onSuccess={(upload: any) => setUploads({ ...uploads, selfie: upload })}
                />
                {errors.selfie && <p className="mt-1 text-sm text-red-500">{errors.selfie}</p>}
            </div>

            {/* Car Photo */}
            {needsCarPhoto && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ảnh ô tô (biển số rõ ràng) <span className="text-red-500">*</span>
                    </label>
                    <FileUpload
                        purpose={UploadPurpose.PROVIDER_VERIFICATION}
                        docType={DocumentType.CAR_PHOTO}
                        onSuccess={(upload: any) => setUploads({ ...uploads, carPhoto: upload })}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                        Biển số: {serviceInfo?.carPlateNumber || 'Chưa có'}
                    </p>
                    {errors.carPhoto && <p className="mt-1 text-sm text-red-500">{errors.carPhoto}</p>}
                </div>
            )}

            {/* Motorbike Photo */}
            {needsMotorbikePhoto && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ảnh xe máy (biển số rõ ràng) <span className="text-red-500">*</span>
                    </label>
                    <FileUpload
                        purpose={UploadPurpose.PROVIDER_VERIFICATION}
                        docType={DocumentType.MOTORBIKE_PHOTO}
                        onSuccess={(upload: any) => setUploads({ ...uploads, motorbikePhoto: upload })}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                        Biển số: {serviceInfo?.motorcyclePlateNumber || 'Chưa có'}
                    </p>
                    {errors.motorbikePhoto && <p className="mt-1 text-sm text-red-500">{errors.motorbikePhoto}</p>}
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between mt-8">
                <button
                    onClick={onBack}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    Quay lại
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Tiếp tục
                </button>
            </div>
        </div>
    );
}
