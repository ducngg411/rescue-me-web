'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { userDisputeApi } from '@/lib/api';
import { uploadFile, UploadPurpose } from '@/lib/upload';
import ImageUpload from '@/components/ImageUpload';
import VideoUpload from '@/components/VideoUpload';

const C = {
    orange: '#f97316',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f8fafc',
    red: '#ef4444',
};

export type CreateDisputeSheetProps = {
    open: boolean;
    onClose: () => void;
    requestId: string;
    paymentId: string;
    totalAmount: number;
};

/**
 * Full create-dispute form: reason, description, target amount, expected outcome, evidence images/video.
 * Evidence URLs are attached in the opening dispute message.
 */
export default function CreateDisputeSheet({
    open,
    onClose,
    requestId,
    paymentId,
    totalAmount,
}: CreateDisputeSheetProps) {
    const { t, locale } = useLanguage();
    const router = useRouter();
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [expectedOutcome, setExpectedOutcome] = useState('');
    const [uploadedImages, setUploadedImages] = useState<Array<{ objectKey: string; publicUrl: string }>>([]);
    const [videoUrls, setVideoUrls] = useState<string[]>([]);
    const [videoUploadIds, setVideoUploadIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setReason('');
            setDescription('');
            setExpectedOutcome('');
            setUploadedImages([]);
            setVideoUrls([]);
            setVideoUploadIds([]);
        }
    }, [open, totalAmount]);

    const handleSubmit = async () => {
        const reasonTrim = reason.trim();
        if (!reasonTrim) {
            toast.error(t('user.disputes.create.errorReason'));
            return;
        }
        const target = Math.floor(Number(totalAmount));
        if (!Number.isFinite(target) || target < 1) {
            toast.error(t('user.disputes.create.errorTarget'));
            return;
        }
        if (target > totalAmount) {
            toast.error(t('user.disputes.create.errorTargetMax'));
            return;
        }

        setSubmitting(true);
        const evidenceUrls: string[] = [
            ...uploadedImages.map((img) => img.publicUrl),
            ...videoUrls,
        ];
        try {

            const result = await userDisputeApi.openDispute({
                orderId: requestId,
                paymentId,
                targetAmount: target,
                reason: reasonTrim,
                description: description.trim() || undefined,
                expectedOutcome: expectedOutcome.trim() || undefined,
                attachmentUrls: evidenceUrls,
            });

            toast.success(t('user.disputes.create.successToast'));
            onClose();
            router.push(`/user/disputes/${result.disputeId}`);
        } catch (err: unknown) {
            const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
            const msg =
                anyErr.response?.data?.message ||
                anyErr.message ||
                t('user.disputes.create.errorGeneric');
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    const loc = locale === 'vi' ? 'vi-VN' : 'en-US';

    return (
        <div
            className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => !submitting && onClose()}
        >
            <div
                className="w-full sm:max-w-lg sm:rounded-2xl sm:mx-4"
                style={{ background: 'white', borderRadius: '24px 24px 0 0' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 pb-8 pt-5 max-h-[85vh] overflow-y-auto">
                    <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
                    <h3 className="text-base font-bold mb-1" style={{ color: C.navy }}>
                        {t('user.disputes.create.sheetTitle')}
                    </h3>
                    <p className="text-xs mb-4" style={{ color: C.gray }}>
                        {t('user.disputes.create.sheetSubtitle')}
                    </p>

                    <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>
                        {t('user.disputes.create.reasonLabel')} <span style={{ color: C.red }}>*</span>
                    </label>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t('user.disputes.create.reasonPlaceholder')}
                        className="w-full py-2.5 px-3 rounded-xl text-sm outline-none mb-3 border focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                        style={{ background: C.bg, borderColor: C.border, color: C.navy }}
                    />

                    <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>
                        {t('user.disputes.create.descriptionLabel')}
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('user.disputes.create.descriptionPlaceholder')}
                        rows={3}
                        className="w-full py-2.5 px-3 rounded-xl text-sm outline-none resize-none mb-3 border focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                        style={{ background: C.bg, borderColor: C.border, color: C.navy }}
                    />

                    <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>
                        {t('user.disputes.create.targetAmountLabel')} <span style={{ color: C.red }}>*</span>
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={totalAmount}
                        value={totalAmount}
                        readOnly
                        className="w-full py-2.5 px-3 rounded-xl text-sm outline-none mb-1 tabular-nums border cursor-not-allowed"
                        style={{ background: '#f1f5f9', borderColor: C.border, color: C.gray }}
                    />
                    <p className="text-[10px] mb-3" style={{ color: C.gray }}>
                        {t('user.disputes.create.targetAmountHint', {
                            amount: totalAmount.toLocaleString(loc),
                        })}
                    </p>

                    <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>
                        {t('user.disputes.create.expectedOutcomeLabel')}
                    </label>
                    <textarea
                        value={expectedOutcome}
                        onChange={(e) => setExpectedOutcome(e.target.value)}
                        placeholder={t('user.disputes.create.expectedOutcomePlaceholder')}
                        rows={2}
                        className="w-full py-2.5 px-3 rounded-xl text-sm outline-none resize-none mb-3 border focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                        style={{ background: C.bg, borderColor: C.border, color: C.navy }}
                    />

                    <label className="block text-xs font-semibold mt-4 mb-3" style={{ color: C.navy }}>
                        {t('user.disputes.create.evidenceLabel')} (Tuỳ chọn)
                    </label>
                    <div className="space-y-4 mb-6">
                        <ImageUpload
                            purpose={UploadPurpose.REQUEST_PHOTO}
                            maxImages={5}
                            uploadedImages={uploadedImages}
                            onSuccess={(objectKey, publicUrl) => {
                                setUploadedImages((prev) => [...prev, { objectKey, publicUrl }]);
                            }}
                            onRemove={(objectKey) => {
                                setUploadedImages((prev) => prev.filter((img) => img.objectKey !== objectKey));
                            }}
                            label="Ảnh bằng chứng"
                        />
                        <VideoUpload
                            label="Video bằng chứng"
                            maxVideos={2}
                            cloudinaryCloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''}
                            cloudinaryUploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''}
                            uploadedVideos={videoUrls.map((url, idx) => ({
                                url,
                                uploadId: videoUploadIds[idx],
                            }))}
                            onSuccess={(videoUrl, uploadId) => {
                                setVideoUrls((prev) => [...prev, videoUrl]);
                                setVideoUploadIds((prev) => [...prev, uploadId]);
                            }}
                            onRemove={(videoUrl, uploadId) => {
                                setVideoUrls((prev) => prev.filter((u) => u !== videoUrl));
                                setVideoUploadIds((prev) => prev.filter((id) => id !== uploadId));
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => !submitting && onClose()}
                            className="py-3 rounded-2xl text-sm font-semibold"
                            style={{ background: C.bg, color: C.gray }}
                        >
                            {t('user.disputes.create.cancelBtn')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="py-3 rounded-2xl text-sm font-bold text-white transition-opacity"
                            style={{ background: C.orange, opacity: submitting ? 0.7 : 1 }}
                        >
                            {submitting ? t('user.disputes.create.submitting') : t('user.disputes.create.submitBtn')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
