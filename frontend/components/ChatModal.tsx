'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat, ChatMessage } from '@/lib/hooks/useChat';
import AvatarImage from '@/components/AvatarImage';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

interface ChatModalProps {
    requestId: string;
    currentUserId: string;
    currentUserRole: 'PROVIDER' | 'CUSTOMER';
    currentUserName: string;
    myAvatar?: string | null;
    otherPartyName: string;
    otherPartyAvatar?: string | null;
    onClose: () => void;
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ msg, isMe, myAvatar, otherPartyAvatar }: { msg: ChatMessage; isMe: boolean; myAvatar?: string | null; otherPartyAvatar?: string | null }) {
    return (
        <div
            className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}
        >
            {!isMe && (
                <AvatarImage
                    name={msg.senderName}
                    avatar={otherPartyAvatar}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mr-2 self-end"
                    fallbackBackground={C.orange}
                    initialsCount={1}
                />
            )}
            <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                    className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                    style={{
                        background: isMe
                            ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`
                            : 'white',
                        color: isMe ? 'white' : C.navy,
                        borderBottomRightRadius: isMe ? '4px' : undefined,
                        borderBottomLeftRadius: !isMe ? '4px' : undefined,
                        boxShadow: isMe ? `0 2px 8px ${C.orange}30` : '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                >
                    {msg.text}
                </div>
                <span className="text-[10px] mt-1 px-1" style={{ color: C.gray }}>
                    {formatTime(msg.timestamp)}
                    {isMe && (
                        <span className="ml-1" style={{ color: msg.read ? '#3b82f6' : '#94a3b8' }}>
                            {msg.read ? '✓✓' : '✓'}
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
}

export default function ChatModal({
    requestId,
    currentUserId,
    currentUserRole,
    currentUserName,
    myAvatar,
    otherPartyName,
    otherPartyAvatar,
    onClose,
}: ChatModalProps) {
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { messages, sendMessage, markAsRead, isLoading } = useChat({
        requestId,
        currentUserId,
        currentUserRole,
        currentUserName,
        enabled: true,
    });

    // Mark unread messages as read when modal opens
    useEffect(() => {
        markAsRead();
    }, [markAsRead]);

    // Also mark as read when new messages arrive
    useEffect(() => {
        if (messages.length > 0) {
            markAsRead();
        }
    }, [messages, markAsRead]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on open
    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 150);
        return () => clearTimeout(t);
    }, []);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSend = async () => {
        if (!inputText.trim() || isSending) return;
        const text = inputText;
        setInputText('');
        setIsSending(true);
        try {
            await sendMessage(text);
        } catch (err) {
            console.error('[ChatModal] Send failed:', err);
            setInputText(text); // Restore on failure
        } finally {
            setIsSending(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="flex flex-col mx-auto w-full max-w-lg mt-auto"
                style={{
                    height: 'min(92vh, 680px)',
                    background: C.bg,
                    borderRadius: '24px 24px 0 0',
                    overflow: 'hidden',
                    boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div
                    className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
                    style={{
                        background: 'white',
                        borderBottom: `1px solid ${C.border}`,
                        boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
                    }}
                >
                    <AvatarImage
                        name={otherPartyName}
                        avatar={otherPartyAvatar}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        fallbackBackground={C.orange}
                        initialsCount={1}
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: C.navy }}>
                            {otherPartyName}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
                            <p className="text-[10px]" style={{ color: C.gray }}>Đang hoạt động</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-70"
                        style={{ background: C.bg }}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* ── Messages ── */}
                <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollBehavior: 'smooth' }}>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: C.orange }} />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: C.orangeLight }}>
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium" style={{ color: C.gray }}>Chưa có tin nhắn nào</p>
                            <p className="text-xs text-center" style={{ color: '#94a3b8' }}>
                                Bắt đầu cuộc trò chuyện với {otherPartyName}
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                msg={msg}
                                isMe={msg.senderId === currentUserId}
                                myAvatar={myAvatar}
                                otherPartyAvatar={otherPartyAvatar}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* ── Input ── */}
                <div
                    className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
                    style={{
                        background: 'white',
                        borderTop: `1px solid ${C.border}`,
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập tin nhắn..."
                        className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
                        style={{
                            background: C.bg,
                            border: `1.5px solid ${C.border}`,
                            color: C.navy,
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim() || isSending}
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                        style={{
                            background: inputText.trim() && !isSending
                                ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`
                                : C.border,
                            boxShadow: inputText.trim() && !isSending
                                ? `0 2px 8px ${C.orange}40`
                                : 'none',
                        }}
                    >
                        {isSending ? (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={inputText.trim() ? 'white' : C.gray} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
