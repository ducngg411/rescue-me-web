import api from './api';

export enum UploadPurpose {
    PROVIDER_VERIFICATION = 'provider_verification',
    REQUEST_PHOTO = 'request_photo',
    REVIEW_PHOTO = 'review_photo',
    BEFORE_AFTER = 'before_after',
    CHATBOT_ATTACHMENT = 'chatbot_attachment',
}

export enum DocumentType {
    CITIZEN_ID_FRONT = 'citizenIdFront',
    CITIZEN_ID_BACK = 'citizenIdBack',
    SELFIE = 'selfie',
    CAR_PHOTO = 'carPhoto',
    MOTORBIKE_PHOTO = 'motorbikePhoto',
    DRIVER_LICENSE = 'driverLicense',
    BUSINESS_REGISTRATION = 'businessRegistration',
}

export interface PresignUploadRequest {
    purpose: UploadPurpose;
    docType?: DocumentType;
    fileName: string;
    fileSize: number;
    contentType: string;
}

export interface PresignUploadResponse {
    uploadUrl: string;
    objectKey: string;
    publicUrl: string;
    uploadId: string;
    expiresIn: number;
}

export interface ConfirmUploadResponse {
    success: boolean;
    upload: {
        id: string;
        objectKey: string;
        publicUrl: string;
        fileName: string;
        fileSize: number;
        contentType: string;
        createdAt: string;
    };
}

export interface UploadResult {
    success: boolean;
    publicUrl?: string;
    upload?: ConfirmUploadResponse['upload'];
    error?: string;
}

/**
 * Upload a file to Cloudflare R2 using presigned URL
 * @param file - File to upload
 * @param purpose - Upload purpose
 * @param docType - Document type (required for provider_verification)
 * @param onProgress - Progress callback (0-100)
 * @returns Upload result with public URL
 */
export async function uploadFile(
    file: File,
    purpose: UploadPurpose,
    docType?: DocumentType,
    onProgress?: (progress: number) => void
): Promise<UploadResult> {
    try {
        // Validate file
        const validation = validateFile(file, purpose);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
            };
        }

        // Step 1: Get presigned URL
        onProgress?.(10);
        const presignResponse = await api.post<PresignUploadResponse>('/uploads/presign', {
            purpose,
            docType,
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type,
        });

        const { uploadUrl, uploadId, publicUrl } = presignResponse.data;

        // Step 2: Upload to R2 directly
        onProgress?.(20);
        await uploadToR2(file, uploadUrl, (progress) => {
            // Map 20-80% to upload progress
            onProgress?.(20 + progress * 0.6);
        });

        // Step 3: Confirm upload
        onProgress?.(90);
        const confirmResponse = await api.post<ConfirmUploadResponse>('/uploads/confirm', {
            uploadId,
        });

        onProgress?.(100);

        return {
            success: true,
            publicUrl,
            upload: confirmResponse.data.upload,
        };
    } catch (error: any) {
        console.error('Upload failed:', error);
        return {
            success: false,
            error: error.response?.data?.message || error.message || 'Upload failed',
        };
    }
}

/**
 * Upload file directly to R2 using presigned URL
 */
async function uploadToR2(
    file: File,
    uploadUrl: string,
    onProgress?: (progress: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const progress = (e.loaded / e.total) * 100;
                onProgress?.(progress);
            }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'));
        });

        // Send PUT request
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
    });
}

/**
 * Validate file before upload
 */
export function validateFile(file: File, purpose?: UploadPurpose): { valid: boolean; error?: string } {
    let MAX_SIZE = 5 * 1024 * 1024; // 5MB
    let ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    if (purpose === UploadPurpose.CHATBOT_ATTACHMENT) {
        MAX_SIZE = 50 * 1024 * 1024; // 50MB
        ALLOWED_TYPES = [...ALLOWED_TYPES, 'video/mp4', 'video/quicktime', 'video/webm'];
    }

    if (file.size > MAX_SIZE) {
        return {
            valid: false,
            error: `File size must not exceed ${MAX_SIZE / (1024 * 1024)}MB`,
        };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: purpose === UploadPurpose.CHATBOT_ATTACHMENT 
                ? 'Only JPEG, PNG, WebP images and MP4, MOV, WEBM videos are allowed'
                : 'Only JPEG, PNG, and WebP images are allowed',
        };
    }

    return { valid: true };
}

/**
 * Get user's uploads
 */
export async function getUserUploads(purpose?: UploadPurpose) {
    const params = purpose ? { purpose } : {};
    const response = await api.get('/uploads', { params });
    return response.data;
}

/**
 * Delete upload by ID
 */
export async function deleteUpload(uploadId: string) {
    const response = await api.delete(`/uploads/${uploadId}`);
    return response.data;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
