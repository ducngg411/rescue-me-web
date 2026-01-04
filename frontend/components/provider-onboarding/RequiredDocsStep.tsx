'use client';

import React, { useState, useEffect } from 'react';
import { IdCard, Camera, Car, Bike } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose, DocumentType, getUserUploads } from '@/lib/upload';

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
    const [loading, setLoading] = useState(true);

    const needsCarPhoto = serviceInfo?.supportedVehicleTypes?.includes('CAR') || false;
    const needsMotorbikePhoto = serviceInfo?.supportedVehicleTypes?.includes('MOTORCYCLE') || false;

    // Always load existing uploads from server on mount (server is source of truth)
    useEffect(() => {
        loadExistingUploads();
    }, []);

    const loadExistingUploads = async () => {
        try {
            const existingUploads = await getUserUploads(UploadPurpose.PROVIDER_VERIFICATION);

            // Map uploads to state by docType
            const uploadMap: any = {};
            existingUploads.forEach((upload: any) => {
                if (upload.docType) {
                    // Map Prisma enum to our state keys
                    const docTypeMap: Record<string, string> = {
                        'CITIZEN_ID_FRONT': 'citizenIdFront',
                        'CITIZEN_ID_BACK': 'citizenIdBack',
                        'SELFIE': 'selfie',
                        'CAR_PHOTO': 'carPhoto',
                        'MOTORBIKE_PHOTO': 'motorbikePhoto',
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

            // Update state with server data
            setUploads({
                citizenIdFront: uploadMap.citizenIdFront || null,
                citizenIdBack: uploadMap.citizenIdBack || null,
                selfie: uploadMap.selfie || null,
                carPhoto: uploadMap.carPhoto || null,
                motorbikePhoto: uploadMap.motorbikePhoto || null,
            });
        } catch (error) {
            console.error('Failed to load existing uploads:', error);
        } finally {
            setLoading(false);
        }
    };

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
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Tài liệu bắt buộc</h2>
                <p className="text-gray-600">
                    Vui lòng tải lên các tài liệu sau để xác minh tài khoản. Chỉ chấp nhận file ảnh (JPEG, PNG, WebP) dưới 5MB.
                </p>
            </div>

            {/* Personal Verification Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-600">
                    <IdCard className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Xác minh cá nhân</h3>
                </div>

                {/* CCCD Front */}
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                        CCCD/CMND mặt trước <span className="text-red-500">*</span>
                    </label>
                    <FileUpload
                        purpose={UploadPurpose.PROVIDER_VERIFICATION}
                        docType={DocumentType.CITIZEN_ID_FRONT}
                        existingUpload={uploads.citizenIdFront}
                        onSuccess={(upload: any) => setUploads({ ...uploads, citizenIdFront: upload })}
                    />
                    {errors.citizenIdFront && <p className="mt-1 text-sm text-red-500">{errors.citizenIdFront}</p>}
                </div>

                {/* CCCD Back */}
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                        CCCD/CMND mặt sau <span className="text-red-500">*</span>
                    </label>
                    <FileUpload
                        purpose={UploadPurpose.PROVIDER_VERIFICATION}
                        docType={DocumentType.CITIZEN_ID_BACK}
                        existingUpload={uploads.citizenIdBack}
                        onSuccess={(upload: any) => setUploads({ ...uploads, citizenIdBack: upload })}
                    />
                    {errors.citizenIdBack && <p className="mt-1 text-sm text-red-500">{errors.citizenIdBack}</p>}
                </div>

                {/* Selfie */}
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                        Ảnh selfie cầm CCCD <span className="text-red-500">*</span>
                    </label>
                    <p className="text-sm text-gray-500 mb-2">Chụp rõ mặt bạn và CCCD/CMND trong cùng một khung hình</p>
                    <FileUpload
                        purpose={UploadPurpose.PROVIDER_VERIFICATION}
                        docType={DocumentType.SELFIE}
                        existingUpload={uploads.selfie}
                        onSuccess={(upload: any) => setUploads({ ...uploads, selfie: upload })}
                    />
                    {errors.selfie && <p className="mt-1 text-sm text-red-500">{errors.selfie}</p>}
                </div>
            </div>

            {/* Vehicle Verification Section */}
            {(needsCarPhoto || needsMotorbikePhoto) && (
                <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-600">
                        <Car className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Xác minh phương tiện</h3>
                    </div>

                    {/* Car Photo */}
                    {needsCarPhoto && (
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                                Ảnh ô tô cứu hộ <span className="text-red-500">*</span>
                            </label>
                            <p className="text-sm text-gray-500 mb-2">
                                Chụp ảnh xe với biển số rõ ràng - Biển số đã đăng ký: <span className="font-mono font-semibold text-gray-700">{serviceInfo?.carPlateNumber || 'Chưa có'}</span>
                            </p>
                            <FileUpload
                                purpose={UploadPurpose.PROVIDER_VERIFICATION}
                                docType={DocumentType.CAR_PHOTO}
                                existingUpload={uploads.carPhoto}
                                onSuccess={(upload: any) => setUploads({ ...uploads, carPhoto: upload })}
                            />
                            {errors.carPhoto && <p className="mt-1 text-sm text-red-500">{errors.carPhoto}</p>}
                        </div>
                    )}

                    {/* Motorbike Photo */}
                    {needsMotorbikePhoto && (
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                                Ảnh xe máy cứu hộ <span className="text-red-500">*</span>
                            </label>
                            <p className="text-sm text-gray-500 mb-2">
                                Chụp ảnh xe với biển số rõ ràng - Biển số đã đăng ký: <span className="font-mono font-semibold text-gray-700">{serviceInfo?.motorcyclePlateNumber || 'Chưa có'}</span>
                            </p>
                            <FileUpload
                                purpose={UploadPurpose.PROVIDER_VERIFICATION}
                                docType={DocumentType.MOTORBIKE_PHOTO}
                                existingUpload={uploads.motorbikePhoto}
                                onSuccess={(upload: any) => setUploads({ ...uploads, motorbikePhoto: upload })}
                            />
                            {errors.motorbikePhoto && <p className="mt-1 text-sm text-red-500">{errors.motorbikePhoto}</p>}
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-6 border-t">
                <button
                    onClick={onBack}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                    Quay lại
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                    Tiếp tục
                </button>
            </div>
        </div>
    );
}
