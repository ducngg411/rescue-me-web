'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
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

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e5e7eb',
    bg: '#f8fafc',
};

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

    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setError('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP)');
            return;
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setError('Ảnh không được vượt quá 5MB');
            return;
        }

        setSelectedFile(file);
        setError(null);

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
                setSelectedFile(null);
                setPreview(null);
                setProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else {
                setError(result.error || 'Upload thất bại');
            }
        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra khi upload ảnh');
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = (objectKey: string) => onRemove?.(objectKey);

    const handleReset = () => {
        setSelectedFile(null);
        setPreview(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const canUploadMore = uploadedImages.length < maxImages && !disabled;

    return (
        <div className="space-y-3">
            {label && <label className="block text-sm font-medium" style={{ color: C.navy }}>{label}</label>}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                disabled={disabled || uploading || !canUploadMore}
                className="hidden"
            />

            {/* Upload Area */}
            {canUploadMore && !selectedFile && (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative rounded-xl p-5 text-center cursor-pointer transition-all group"
                    style={{
                        border: `2px dashed ${C.border}`,
                        background: C.bg,
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = C.orange;
                        (e.currentTarget as HTMLDivElement).style.background = C.orangeLight;
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = C.border;
                        (e.currentTarget as HTMLDivElement).style.background = C.bg;
                    }}
                >
                    <div className="flex flex-col items-center gap-2.5">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
                            style={{ background: C.orangeLight }}>
                            <Upload className="w-5 h-5" style={{ color: C.orange }} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                Nhấn để chọn ảnh
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: C.gray }}>
                                JPG, PNG, WEBP · Tối đa 5MB
                            </p>
                        </div>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
                            style={{ background: C.orangeLight, color: C.orange }}>
                            {uploadedImages.length}/{maxImages} ảnh
                        </span>
                    </div>
                </div>
            )}

            {/* Preview & Upload Button */}
            {selectedFile && preview && (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: C.border }}>
                    <img src={preview} alt="Preview" className="w-full h-44 object-cover" />
                    <div className="flex items-center justify-between px-3 py-2.5" style={{ background: '#fff' }}>
                        <div className="text-xs min-w-0">
                            <p className="font-semibold truncate" style={{ color: C.navy }}>{selectedFile.name}</p>
                            <p style={{ color: C.gray }}>{(selectedFile.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={uploading}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                                style={{ borderColor: C.border, color: C.gray }}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
                                style={{ background: uploading ? C.orangeDark : C.orange }}
                            >
                                {uploading ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải...</>
                                ) : (
                                    <><Upload className="w-3.5 h-3.5" /> Tải lên</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress bar */}
            {uploading && (
                <div className="rounded-xl p-3 border" style={{ borderColor: `${C.orange}40`, background: C.orangeLight }}>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: C.navy }}>Đang tải lên...</span>
                        <span className="text-xs font-bold" style={{ color: C.orange }}>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: '#fed7aa' }}>
                        <div
                            className="h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%`, background: C.orange }}
                        />
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{error}</p>
                </div>
            )}

            {/* Uploaded Images Grid */}
            {uploadedImages.length > 0 && (
                <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>
                        Ảnh đã tải lên ({uploadedImages.length}/{maxImages})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {uploadedImages.map((image, index) => (
                            <div key={index} className="relative group aspect-square rounded-xl overflow-hidden" style={{ background: C.bg }}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedImageIndex(index)}
                                    className="w-full h-full block"
                                >
                                    <img
                                        src={image.publicUrl}
                                        alt={`Upload ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Overlay hint */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                        <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                                            <path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zM9 21l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z" />
                                        </svg>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(image.objectKey)}
                                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                                    style={{ background: '#ef4444' }}
                                    title="Xóa ảnh"
                                >
                                    <X className="w-3.5 h-3.5 text-white" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Photo Viewer Modal */}
            {selectedImageIndex !== null && uploadedImages[selectedImageIndex] && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden animate-in fade-in duration-200">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
                        <span className="text-white font-medium text-sm drop-shadow-md">
                            {selectedImageIndex + 1} / {uploadedImages.length}
                        </span>
                        <div className="flex bg-black/40 backdrop-blur-md rounded-full border border-white/20 p-1">
                            <button
                                type="button"
                                onClick={() => setSelectedImageIndex(null)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Main Image Area */}
                    <div className="flex-1 relative flex items-center justify-center w-full h-full group pb-12">
                        {/* Selected Image */}
                        <div className="relative w-full h-full max-w-4xl max-h-[80vh] flex items-center justify-center">
                            <img
                                src={uploadedImages[selectedImageIndex].publicUrl}
                                alt={`Ảnh ${selectedImageIndex + 1}`}
                                className="max-w-full max-h-full object-contain drop-shadow-2xl"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
