'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, AlertCircle, Video } from 'lucide-react';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface VideoUploadProps {
    label?: string;
    maxVideos?: number;
    cloudinaryCloudName: string;
    cloudinaryUploadPreset: string;
    onSuccess?: (videoUrl: string, uploadId: string) => void;
    onRemove?: (videoUrl: string, uploadId: string) => void;
    uploadedVideos?: Array<{ url: string; uploadId: string }>;
    disabled?: boolean;
    /** Skip the backend tracking call — use for guest users who have no userId */
    skipTracking?: boolean;
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

export default function VideoUpload({
    label = 'Upload Video',
    maxVideos = 2,
    cloudinaryCloudName,
    cloudinaryUploadPreset,
    onSuccess,
    onRemove,
    uploadedVideos = [],
    disabled = false,
    skipTracking = false,
}: VideoUploadProps) {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            setError(t('components.fileUpload.errors.videoTypeOnly'));
            return;
        }

        // Validate file size (max 50MB for video)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            setError(t('components.fileUpload.errors.videoMaxSize'));
            return;
        }

        setSelectedFile(file);
        setError(null);

        // Create local preview URL
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        if (uploadedVideos.length >= maxVideos) {
            setError(t('components.fileUpload.errors.maxVideos', { max: maxVideos }));
            return;
        }

        // Validate Cloudinary config
        if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
            setError(t('components.fileUpload.errors.cloudinaryMissing'));
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

                    if (skipTracking) {
                        // Guest mode: no backend tracking needed, use publicId as uploadId
                        onSuccess?.(videoUrl, publicId);
                        setSelectedFile(null);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                        setProgress(0);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                        setUploading(false);
                    } else {
                        trackVideoUpload(videoUrl, publicId, selectedFile);
                    }
                } else {
                    setError(t('components.fileUpload.errors.uploadVideoFailed'));
                    setUploading(false);
                }
            });

            xhr.addEventListener('error', () => {
                setError(t('components.fileUpload.errors.genericVideo'));
                setUploading(false);
            });

            xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/upload`);
            xhr.send(formData);
        } catch {
            setError(t('components.fileUpload.errors.genericVideo'));
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
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            setProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error('Failed to track upload:', error);
            setError(t('components.fileUpload.errors.trackVideoFailed'));
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async (uploadId: string, videoUrl: string) => {
        if (skipTracking) {
            // Guest mode: no backend record to delete, just update UI
            onRemove?.(videoUrl, uploadId);
            return;
        }
        try {
            await api.delete(`/uploads/cloudinary/${uploadId}`);
            onRemove?.(videoUrl, uploadId);
        } catch (error: any) {
            console.error('Failed to delete video:', error);
            const errorMessage = error.response?.data?.message || t('components.fileUpload.errors.deleteVideoFailed');
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
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setError(null);
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleButtonClick = () => {
        if (uploadedVideos.length >= maxVideos) {
            setError(t('components.fileUpload.errors.maxVideosReached', { max: maxVideos }));
            return;
        }
        fileInputRef.current?.click();
    };

    const canUploadMore = uploadedVideos.length < maxVideos && !disabled;

    return (
        <div className="space-y-3">
            {label && <label className="block text-sm font-medium" style={{ color: C.navy }}>{label}</label>}

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
            {canUploadMore && !selectedFile && (
                <div
                    onClick={handleButtonClick}
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
                            <Video className="w-5 h-5" style={{ color: C.orange }} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                {t('components.fileUpload.clickToSelectVideo')}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: C.gray }}>
                                {t('components.fileUpload.supportedVideo')}
                            </p>
                        </div>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
                            style={{ background: C.orangeLight, color: C.orange }}>
                            {t('components.fileUpload.videoCountBadge', { current: uploadedVideos.length, max: maxVideos })}
                        </span>
                    </div>
                </div>
            )}

            {/* File Selected Preview & Action */}
            {selectedFile && previewUrl && (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: C.border }}>
                    <div className="w-full bg-black aspect-video flex items-center justify-center">
                        <video src={previewUrl} controls className="max-w-full max-h-full" />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5" style={{ background: '#fff' }}>
                        <div className="text-xs min-w-0">
                            <p className="font-semibold truncate" style={{ color: C.navy }}>{selectedFile.name}</p>
                            <p style={{ color: C.gray }}>{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={uploading}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                                style={{ borderColor: C.border, color: C.gray }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
                                style={{ background: uploading ? C.orangeDark : C.orange }}
                            >
                                {uploading ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('components.fileUpload.uploading')}</>
                                ) : (
                                    <><Upload className="w-3.5 h-3.5" /> {t('components.fileUpload.upload')}</>
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
                        <span className="text-xs font-medium" style={{ color: C.navy }}>{t('components.fileUpload.progressLabel')}</span>
                        <span className="text-xs font-bold" style={{ color: C.orange }}>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: '#fed7aa' }}>
                        <div
                            className="h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%`, background: C.orange }}
                        />
                    </div>
                    <p className="text-[10px] mt-2 text-center" style={{ color: C.orangeDark }}>{t('components.fileUpload.keepPageOpen')}</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{error}</p>
                </div>
            )}

            {/* Uploaded Videos Grid */}
            {uploadedVideos.length > 0 && (
                <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>
                        {t('components.fileUpload.uploadedVideosHeading', { current: uploadedVideos.length, max: maxVideos })}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {uploadedVideos.map((video, index) => (
                            <div key={index} className="relative group aspect-square rounded-xl overflow-hidden bg-black flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={() => setSelectedVideoIndex(index)}
                                    className="w-full h-full block"
                                >
                                    <video
                                        src={video.url}
                                        className="w-full h-full object-cover opacity-80"
                                    />
                                    {/* Play icon overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center transition-opacity" style={{ background: 'rgba(0,0,0,0.2)' }}>
                                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <svg width="20" height="20" fill="white" viewBox="0 0 24 24" className="ml-1">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                        </div>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(video.uploadId, video.url)}
                                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                                    style={{ background: '#ef4444' }}
                                    title={t('components.fileUpload.removeVideoTitle')}
                                >
                                    <X className="w-3.5 h-3.5 text-white" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Video Viewer Modal */}
            {selectedVideoIndex !== null && uploadedVideos[selectedVideoIndex] && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden animate-in fade-in duration-200">
                    {/* Header Controls */}
                    <div className="flex items-center justify-end p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
                        <div className="flex bg-black/40 backdrop-blur-md rounded-full border border-white/20 p-1">
                            <button
                                type="button"
                                onClick={() => setSelectedVideoIndex(null)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Main Video Area */}
                    <div className="flex-1 relative flex items-center justify-center w-full h-full group pb-12">
                        <div className="relative w-full h-full max-w-4xl max-h-[80vh] flex items-center justify-center">
                            <video
                                src={uploadedVideos[selectedVideoIndex].url}
                                controls
                                autoPlay
                                className="max-w-full max-h-full drop-shadow-2xl"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
