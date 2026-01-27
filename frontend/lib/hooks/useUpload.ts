'use client';

import { useState, useCallback } from 'react';
import { uploadFile, UploadPurpose, DocumentType, UploadResult } from '@/lib/upload';

export interface UseUploadOptions {
    purpose: UploadPurpose;
    docType?: DocumentType;
    onSuccess?: (result: UploadResult) => void;
    onError?: (error: string) => void;
}

export interface UseUploadReturn {
    upload: (file: File) => Promise<void>;
    uploading: boolean;
    progress: number;
    error: string | null;
    result: UploadResult | null;
    reset: () => void;
}

export function useUpload(options: UseUploadOptions): UseUploadReturn {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<UploadResult | null>(null);

    const upload = useCallback(
        async (file: File) => {
            setUploading(true);
            setProgress(0);
            setError(null);
            setResult(null);

            try {
                const uploadResult = await uploadFile(
                    file,
                    options.purpose,
                    options.docType,
                    setProgress
                );

                setResult(uploadResult);

                if (uploadResult.success) {
                    options.onSuccess?.(uploadResult);
                } else {
                    setError(uploadResult.error || 'Upload failed');
                    options.onError?.(uploadResult.error || 'Upload failed');
                }
            } catch (err: any) {
                const errorMsg = err.message || 'Upload failed';
                setError(errorMsg);
                options.onError?.(errorMsg);
            } finally {
                setUploading(false);
            }
        },
        [options]
        setProgress(0);
    setError(null);
    setResult(null);
}, []);

return {
    upload,
    uploading,
    progress,
    error,
    result,
    reset,
};
}
