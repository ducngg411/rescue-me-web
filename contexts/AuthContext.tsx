'use client';

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    User as FirebaseUser,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
} from "firebase/auth";

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "../lib/firebase/client";
import { db } from "../lib/firebase/client";

// Custom User type for the application
interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: 'user' | 'provider' | 'admin' | null;
    profileCompleted: boolean;
    photoURL?: string | null;
    phoneNumber?: string | null;
    vehicleType?: 'CAR' | 'TRUCK' | 'MOTORCYCLE' | null;
    licensePlate?: string | null;
    vehicleColor?: string | null;
}

interface AuthContextType {
    user: User | null;
    firebaseUser: FirebaseUser | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, displayName: string, phoneNumber?: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>;
    updateUserRole: (role: 'user' | 'provider') => Promise<void>;
    completeUserProfile: (
        phoneNumber: string,
        vehicleType?: 'CAR' | 'TRUCK' | 'MOTORCYCLE',
        licensePlate?: string,
        vehicleColor?: string
    ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch user data from Firestore
    const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                return {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || userData.displayName || null,
                    role: userData.role || null,
                    profileCompleted: userData.profileCompleted || false,
                    photoURL: firebaseUser.photoURL || userData.photoURL || null,
                    phoneNumber: userData.phoneNumber || null,
                    vehicleType: userData.vehicleType || null,
                    licensePlate: userData.licensePlate || null,
                    vehicleColor: userData.vehicleColor || null,
                };
            } else {
                // Create a default user document if it doesn't exist
                const newUserData = {
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    role: null,
                    profileCompleted: false,
                    photoURL: firebaseUser.photoURL,
                    phoneNumber: null,
                    vehicleType: null,
                    licensePlate: null,
                    vehicleColor: null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                await setDoc(userDocRef, newUserData);

                return {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    role: null,
                    profileCompleted: false,
                    photoURL: firebaseUser.photoURL,
                    phoneNumber: null,
                    vehicleType: null,
                    licensePlate: null,
                    vehicleColor: null,
                };
            }
        } catch (err) {
            console.error('Error fetching user data:', err);
            return null;
        }
    };

    // Listen to auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            if (firebaseUser) {
                setFirebaseUser(firebaseUser);
                const userData = await fetchUserData(firebaseUser);
                setUser(userData);
            } else {
                setFirebaseUser(null);
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Login with email and password
    const login = async (email: string, password: string) => {
        try {
            setError(null);
            setLoading(true);
            await signInWithEmailAndPassword(auth, email, password);
            // The onAuthStateChanged listener will handle setting the user
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to login';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Register with email and password
    const register = async (
        email: string,
        password: string,
        displayName: string,
    ) => {
        try {
            setError(null);
            setLoading(true);

            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            // Update display name
            await updateProfile(firebaseUser, { displayName });

            // Create user document in Firestore
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            await setDoc(userDocRef, {
                email,
                displayName,
                role: null,
                profileCompleted: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Manually fetch and set user data to trigger redirect immediately
            const userData = await fetchUserData(firebaseUser);
            setUser(userData);
            setFirebaseUser(firebaseUser);
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to register';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Login with Google
    const loginWithGoogle = async () => {
        try {
            setError(null);
            setLoading(true);
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            // The onAuthStateChanged listener will handle setting the user
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to login with Google';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Logout
    const logout = async () => {
        try {
            setError(null);
            await signOut(auth);
            setUser(null);
            setFirebaseUser(null);
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to logout';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    // Reset password
    const resetPassword = async (email: string) => {
        try {
            setError(null);
            await sendPasswordResetEmail(auth, email);
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to send password reset email';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    // Update user profile
    const updateUserProfile = async (displayName: string, photoURL?: string) => {
        try {
            setError(null);
            if (!firebaseUser) {
                throw new Error('No user logged in');
            }

            // Update Firebase Auth profile
            await updateProfile(firebaseUser, {
                displayName,
                ...(photoURL && { photoURL }),
            });

            // Update Firestore document
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            await setDoc(
                userDocRef,
                {
                    displayName,
                    ...(photoURL && { photoURL }),
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );

            // Update local user state
            if (user) {
                setUser({
                    ...user,
                    displayName,
                    ...(photoURL && { photoURL }),
                });
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to update profile';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    // Update user role
    const updateUserRole = async (role: 'user' | 'provider') => {
        try {
            setError(null);
            if (!firebaseUser) {
                throw new Error('No user logged in');
            }

            // Update Firestore document
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            await setDoc(
                userDocRef,
                {
                    role,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );

            // Update local user state
            if (user) {
                setUser({
                    ...user,
                    role,
                });
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to update role';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const completeUserProfile = async (
        phoneNumber: string,
        vehicleType?: 'CAR' | 'TRUCK' | 'MOTORCYCLE',
        licensePlate?: string,
        vehicleColor?: string
    ) => {
        try {
            setError(null);

            if (!firebaseUser) {
                throw new Error('No user logged in');
            }

            if (!user) {
                throw new Error('User data not found');
            }

            // Prepare update data
            const updateData: any = {
                phoneNumber,
                profileCompleted: true,
                updatedAt: serverTimestamp(),
            };

            // Add vehicle info if provided (for users)
            if (vehicleType) {
                updateData.vehicleType = vehicleType;
            }
            if (licensePlate) {
                updateData.licensePlate = licensePlate.toUpperCase();
            }
            if (vehicleColor) {
                updateData.vehicleColor = vehicleColor;
            }

            // Update Firestore
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            await setDoc(userDocRef, updateData, { merge: true });

            // Update local user state
            setUser({
                ...user,
                phoneNumber,
                vehicleType: vehicleType || user.vehicleType,
                licensePlate: licensePlate || user.licensePlate,
                vehicleColor: vehicleColor || user.vehicleColor,
                profileCompleted: true,
            });

            console.log('Profile completed successfully');
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to complete profile';
            setError(errorMessage);
            console.error('Error completing profile:', err);
            throw new Error(errorMessage);
        }
    }

    const value: AuthContextType = {
        user,
        firebaseUser,
        loading,
        error,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
        updateUserProfile,
        updateUserRole,
        completeUserProfile
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}