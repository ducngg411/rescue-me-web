'use client';

interface OnlineToggleProps {
    isOnline: boolean;
    isLoading: boolean;
    onToggle: (newStatus: boolean) => Promise<void>;
}

export default function OnlineToggle({ isOnline, isLoading, onToggle }: OnlineToggleProps) {
    const handleToggle = async () => {
        if (isLoading) return;
        await onToggle(!isOnline);
    };

    return (
        <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
            <div className="max-w-6xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">Provider Dashboard</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            <span className="text-sm text-gray-600">
                                {isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleToggle}
                        disabled={isLoading}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isOnline ? 'bg-green-500' : 'bg-gray-300'
                            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span className="sr-only">Toggle status</span>
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isOnline ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}
