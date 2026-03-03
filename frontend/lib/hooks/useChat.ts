'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    writeBatch,
    doc,
    getDocs,
    where,
    setDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    senderRole: 'PROVIDER' | 'CUSTOMER';
    senderName: string;
    timestamp: Date;
    read: boolean;
}

interface UseChatOptions {
    requestId: string;
    currentUserId: string;
    currentUserRole: 'PROVIDER' | 'CUSTOMER';
    currentUserName: string;
    /** Set to false to skip subscribing (e.g. when request is in a non-chat state) */
    enabled?: boolean;
}

interface UseChatReturn {
    messages: ChatMessage[];
    unreadCount: number;
    sendMessage: (text: string) => Promise<void>;
    markAsRead: () => Promise<void>;
    isLoading: boolean;
}

export function useChat({
    requestId,
    currentUserId,
    currentUserRole,
    currentUserName,
    enabled = true,
}: UseChatOptions): UseChatReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!enabled || !requestId || !currentUserId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const messagesRef = collection(db, 'chats', requestId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const msgs: ChatMessage[] = snapshot.docs.map((d) => {
                    const data = d.data();
                    return {
                        id: d.id,
                        text: data.text ?? '',
                        senderId: data.senderId ?? '',
                        senderRole: data.senderRole ?? 'CUSTOMER',
                        senderName: data.senderName ?? '',
                        timestamp: data.timestamp instanceof Timestamp
                            ? data.timestamp.toDate()
                            : new Date(),
                        read: data.read ?? false,
                    };
                });
                setMessages(msgs);
                setIsLoading(false);
            },
            (err) => {
                console.error('[useChat] Firestore snapshot error:', err);
                setIsLoading(false);
            }
        );

        unsubscribeRef.current = unsubscribe;
        return () => {
            unsubscribe();
            unsubscribeRef.current = null;
        };
    }, [requestId, currentUserId, enabled]);

    const sendMessage = useCallback(
        async (text: string) => {
            if (!text.trim() || !requestId) return;

            const messagesRef = collection(db, 'chats', requestId, 'messages');
            const chatDocRef = doc(db, 'chats', requestId);

            const msgData = {
                text: text.trim(),
                senderId: currentUserId,
                senderRole: currentUserRole,
                senderName: currentUserName,
                timestamp: serverTimestamp(),
                read: false,
            };

            // Write the message
            await addDoc(messagesRef, msgData);

            // Update top-level chat doc metadata
            await setDoc(
                chatDocRef,
                {
                    lastMessage: text.trim(),
                    lastTimestamp: serverTimestamp(),
                    lastSenderRole: currentUserRole,
                },
                { merge: true }
            );
        },
        [requestId, currentUserId, currentUserRole, currentUserName]
    );

    const markAsRead = useCallback(async () => {
        if (!requestId) return;

        const oppositeRole = currentUserRole === 'PROVIDER' ? 'CUSTOMER' : 'PROVIDER';
        const messagesRef = collection(db, 'chats', requestId, 'messages');

        // Get all unread messages from the OTHER party
        const q = query(
            messagesRef,
            where('senderRole', '==', oppositeRole),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.docs.forEach((d) => {
            batch.update(d.ref, { read: true });
        });
        await batch.commit();
    }, [requestId, currentUserRole]);

    const unreadCount = messages.filter(
        (m) => !m.read && m.senderRole !== currentUserRole
    ).length;

    return { messages, unreadCount, sendMessage, markAsRead, isLoading };
}
