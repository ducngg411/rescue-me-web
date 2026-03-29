'use client';

import { useState, useCallback, useRef } from 'react';
import api from '@/lib/api';

/** Mirrors backend CustomerCtaPhase for assistant message chips */
export type CustomerCtaPhase =
    | 'SELECT_ISSUE'
    | 'ENTER_INFO'
    | 'CONFIRM_INFO'
    | 'CREATE_REQUEST'
    | 'LOCATION_CHOICE'
    | 'DESCRIBE_INCIDENT'
    | 'COMPLAINT_CONFIRM'
    | 'GENERAL';

export interface ChatbotMessage {
    id: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
    content: string;
    imageUrls?: string[];
    toolCalls?: unknown;
    metadata?: { ctaPhase?: CustomerCtaPhase } | null;
    /** Flattened from metadata.ctaPhase for UI */
    ctaPhase?: CustomerCtaPhase | null;
    createdAt: string;
    isStreaming?: boolean;
}

export interface ChatbotConversation {
    id: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
    messages?: ChatbotMessage[];
}

interface UseChatbotOptions {
    isGuest?: boolean;
    onAction?: (event: { action: string; payload?: Record<string, unknown> }) => void;
}

export function useChatbot(options: UseChatbotOptions = {}) {
    const { isGuest = false, onAction } = options;
    const prefix = isGuest ? '/chatbot/guest' : '/chatbot';

    const [conversations, setConversations] = useState<ChatbotConversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<ChatbotConversation | null>(null);
    const [messages, setMessages] = useState<ChatbotMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [activeToolName, setActiveToolName] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const loadConversations = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`${prefix}/conversations`);
            setConversations(res.data);
        } catch (err) {
            console.error('[useChatbot] loadConversations error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [prefix]);

    const createConversation = useCallback(async (title?: string) => {
        try {
            const res = await api.post(`${prefix}/conversations`, { title });
            const conv = res.data;
            setActiveConversation(conv);
            setMessages([]);
            setConversations((prev) => [conv, ...prev]);
            return conv;
        } catch (err) {
            console.error('[useChatbot] createConversation error:', err);
            return null;
        }
    }, [prefix]);

    const loadConversation = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const res = await api.get(`${prefix}/conversations/${id}`);
            const conv = res.data;
            setActiveConversation(conv);
            const raw = conv.messages || [];
            const visibleMessages = raw
                .filter((m: ChatbotMessage) => m.role === 'USER' || m.role === 'ASSISTANT')
                .map((m: ChatbotMessage) => {
                    const meta = m.metadata as { ctaPhase?: CustomerCtaPhase } | null | undefined;
                    const ctaPhase = meta?.ctaPhase ?? m.ctaPhase ?? null;
                    return { ...m, ctaPhase };
                });
            setMessages(visibleMessages);
        } catch (err) {
            console.error('[useChatbot] loadConversation error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [prefix]);

    const deleteConversation = useCallback(async (id: string) => {
        try {
            await api.delete(`${prefix}/conversations/${id}`);
            setConversations((prev) => prev.filter((c) => c.id !== id));
            if (activeConversation?.id === id) {
                setActiveConversation(null);
                setMessages([]);
            }
        } catch (err) {
            console.error('[useChatbot] deleteConversation error:', err);
        }
    }, [prefix, activeConversation]);

    const sendMessage = useCallback(async (
        content: string,
        displayMediaUrls?: string[],
        analysisImageUrls?: string[],
    ) => {
        if (!activeConversation || isSending) return;

        const userMsg: ChatbotMessage = {
            id: `temp-${Date.now()}`,
            role: 'USER',
            content,
            imageUrls: displayMediaUrls,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);

        const assistantId = `assistant-${Date.now()}`;
        const assistantMsg: ChatbotMessage = {
            id: assistantId,
            role: 'ASSISTANT',
            content: '',
            createdAt: new Date().toISOString(),
            isStreaming: true,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        setIsSending(true);
        setActiveToolName(null);

        const abortController = new AbortController();
        abortRef.current = abortController;

        try {
            const baseURL = api.defaults.baseURL || 'http://localhost:3001/api';
            const url = `${baseURL}${prefix}/conversations/${activeConversation.id}/messages`;

            const token = isGuest
                ? localStorage.getItem('guestAccessToken')
                : localStorage.getItem('accessToken');

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    content,
                    imageUrls: analysisImageUrls ?? displayMediaUrls,
                    originalMediaUrls: displayMediaUrls,
                }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                let serverMessage = '';
                try {
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const errData = await response.json();
                        if (typeof errData?.message === 'string') {
                            serverMessage = errData.message;
                        } else if (Array.isArray(errData?.message) && errData.message.length > 0) {
                            serverMessage = String(errData.message[0]);
                        }
                    } else {
                        const text = await response.text();
                        if (text) serverMessage = text;
                    }
                } catch {
                    // ignore parse errors
                }
                throw new Error(serverMessage || `HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';
            let doneCtaPhase: CustomerCtaPhase | undefined;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const event = JSON.parse(data);

                        if (event.type === 'delta' && event.content) {
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantId
                                        ? { ...m, content: m.content + event.content }
                                        : m,
                                ),
                            );
                        } else if (event.type === 'tool_start') {
                            setActiveToolName(event.toolName || null);
                        } else if (event.type === 'tool_end') {
                            setActiveToolName(null);
                        } else if (event.type === 'action' && event.action) {
                            onAction?.({ action: event.action, payload: event.payload });
                        } else if (event.type === 'error') {
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantId
                                        ? {
                                              ...m,
                                              content: event.content || 'Có lỗi xảy ra.',
                                              isStreaming: false,
                                          }
                                        : m,
                                ),
                            );
                        } else if (event.type === 'done' && event.ctaPhase) {
                            doneCtaPhase = event.ctaPhase as CustomerCtaPhase;
                        }
                    } catch {
                        // skip malformed JSON
                    }
                }
            }

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId
                        ? {
                              ...m,
                              isStreaming: false,
                              ...(doneCtaPhase ? { ctaPhase: doneCtaPhase } : {}),
                          }
                        : m,
                ),
            );
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            console.error('[useChatbot] sendMessage error:', err);
            const errorMessage =
                err instanceof Error && err.message
                    ? err.message
                    : 'Không thể kết nối. Vui lòng thử lại.';
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId
                        ? { ...m, content: errorMessage, isStreaming: false }
                        : m,
                ),
            );
        } finally {
            setIsSending(false);
            setActiveToolName(null);
            abortRef.current = null;
        }
    }, [activeConversation, isSending, prefix, isGuest, onAction]);

    const stopStreaming = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    return {
        conversations,
        activeConversation,
        messages,
        isLoading,
        isSending,
        activeToolName,
        loadConversations,
        createConversation,
        loadConversation,
        deleteConversation,
        sendMessage,
        stopStreaming,
        setActiveConversation,
    };
}
