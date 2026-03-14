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
                    className="relative border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all group"
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                            <Upload className="w-6 h-6" style={{ color: '#f97316' }} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700 group-hover:text-orange-500">
                                Nhấn để chọn file
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
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
                <div className="bg-white rounded-xl border p-3 space-y-3" style={{ borderColor: '#e2e8f0' }}>
                    <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                    <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{selectedFile?.name}</p>
                            <p className="text-xs text-gray-400">{formatFileSize(selectedFile?.size || 0)}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button type="button" onClick={handleReset} disabled={uploading}
                                className="px-3 py-1.5 border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5" style={{ borderColor: '#e2e8f0' }}>
                                <X className="w-3.5 h-3.5" /> Hủy
                            </button>
                            <button type="button" onClick={handleUpload} disabled={uploading}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-all flex items-center gap-1.5"
                                style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea6c0a 100%)' }}>
                                {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang tải...</> : <><Upload className="w-3.5 h-3.5" />Tải lên</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress bar */}
            {uploading && (
                <div className="bg-white rounded-xl border p-3 space-y-2" style={{ borderColor: '#e2e8f0' }}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Đang tải lên...</span>
                        <span className="text-xs font-bold" style={{ color: '#f97316' }}>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-1.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%`, background: '#f97316' }} />
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
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <p className="text-xs font-semibold text-green-800">Tải lên thành công!</p>
                    </div>
                    {result.publicUrl && (
                        <img src={result.publicUrl} alt="Uploaded" className="w-full h-36 object-cover rounded-lg border border-green-200" />
                    )}
                    <button type="button" onClick={handleReset}
                        className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5">
                        <RefreshCw className="w-3 h-3" /> Tải lên file khác
                    </button>
                </div>
            )}
        </div>
    );
}
