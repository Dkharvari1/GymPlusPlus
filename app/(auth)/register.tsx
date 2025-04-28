/* ────────────────────────────────────────────────────────────────
   app/(auth)/register.tsx
   ─ Register a *member* (not a business owner)
   ─ Keyboard stays open while typing (Row is memoised + extracted)
   ─ Gym picker fits inside its own bar and never overlaps UI
   ──────────────────────────────────────────────────────────────── */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    serverTimestamp,
} from 'firebase/firestore';

import { useAuth } from '../../context/AuthContext';
import { db, auth } from '../../lib/firebaseConfig';
import AuthCard from '../../ui/AuthCard';

/* ──────────────────────────────────────────────────────────────── */
/* 🔸 Text-input row (memoised)                                    */
const Row = React.memo(
    ({
        icon,
        value,
        onChangeText,
        placeholder,
        keyboardType,
        secureTextEntry,
    }: {
        icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
        value: string;
        onChangeText: (t: string) => void;
        placeholder: string;
        keyboardType?: 'default' | 'numeric' | 'email-address';
        secureTextEntry?: boolean;
    }) => (
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
                autoCapitalize="none"
            />
        </View>
    ),
);

/* 🔸 Gym-picker row (memoised)                                    */
const GymPickerRow = React.memo(
    ({
        gyms,
        gymId,
        setGymId,
        loading,
    }: {
        gyms: { id: string; name: string }[];
        gymId: string;
        setGymId: (v: string) => void;
        loading: boolean;
    }) => (
        <View style={styles.rowPicker}>
            <MaterialCommunityIcons name="dumbbell" size={22} color="#6b7280" />
            {loading ? (
                <ActivityIndicator style={{ flex: 1 }} color="#fff" />
            ) : (
                <Picker
                    selectedValue={gymId}
                    onValueChange={setGymId}
                    style={styles.picker}
                    dropdownIconColor="#fff"
                    itemStyle={{ color: '#fff' }}
                    mode={Platform.OS === 'ios' ? 'dialog' : 'dropdown'}
                >
                    <Picker.Item label="Select Gym" value="" color="#9ca3af" />
                    {gyms.map(g => (
                        <Picker.Item key={g.id} label={g.name} value={g.id} color="#fff" />
                    ))}
                </Picker>
            )}
        </View>
    ),
);

/* ──────────────────────────────────────────────────────────────── */
export default function RegisterMember() {
    const router = useRouter();
    const { register } = useAuth();

    /* form state */
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [pw, setPw] = useState('');
    const [busy, setBusy] = useState(false);

    /* gyms */
    const [gyms, setGyms] = useState<{ id: string; name: string }[]>([]);
    const [gymId, setGymId] = useState('');
    const [loadingGyms, setLoadingGyms] = useState(true);

    /* fetch gyms once */
    useEffect(() => {
        (async () => {
            const snap = await getDocs(collection(db, 'gyms'));
            setGyms(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name })));
            setLoadingGyms(false);
        })();
    }, []);

    /* helpers */
    const toNum = (v: string) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const isValid =
        !!username &&
        !!email &&
        pw.length >= 6 &&
        toNum(height) !== null &&
        toNum(weight) !== null &&
        !!gymId;

    /* submit */
    async function handleRegister() {
        if (!isValid) {
            Alert.alert('Please fill every field (password ≥ 6 characters).');
            return;
        }
        setBusy(true);
        try {
            /* auth */
            await register(username, email.trim(), pw);

            /* user profile */
            const uid = auth.currentUser!.uid;
            await setDoc(
                doc(db, 'users', uid),
                {
                    height: toNum(height),
                    weight: toNum(weight),
                    gymId,
                    updatedAt: serverTimestamp(),
                },
                { merge: true },
            );

            router.replace('/(tabs)');
        } catch (err: any) {
            Alert.alert('Registration failed', err.message);
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
                    <Text style={styles.title}>Create Account</Text>

                    <Row
                        icon="account-outline"
                        placeholder="Username"
                        value={username}
                        onChangeText={setUsername}
                    />
                    <Row
                        icon="email-outline"
                        placeholder="Email"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <Row
                        icon="human-male-height"
                        placeholder="Height (cm)"
                        keyboardType="numeric"
                        value={height}
                        onChangeText={setHeight}
                    />
                    <Row
                        icon="scale-bathroom"
                        placeholder="Weight (kg)"
                        keyboardType="numeric"
                        value={weight}
                        onChangeText={setWeight}
                    />
                    <Row
                        icon="lock-outline"
                        placeholder="Password"
                        secureTextEntry
                        value={pw}
                        onChangeText={setPw}
                    />

                    <GymPickerRow
                        gyms={gyms}
                        gymId={gymId}
                        setGymId={setGymId}
                        loading={loadingGyms}
                    />

                    <Pressable
                        style={[styles.btn, (!isValid || busy) && { opacity: 0.5 }]}
                        onPress={handleRegister}
                        disabled={!isValid || busy}
                        android_ripple={{ color: '#ffffff22' }}
                    >
                        {busy ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnTxt}>Sign Up</Text>
                        )}
                    </Pressable>

                    <Text style={styles.switchTxt}>
                        Already have an account?
                        <Text
                            style={styles.switchLink}
                            onPress={() => router.push('/login')}
                        >
                            {' '}Log in
                        </Text>
                    </Text>

                    <Pressable onPress={() => router.push('/(auth)/registerGym')}>
                        <Text style={styles.alt}>Own a gym? Register your business</Text>
                    </Pressable>
                </AuthCard>
            </View>
        </LinearGradient>
    );
}

/* ──────────────────────────────────────────────────────────────── */
const PRIMARY = '#4f46e5';

const styles = StyleSheet.create({
    /* layout */
    bg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    center: { width: '100%' },

    /* text */
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 24,
        textAlign: 'center',
    },

    /* shared row */
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 18,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    /* text input inside row */
    input: {
        flex: 1,
        height: 48,
        color: '#fff',
        marginLeft: 8,
        fontSize: 16,
    },

    /* picker row (fixed height + clipping) */
    rowPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 18,
        paddingHorizontal: 16,
        marginBottom: 16,
        height: 48,
        overflow: 'hidden',
    },
    picker: {
        flex: 1,
        color: '#fff',
    },

    /* button */
    btn: {
        backgroundColor: PRIMARY,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },

    /* footer links */
    switchTxt: { textAlign: 'center', color: '#d1d5db' },
    switchLink: { color: '#fff', fontWeight: '600' },
    alt: { textAlign: 'center', color: '#d1d5db', marginBottom: 4 },
});
