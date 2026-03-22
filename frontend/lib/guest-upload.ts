/**
 * Upload helpers for guest users.
 * Calls /guest/uploads/presign (no DB record tied to a userId).
 */
import api from './api';

export interface GuestUploadResult {
    success: boolean;
    objectKey?: string;
    publicUrl?: string;
    error?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function uploadGuestImage(
    file: File,
    onProgress?: (pct: number) => void,
): Promise<GuestUploadResult> {
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { success: false, error: 'Chỉ chấp nhận file ảnh (JPG, PNG, WEBP)' };
    }
    if (file.size > MAX_SIZE) {
        return { success: false, error: 'Ảnh không được vượt quá 5MB' };
    }

    try {
        onProgress?.(10);

        // Step 1: get presigned URL
        const presignRes = await api.post<{
            uploadUrl: string;
            objectKey: string;
            publicUrl: string;
            expiresIn: number;
        }>('/guest/uploads/presign', {
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type,
        });

        const { uploadUrl, objectKey, publicUrl } = presignRes.data;
        onProgress?.(20);

        // Step 2: PUT directly to R2
        await uploadToR2(file, uploadUrl, (pct) => onProgress?.(20 + pct * 0.75));
        onProgress?.(97);

        // Step 3: confirm (no-op on backend, kept for API symmetry)
        await api.post('/guest/uploads/confirm', { objectKey });
        onProgress?.(100);

        return { success: true, objectKey, publicUrl };
    } catch (err: any) {
        return {
            success: false,
            error: err?.response?.data?.message || err?.message || 'Upload thất bại',
        };
    }
}

function uploadToR2(
    file: File,
    url: string,
    onProgress?: (pct: number) => void,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) onProgress?.((e.loaded / e.total) * 100);
        });
        xhr.addEventListener('load', () => {
            xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
    });
}
