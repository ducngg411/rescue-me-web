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
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-2">Xác minh nhà cung cấp</h1>
            <p className="text-gray-600 mb-6">
                Vui lòng tải lên các tài liệu sau để hoàn tất quá trình xác minh
            </p>

            <div className="space-y-6">
                {documents.map((doc) => (
                    <div key={doc.type} className="border rounded-lg p-6 bg-white shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-lg">{doc.label}</h3>
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
                                    className="max-w-sm rounded-lg border"
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

            {allUploaded && (
                <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-green-800">Hoàn tất!</h3>
                            <p className="text-sm text-green-600">
                                Bạn đã tải lên đầy đủ tài liệu. Nhấn nút bên dưới để gửi yêu cầu xác minh.
                            </p>
                        </div>
                        <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                            Gửi yêu cầu xác minh
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
