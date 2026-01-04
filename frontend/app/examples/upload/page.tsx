'use client';

import React from 'react';
import ProviderVerificationUpload from '@/components/ProviderVerificationUpload';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose } from '@/lib/upload';
import { useAuthGuard } from '@/lib/guards';

export default function UploadExamplePage() {
    const { isReady } = useAuthGuard({ requireAuth: true });

    if (!isReady) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                <h1 className="text-3xl font-bold mb-8">Upload System Examples</h1>

                {/* Example 1: Provider Verification */}
                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-4">1. Provider Verification Upload</h2>
                    <ProviderVerificationUpload />
                </section>

                {/* Example 2: Request Photo Upload */}
                <section className="mb-12">
                    <div className="bg-white rounded-lg p-6 shadow-sm border">
                        <h2 className="text-2xl font-semibold mb-4">2. Request Photo Upload</h2>
                        <p className="text-gray-600 mb-4">
                            Upload photos for a rescue request (e.g., car breakdown photo)
                        </p>
                        <FileUpload
                            purpose={UploadPurpose.REQUEST_PHOTO}
                            label="Upload Request Photo"
                            onSuccess={(result) => {
                                console.log('Upload success:', result);
                                alert(`Upload successful! URL: ${result.publicUrl}`);
                            }}
                            onError={(error) => {
                                console.error('Upload error:', error);
                                alert(`Upload failed: ${error}`);
                            }}
                        />
                    </div>
                </section>

                {/* Example 3: Review Photo Upload */}
                <section className="mb-12">
                    <div className="bg-white rounded-lg p-6 shadow-sm border">
                        <h2 className="text-2xl font-semibold mb-4">3. Review Photo Upload</h2>
                        <p className="text-gray-600 mb-4">Upload photos when writing a review</p>
                        <FileUpload
                            purpose={UploadPurpose.REVIEW_PHOTO}
                            label="Upload Review Photo"
                            onSuccess={(result) => {
                                console.log('Upload success:', result);
                                alert(`Upload successful! URL: ${result.publicUrl}`);
                            }}
                            onError={(error) => {
                                console.error('Upload error:', error);
                                alert(`Upload failed: ${error}`);
                            }}
                        />
                    </div>
                </section>

                {/* Example 4: Before/After Photos */}
                <section className="mb-12">
                    <div className="bg-white rounded-lg p-6 shadow-sm border">
                        <h2 className="text-2xl font-semibold mb-4">4. Before/After Photos</h2>
                        <p className="text-gray-600 mb-4">Upload before and after photos of the rescue</p>
                        <div className="grid md:grid-cols-2 gap-6">
                            <FileUpload
                                purpose={UploadPurpose.BEFORE_AFTER}
                                label="Before Photo"
                                onSuccess={(result) => {
                                    console.log('Before photo uploaded:', result);
                                }}
                                onError={(error) => {
                                    console.error('Upload error:', error);
                                }}
                            />
                            <FileUpload
                                purpose={UploadPurpose.BEFORE_AFTER}
                                label="After Photo"
                                onSuccess={(result) => {
                                    console.log('After photo uploaded:', result);
                                }}
                                onError={(error) => {
                                    console.error('Upload error:', error);
                                }}
                            />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
