/* ────────────────────────────────────────────────────────────────
   Register member (with avatar picker & gym selector)
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
    Image,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';          // ← modular helper

import { useAuth } from '../../context/AuthContext';
import { db, auth, storage } from '../../lib/firebaseConfig';
import AuthCard from '../../ui/AuthCard';

/* ──────────────────────────────────────────────────────────────── */
/* Avatar picker */
const AvatarPicker = ({
    avatarUri,
    onPick,
}: {
    avatarUri: string | null;
    onPick: () => void;
}) => (
    <Pressable onPress={onPick} style={{ alignSelf: 'center' }}>
        {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <MaterialCommunityIcons name="account" size={64} color="#94a3b8" />
            </View>
        )}
        <View style={styles.cameraBadge}>
            <MaterialCommunityIcons name="camera" size={20} color="#fff" />
        </View>
    </Pressable>
);

/* Text-input row */
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

/* Gym picker row */
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
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    /* gyms */
    const [gyms, setGyms] = useState<{ id: string; name: string }[]>([]);
    const [gymId, setGymId] = useState('');
    const [loadingGyms, setLoadingGyms] = useState(true);

    /* fetch gyms */
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
        !!gymId &&
        !!avatarUri;

    /* pick avatar */
    async function pickAvatar() {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.75,
        });
        if (!res.canceled) setAvatarUri(res.assets[0].uri);
    }

    /* upload avatar & return URL */
    async function uploadAvatar(uid: string, uri: string): Promise<string> {
        const blob = await (await fetch(uri)).blob();
        const fileRef = ref(storage, `avatars/${uid}`);
        await uploadBytes(fileRef, blob);
        return await getDownloadURL(fileRef);
    }

    /* submit */
    async function handleRegister() {
        if (!isValid) {
            Alert.alert('Please complete every field (avatar required).');
            return;
        }
        setBusy(true);
        try {
            /* create auth account */
            await register(username, email.trim(), pw);
            const uid = auth.currentUser!.uid;

            /* upload avatar */
            const photoURL = await uploadAvatar(uid, avatarUri!);

            /* save extra profile info in Firestore */
            await setDoc(
                doc(db, 'users', uid),
                {
                    height: toNum(height),
                    weight: toNum(weight),
                    gymId,
                    photoURL,
                    updatedAt: serverTimestamp(),
                },
                { merge: true },
            );

            /* save photoURL on Auth user */
            await updateProfile(auth.currentUser!, { photoURL });   // ← fixed

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

                    <AvatarPicker avatarUri={avatarUri} onPick={pickAvatar} />

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
    bg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    center: { width: '100%' },

    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 24,
        textAlign: 'center',
    },

    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.45)',
        marginBottom: 16,
    },
    avatarPlaceholder: {
        backgroundColor: '#475569',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: PRIMARY,
        borderRadius: 12,
        padding: 4,
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

    btn: {
        backgroundColor: PRIMARY,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },

    switchTxt: { textAlign: 'center', color: '#d1d5db' },
    switchLink: { color: '#fff', fontWeight: '600' },
    alt: { textAlign: 'center', color: '#d1d5db', marginBottom: 4 },
});
