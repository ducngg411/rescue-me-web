'use client';

import React, { useRef, useState } from 'react';
import { useUpload, UseUploadOptions } from '@/lib/hooks/useUpload';
import { validateFile, formatFileSize } from '@/lib/upload';

interface FileUploadProps extends UseUploadOptions {
    label?: string;
    accept?: string;
    disabled?: boolean;
    className?: string;
    children?: React.ReactNode;
}

export default function FileUpload({
    label = 'Upload File',
    accept = 'image/jpeg,image/png,image/webp',
    disabled = false,
    className = '',
    children,
    ...uploadOptions
}: FileUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const { upload, uploading, progress, error, result, reset } = useUpload(uploadOptions);

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
            {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}

            {/* Custom trigger or default button */}
            {children ? (
                <div onClick={handleButtonClick} className="cursor-pointer">
                    {children}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleButtonClick}
                    disabled={disabled || uploading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {uploading ? 'Uploading...' : 'Choose File'}
                </button>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                disabled={disabled || uploading}
                className="hidden"
            />

            {/* Preview */}
            {preview && !result?.success && (
                <div className="space-y-2">
                    <img src={preview} alt="Preview" className="max-w-xs rounded-lg border" />
                    <div className="text-sm text-gray-600">
                        {selectedFile?.name} ({formatFileSize(selectedFile?.size || 0)})
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleUpload}
                            disabled={uploading}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                            {uploading ? 'Uploading...' : 'Upload'}
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={uploading}
                            className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Progress bar */}
            {uploading && (
                <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="text-sm text-gray-600 text-center">{Math.round(progress)}%</div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Success */}
            {result?.success && (
                <div className="space-y-2">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-sm text-green-600">Upload successful!</p>
                        {result.publicUrl && (
                            <a
                                href={result.publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                            >
                                View file
                            </a>
                        )}
                    </div>
                    {result.publicUrl && (
                        <img src={result.publicUrl} alt="Uploaded" className="max-w-xs rounded-lg border" />
                    )}
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                    >
                        Upload Another
                    </button>
                </div>
            )}
        </div>
    );
}
