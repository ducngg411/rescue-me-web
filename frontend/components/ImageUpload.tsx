'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { uploadFile, UploadPurpose } from '@/lib/upload';

interface ImageUploadProps {
    label?: string;
    maxImages?: number;
    purpose: UploadPurpose;
    onSuccess?: (objectKey: string, publicUrl: string) => void;
    onRemove?: (objectKey: string) => void;
    uploadedImages?: Array<{ objectKey: string; publicUrl: string }>;
    disabled?: boolean;
}

export default function ImageUpload({
    label = 'Upload Images',
    maxImages = 5,
    purpose,
    onSuccess,
    onRemove,
    uploadedImages = [],
    disabled = false,
}: ImageUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setError('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP)');
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            setError('Ảnh không được vượt quá 5MB');
            return;
        }

        setSelectedFile(file);
        setError(null);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        if (uploadedImages.length >= maxImages) {
            setError(`Chỉ được upload tối đa ${maxImages} ảnh`);
            return;
        }

        setUploading(true);
        setProgress(0);
        setError(null);

        try {
            const result = await uploadFile(
                selectedFile,
                purpose,
                undefined,
                (prog) => setProgress(prog)
            );

            if (result.success && result.upload) {
                onSuccess?.(result.upload.objectKey, result.upload.publicUrl);
                // Reset
                setSelectedFile(null);
                setPreview(null);
                setProgress(0);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } else {
                setError(result.error || 'Upload thất bại');
            }
        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra khi upload ảnh');
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = (objectKey: string) => {
        onRemove?.(objectKey);
    };

    const handleReset = () => {
        setSelectedFile(null);
        setPreview(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const canUploadMore = uploadedImages.length < maxImages && !disabled;

    return (
        <div className="space-y-4">
            {/* Label */}
            {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                disabled={disabled || uploading || !canUploadMore}
                className="hidden"
            />

            {/* Upload Area - Only show if can upload more and no file selected */}
            {canUploadMore && !selectedFile && (
                <div
                    onClick={handleButtonClick}
                    className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <Upload className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                                Nhấn để chọn ảnh
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                JPG, PNG, WEBP (tối đa 5MB)
                            </p>
                        </div>
                        <p className="text-xs text-gray-400">
                            Đã upload: {uploadedImages.length}/{maxImages}
                        </p>
                    </div>
                </div>
            )}

            {/* Preview & Upload Button */}
            {selectedFile && preview && (
                <div className="bg-white rounded-lg border-2 border-gray-200 p-4 space-y-3">
                    <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                    />
                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <p className="font-medium text-gray-900">{selectedFile.name}</p>
                            <p className="text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={uploading}
                                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading}
                                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Đang tải...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Tải lên
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress bar */}
            {uploading && (
                <div className="bg-white rounded-lg border-2 border-blue-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Đang tải lên...</span>
                        <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                </div>
            )}

            {/* Uploaded Images Grid */}
            {uploadedImages.length > 0 && (
                <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                        Ảnh đã tải lên ({uploadedImages.length}/{maxImages})
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        {uploadedImages.map((image, index) => (
                            <div key={index} className="relative group">
                                <img
                                    src={image.publicUrl}
                                    alt={`Upload ${index + 1}`}
                                    className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemove(image.objectKey)}
                                    className="absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                                    title="Xóa ảnh"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
