// app/(auth)/registerGym.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    createUserWithEmailAndPassword,
    updateProfile,
} from 'firebase/auth';
import {
    collection,
    addDoc,
    doc,
    setDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { auth, db } from '../../lib/firebaseConfig';
import AuthCard from '../../ui/AuthCard';

/* ──────────────────────────────────────────────────────────────── */
/* 🔸 Row (memoised)                                               */
type RowProps = {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    placeholder: string;
    value: string;
    onChangeText: (t: string) => void;
    keyboardType?: 'default' | 'email-address' | 'phone-pad';
    secureTextEntry?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

const Row = React.memo(
    ({
        icon,
        placeholder,
        value,
        onChangeText,
        keyboardType,
        secureTextEntry,
        autoCapitalize,
    }: RowProps) => (
        <View style={styles.row}>
            <MaterialCommunityIcons name={icon} size={22} color="#6b7280" />
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor="#9ca3af"
                value={value}
                onChangeText={onChangeText}
                keyboardType={keyboardType}
                secureTextEntry={secureTextEntry}
                autoCapitalize={autoCapitalize}
            />
        </View>
    ),
);

/* ──────────────────────────────────────────────────────────────── */
export default function RegisterGym() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    /* form state */
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [pw, setPw] = useState('');

    const valid = () => name && email && phone && pw.length >= 6;

    /* submit handler */
    async function submit() {
        if (!valid()) {
            Alert.alert('Fill every field (password ≥ 6 characters)');
            return;
        }
        setBusy(true);
        try {
            /* 1️⃣ create Firebase Auth user */
            const cred = await createUserWithEmailAndPassword(
                auth,
                email.trim(),
                pw,
            );
            await updateProfile(cred.user, { displayName: name });

            const uid = cred.user.uid;

            /* 2️⃣ create (or merge) user doc with role=business */
            await setDoc(
                doc(db, 'users', uid),
                {
                    uid,
                    role: 'business',
                    email: email.trim(),
                    phone,
                    createdAt: serverTimestamp(),
                },
                { merge: true },
            );

            /* 3️⃣ now, rules see role == "business": add gym doc */
            const gymRef = await addDoc(collection(db, 'gyms'), {
                name,
                ownerUid: uid,
                email: email.trim(),
                phone,
                createdAt: serverTimestamp(),
            });

            /* 4️⃣ update user doc with gymId / gymName (merge) */
            await updateDoc(doc(db, 'users', uid), {
                gymId: gymRef.id,
                gymName: name,
            });

            router.replace('/(tabs)');
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setBusy(false);
        }
    }

    /* render */
    return (
        <LinearGradient
            colors={['#312e81', '#4f46e5', '#7c3aed']}
            style={styles.bg}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
        >
            <View style={styles.center}>
                <AuthCard>
                    <Text style={styles.title}>Register Gym</Text>

                    <Row
                        icon="office-building-marker"
                        placeholder="Gym Name"
                        value={name}
                        onChangeText={setName}
                    />
                    <Row
                        icon="email-outline"
                        placeholder="Business Email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <Row
                        icon="phone"
                        placeholder="Phone Number"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                    />
                    <Row
                        icon="lock-outline"
                        placeholder="Password"
                        secureTextEntry
                        value={pw}
                        onChangeText={setPw}
                    />

                    <Pressable
                        style={[styles.btn, busy && { opacity: 0.5 }]}
                        onPress={submit}
                        disabled={busy}
                        android_ripple={{ color: '#ffffff22' }}
                    >
                        {busy ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnTxt}>Sign Up</Text>
                        )}
                    </Pressable>

                    <Pressable onPress={() => router.push('/(auth)/register')}>
                        <Text style={styles.alt}>Register as Member instead</Text>
                    </Pressable>
                </AuthCard>
            </View>
        </LinearGradient>
    );
}

/* ──────────────────────────────────────────────────────────────── */
const PRIMARY = '#4f46e5';

const styles = StyleSheet.create({
    bg: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', padding: 24 },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 24,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 18,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    input: {
        flex: 1,
        height: 48,
        color: '#fff',
        marginLeft: 8,
        fontSize: 16,
    },
    btn: {
        backgroundColor: PRIMARY,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
    alt: { textAlign: 'center', color: '#d1d5db', marginBottom: 4 },
});
