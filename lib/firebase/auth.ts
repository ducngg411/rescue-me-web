import { auth } from './client';
import { adminAuth, adminDb } from './admin';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    User,
} from 'firebase/auth';

export async function loginUser(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
}

export async function registerUser(
    email: string,
    password: string,
    role: 'user' | 'provider'
): Promise<User> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Set custom claims for role
    await adminAuth.setCustomUserClaims(userCredential.user.uid, { role });

    // Create user document in Firestore
    await adminDb.collection('users').doc(userCredential.user.uid).set({
        email,
        role,
        profileCompleted: false,
        createdAt: new Date(),
    });

    return userCredential.user;
}

export async function logoutUser(): Promise<void> {
    await signOut(auth);
}

export async function getUserProfile(userId: string) {
    const docRef = adminDb.collection('users').doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
        return null;
    }

    return { id: doc.id, ...doc.data() };
}

export async function setUserRole(userId: string, role: 'user' | 'provider') {
    await adminAuth.setCustomUserClaims(userId, { role });
}

export async function verifyIdToken(token: string) {
    try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}
