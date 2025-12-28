import { User } from './types';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile as updateFirebaseProfile,
    sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

export const authService = {
    async login(email: string, password: string): Promise<User> {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Fetch user data from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            throw new Error('User profile not found');
        }

        const userData = userDoc.data();
        return {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || userData.displayName || null,
            role: userData.role || 'user',
            profileCompleted: userData.profileCompleted || false,
            photoURL: firebaseUser.photoURL || userData.photoURL || null,
        };
    },

    async register(
        email: string,
        password: string,
        displayName: string,
        role: 'user' | 'provider'
    ): Promise<User> {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Update Firebase Auth profile
        await updateFirebaseProfile(firebaseUser, { displayName });

        // Create user document in Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userData = {
            email: firebaseUser.email,
            displayName,
            role,
            profileCompleted: false,
            photoURL: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await setDoc(userDocRef, userData);

        return {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName,
            role,
            profileCompleted: false,
            photoURL: null,
        };
    },

    async loginWithGoogle(): Promise<User> {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const firebaseUser = userCredential.user;

        // Check if user exists in Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // Create new user document
            const userData = {
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                role: 'user' as const,
                profileCompleted: false,
                photoURL: firebaseUser.photoURL,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            await setDoc(userDocRef, userData);

            return {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                role: 'user',
                profileCompleted: false,
                photoURL: firebaseUser.photoURL,
            };
        }

        const userData = userDoc.data();
        return {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || userData.displayName || null,
            role: userData.role || 'user',
            profileCompleted: userData.profileCompleted || false,
            photoURL: firebaseUser.photoURL || userData.photoURL || null,
        };
    },

    async logout(): Promise<void> {
        await signOut(auth);
    },

    async getCurrentUser(): Promise<User | null> {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) return null;

        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) return null;

        const userData = userDoc.data();
        return {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || userData.displayName || null,
            role: userData.role || 'user',
            profileCompleted: userData.profileCompleted || false,
            photoURL: firebaseUser.photoURL || userData.photoURL || null,
        };
    },

    async resetPassword(email: string): Promise<void> {
        await sendPasswordResetEmail(auth, email);
    },

    async updateProfile(userId: string, data: Partial<User>): Promise<void> {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });

        // Update Firebase Auth profile if displayName or photoURL changed
        if (auth.currentUser && (data.displayName || data.photoURL)) {
            await updateFirebaseProfile(auth.currentUser, {
                displayName: data.displayName || undefined,
                photoURL: data.photoURL || undefined,
            });
        }
    },
};
