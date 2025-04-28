// context/AuthContext.tsx
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from 'react';
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    updateProfile,
    User,
} from 'firebase/auth';
import { auth, db } from '../lib/firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { View, ActivityIndicator } from 'react-native';

/* ---------- types ---------- */
type AuthContextType = {
    user: User | null;
    loading: boolean;
    register: (username: string, email: string, password: string) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

/* ---------- context ---------- */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ---------- provider ---------- */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    /* listen once */
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return unsub;
    }, []);

    /* helpers */
    async function register(username: string, email: string, password: string) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: username });

        await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            role: 'member',
            username,
            email: email.trim(),
            createdAt: serverTimestamp(),
        });

        setUser(cred.user);
    }

    async function login(email: string, password: string) {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        setUser(cred.user);
    }

    async function logout() {
        await firebaseSignOut(auth);
        setUser(null);
    }

    /* -------- return -------- */
    if (loading) {
        /* ✅ render a VIEW, not a raw string */
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, register, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

/* ---------- hook ---------- */
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
