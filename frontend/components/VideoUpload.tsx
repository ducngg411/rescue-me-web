'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, AlertCircle, CheckCircle, Video } from 'lucide-react';
import api from '@/lib/api';

interface VideoUploadProps {
    label?: string;
    maxVideos?: number;
    cloudinaryCloudName: string;
    cloudinaryUploadPreset: string;
    onSuccess?: (videoUrl: string, uploadId: string) => void;
    onRemove?: (videoUrl: string, uploadId: string) => void;
    uploadedVideos?: Array<{ url: string; uploadId: string }>;
    disabled?: boolean;
}

export default function VideoUpload({
    label = 'Upload Video',
    maxVideos = 2,
    cloudinaryCloudName,
    cloudinaryUploadPreset,
    onSuccess,
    onRemove,
    uploadedVideos = [],
    disabled = false,
}: VideoUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            setError('Vui lòng chọn file video');
            return;
        }

        // Validate file size (max 50MB for video)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            setError('Video không được vượt quá 50MB');
            return;
        }

        setSelectedFile(file);
        setError(null);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        if (uploadedVideos.length >= maxVideos) {
            setError(`Chỉ được upload tối đa ${maxVideos} video`);
            return;
        }

        // Validate Cloudinary config
        if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
            setError('Chưa cấu hình Cloudinary. Vui lòng kiểm tra file .env.local');
            return;
        }

        setUploading(true);
        setProgress(0);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('upload_preset', cloudinaryUploadPreset);
            formData.append('resource_type', 'video');

            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    setProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    const videoUrl = response.secure_url;
                    const publicId = response.public_id;

                    // Track upload in backend
                    trackVideoUpload(videoUrl, publicId, selectedFile);
                } else {
                    setError('Upload thất bại. Vui lòng thử lại.');
                    setUploading(false);
                }
            });

            xhr.addEventListener('error', () => {
                setError('Có lỗi xảy ra khi upload video');
                setUploading(false);
            });

            xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/upload`);
            xhr.send(formData);
        } catch (err) {
            setError('Có lỗi xảy ra khi upload video');
            setUploading(false);
        }
    };

    const trackVideoUpload = async (videoUrl: string, publicId: string, file: File) => {
        try {
            const response = await api.post('/uploads/cloudinary/track', {
                publicUrl: videoUrl,
                cloudinaryPublicId: publicId,
                fileName: file.name,
                fileSize: file.size,
                contentType: file.type,
                resourceType: 'video',
            });

            onSuccess?.(videoUrl, response.data.uploadId);
            setSelectedFile(null);
            setProgress(0);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Failed to track upload:', error);
            setError('Không thể lưu video. Vui lòng thử lại.');
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async (uploadId: string, videoUrl: string) => {
        try {
            await api.delete(`/uploads/cloudinary/${uploadId}`);
            onRemove?.(videoUrl, uploadId);
        } catch (error: any) {
            console.error('Failed to delete video:', error);
            const errorMessage = error.response?.data?.message || 'Không thể xóa video';
            setError(errorMessage);

            // If the video was already deleted (404 or upload not found), still call onRemove to update UI
            if (error.response?.status === 404 ||
                errorMessage.includes('not found') ||
                errorMessage.includes('Upload not found')) {
                console.log('Video already deleted, updating UI anyway');
                onRemove?.(videoUrl, uploadId);
            }
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setError(null);
        setProgress(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleButtonClick = () => {
        if (uploadedVideos.length >= maxVideos) {
            setError(`Bạn đã upload tối đa ${maxVideos} video`);
            return;
        }
        fileInputRef.current?.click();
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const canUploadMore = uploadedVideos.length < maxVideos;

    return (
        <div className="space-y-4">
            {/* Label */}
            {label && (
                <label className="block text-sm font-semibold text-gray-700">
                    {label} ({uploadedVideos.length}/{maxVideos})
                </label>
            )}

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={disabled || uploading || !canUploadMore}
                className="hidden"
            />

            {/* Upload Area */}
            {!selectedFile && canUploadMore && (
                <div
                    onClick={handleButtonClick}
                    className={`relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group ${disabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <Video className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-base font-medium text-gray-700 group-hover:text-blue-600">
                                Nhấn để chọn video
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                hoặc kéo thả video vào đây
                            </p>
                        </div>
                        <p className="text-xs text-gray-400">
                            Hỗ trợ: MP4, MOV, AVI (tối đa 50MB)
                        </p>
                    </div>
                </div>
            )}

            {/* File Selected */}
            {selectedFile && !uploading && (
                <div className="bg-white rounded-lg border-2 border-gray-200 p-4 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Video className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                            <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleReset}
                            className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <X className="w-4 h-4" />
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleUpload}
                            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            Tải lên
                        </button>
                    </div>
                </div>
            )}

            {/* Progress bar */}
            {uploading && (
                <div className="bg-white rounded-lg border-2 border-blue-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Đang tải lên video...</span>
                        <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 text-center">Vui lòng không đóng trang này...</p>
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

            {/* Uploaded Videos */}
            {uploadedVideos.length > 0 && (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">Video đã upload:</p>
                    {uploadedVideos.map((video, index) => (
                        <div key={index} className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-green-800 mb-2">Video {index + 1}</p>
                                    <video
                                        src={video.url}
                                        controls
                                        className="w-full max-h-48 rounded-lg border border-green-300"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(video.uploadId, video.url)}
                                    disabled={disabled}
                                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Max reached message */}
            {!canUploadMore && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium">
                        Bạn đã upload tối đa {maxVideos} video
                    </p>
                </div>
            )}
        </div>
    );
}
