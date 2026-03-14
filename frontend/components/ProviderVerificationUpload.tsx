'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose, DocumentType } from '@/lib/upload';

interface VerificationDocument {
    type: DocumentType;
    label: string;
    description: string;
    uploaded: boolean;
    publicUrl?: string;
}

export default function ProviderVerificationUpload() {
    const [documents, setDocuments] = useState<VerificationDocument[]>([
        {
            type: DocumentType.CITIZEN_ID_FRONT,
            label: 'CMND/CCCD - Mặt trước',
            description: 'Ảnh rõ nét mặt trước CMND/CCCD',
            uploaded: false,
        },
        {
            type: DocumentType.CITIZEN_ID_BACK,
            label: 'CMND/CCCD - Mặt sau',
            description: 'Ảnh rõ nét mặt sau CMND/CCCD',
            uploaded: false,
        },
        {
            type: DocumentType.SELFIE,
            label: 'Ảnh chân dung (Selfie)',
            description: 'Ảnh selfie cầm CMND/CCCD',
            uploaded: false,
        },
        {
            type: DocumentType.MOTORBIKE_PHOTO,
            label: 'Ảnh xe cứu hộ',
            description: 'Ảnh phương tiện cứu hộ của bạn',
            uploaded: false,
        },
    ]);

    const handleUploadSuccess = (docType: DocumentType, publicUrl: string) => {
        setDocuments((prev) =>
            prev.map((doc) =>
                doc.type === docType ? { ...doc, uploaded: true, publicUrl } : doc
            )
        );
    };

    const allUploaded = documents.every((doc) => doc.uploaded);

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Xác minh nhà cung cấp</h1>
                <p className="text-gray-600">
                    Vui lòng tải lên các tài liệu sau để hoàn tất quá trình xác minh
                </p>
            </div>

            {/* Documents Grid */}
            <div className="grid gap-6 md:grid-cols-2">
                {documents.map((doc) => (
                    <div
                        key={doc.type}
                        className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                            doc.uploaded
                                ? 'border-green-400 bg-green-50'
                                : 'border-gray-200 hover:border-orange-300'
                            }`}
                    >
                        {/* Document Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                                    {doc.label}
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
                                    className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                                >↺ Tải lên lại
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Submit Section */}
            {allUploaded && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl"></span>
                            <div>
                                <h3 className="text-xl font-bold text-green-700">Hoàn tất!</h3>
                                <p className="text-sm text-gray-600">
                                    Bạn đã tải lên đầy đủ tài liệu. Nhấn nút bên dưới để gửi yêu cầu xác minh.
                                </p>
                            </div>
                        </div>
                        <button className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea6c0a 100%)' }}>
                            Gửi yêu cầu xác minh →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}