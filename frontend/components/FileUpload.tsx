'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useUpload, UseUploadOptions } from '@/lib/hooks/useUpload';
import { validateFile, formatFileSize } from '@/lib/upload';

interface FileUploadProps extends UseUploadOptions {
    label?: string;
    accept?: string;
    disabled?: boolean;
    className?: string;
    children?: React.ReactNode;
    existingUpload?: { id: string; publicUrl: string } | null;
}

export default function FileUpload({
    label = 'Upload File',
    accept = 'image/jpeg,image/png,image/webp',
    disabled = false,
    className = '',
    children,
    existingUpload = null,
    ...uploadOptions
}: FileUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const { upload, uploading, progress, error, result, reset } = useUpload(uploadOptions);

    // If there's an existing upload and no new upload, show existing
    const showExisting = existingUpload && !result?.success && !selectedFile;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        setSelectedFile(file);

        // Create preview for images
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        await upload(selectedFile);
    };

    const handleReset = () => {
        setSelectedFile(null);
        setPreview(null);
        reset();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Label */}
            {label && <label className="block text-sm font-semibold text-gray-700">{label}</label>}

            {/* Hidden File Input - Always rendered */}
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                disabled={disabled || uploading}
                className="hidden"
            />

            {/* Existing Upload Display */}
            {showExisting && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-sm font-semibold text-green-800">Đã tải lên trước đó</p>
                    </div>
                    <img
                        src={existingUpload.publicUrl}
                        alt="Existing upload"
                        className="w-full h-48 object-cover rounded-lg border-2 border-green-300"
                    />
                    <button
                        type="button"
                        onClick={handleButtonClick}
                        className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Tải lên file khác
                    </button>
                </div>
            )}

            {/* Upload Area */}
            {!selectedFile && !result?.success && !showExisting && (
                <div
                    onClick={handleButtonClick}
                    className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <Upload className="w-8 h-8 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-base font-medium text-gray-700 group-hover:text-blue-600">
                                Nhấn để chọn file
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                hoặc kéo thả file vào đây
                            </p>
                        </div>
                        <p className="text-xs text-gray-400">
                            Hỗ trợ: JPG, PNG, WEBP (tối đa 5MB)
                        </p>
                    </div>
                </div>
            )}

            {/* Preview */}
            {preview && !result?.success && (
                <div className="bg-white rounded-lg border-2 border-gray-200 p-4 space-y-4">
                    <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-64 object-cover rounded-lg border"
                    />
                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <p className="font-medium text-gray-900">{selectedFile?.name}</p>
                            <p className="text-gray-500">{formatFileSize(selectedFile?.size || 0)}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={uploading}
                                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium shadow-sm transition-all flex items-center gap-2"
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
                <div className="bg-white rounded-lg border-2 border-blue-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Đang tải lên...</span>
                        <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800 font-medium">{error}</p>
                    </div>
                </div>
            )}

            {/* Success */}
            {result?.success && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <p className="text-sm font-semibold text-green-800">Tải lên thành công!</p>
                    </div>
                    {result.publicUrl && (
                        <img
                            src={result.publicUrl}
                            alt="Uploaded"
                            className="w-full h-48 object-cover rounded-lg border-2 border-green-300"
                        />
                    )}
                    <button
                        type="button"
                        onClick={handleReset}
                        className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Tải lên file khác
                    </button>
                </div>
            )}
        </div>
    );
}
