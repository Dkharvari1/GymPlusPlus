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
    ScrollView,
    Platform,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
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

const DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

const SERVICES = [
    { key: 'trainer', label: 'Personal Training' },
    { key: 'massage', label: 'Massage Therapy' },
];

const COURT_TYPES = [
    { key: 'basketball', label: 'Basketball Courts' },
    { key: 'pickleball', label: 'Pickleball Courts' },
    { key: 'racquetball', label: 'Racquetball Courts' },
];

// 🔸 Row (memoised)
type RowProps = {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    placeholder: string;
    value: string;
    onChangeText: (t: string) => void;
    keyboardType?: 'default' | 'email-address' | 'phone-pad';
    secureTextEntry?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};
const Row = React.memo(({
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
));

export default function RegisterGym() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    /* basic info */
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [pw, setPw] = useState('');

    /* hours state */
    const [hours, setHours] = useState(
        DAYS.reduce(
            (acc, d) => ({ ...acc, [d]: { open: '', close: '' } }),
            {} as Record<string, { open: string; close: string }>
        )
    );

    /* services */
    const [services, setServices] = useState<string[]>([]);

    /* courts */
    const [courts, setCourts] = useState(
        COURT_TYPES.reduce((acc, c) => ({ ...acc, [c.key]: '0' }), {} as Record<string, string>)
    );

    /* picker control */
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerDay, setPickerDay] = useState<string>(DAYS[0]);
    const [pickerMode, setPickerMode] = useState<'open' | 'close'>('open');
    const [tempTime, setTempTime] = useState(new Date());

    const valid = () => name && email && phone && pw.length >= 6;

    /* show the time picker */
    const openPicker = (day: string, mode: 'open' | 'close') => {
        setPickerDay(day);
        setPickerMode(mode);
        const existing = hours[day][mode];
        setTempTime(
            existing
                ? new Date(`1970-01-01T${existing}:00`)
                : new Date()
        );
        setPickerVisible(true);
    };

    /* time spin */
    const onTimeChange = (_: any, selected?: Date) => {
        if (selected) setTempTime(selected);
    };

    const cancelPicker = () => setPickerVisible(false);

    const confirmPicker = () => {
        const hh = tempTime.getHours().toString().padStart(2, '0');
        const mm = tempTime.getMinutes().toString().padStart(2, '0');
        setHours(h => ({
            ...h,
            [pickerDay]: { ...h[pickerDay], [pickerMode]: `${hh}:${mm}` },
        }));
        setPickerVisible(false);
    };

    /* toggle service */
    const toggleService = (key: string) => {
        setServices(s =>
            s.includes(key) ? s.filter(x => x !== key) : [...s, key]
        );
    };

    /* submit */
    async function submit() {
        if (!valid()) {
            Alert.alert('All fields + password≥6 required.');
            return;
        }
        setBusy(true);
        try {
            // 1️⃣ auth
            const cred = await createUserWithEmailAndPassword(
                auth,
                email.trim(),
                pw
            );
            await updateProfile(cred.user, { displayName: name });
            const uid = cred.user.uid;

            // 2️⃣ user doc
            await setDoc(
                doc(db, 'users', uid),
                {
                    uid,
                    role: 'business',
                    email: email.trim(),
                    phone,
                    createdAt: serverTimestamp(),
                },
                { merge: true }
            );

            // 3️⃣ gym doc
            const gymRef = await addDoc(collection(db, 'gyms'), {
                name,
                ownerUid: uid,
                email: email.trim(),
                phone,
                hours,
                services,
                courts: Object.fromEntries(
                    Object.entries(courts).map(([k, v]) => [k, Number(v) || 0])
                ),
                createdAt: serverTimestamp(),
            });

            // 4️⃣ link
            await updateDoc(doc(db, 'users', uid), {
                gymId: gymRef.id,
                gymName: name,
            });

            router.replace('/dashboard');
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <LinearGradient
            colors={['#312e81', '#4f46e5', '#7c3aed']}
            style={styles.bg}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
        >
            <ScrollView contentContainerStyle={styles.center}>
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

                    {/* ─── Hours ─── */}
                    <Text style={styles.sectionTitle}>Business Hours</Text>
                    {DAYS.map(day => (
                        <View key={day} style={styles.hoursRow}>
                            <Text style={styles.dayLabel}>{day.slice(0, 3)}</Text>
                            <Pressable
                                style={styles.timeBtn}
                                onPress={() => openPicker(day, 'open')}
                            >
                                <Text style={styles.timeTxt}>
                                    {hours[day].open || '--:--'}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={styles.timeBtn}
                                onPress={() => openPicker(day, 'close')}
                            >
                                <Text style={styles.timeTxt}>
                                    {hours[day].close || '--:--'}
                                </Text>
                            </Pressable>
                        </View>
                    ))}

                    {/* ─── Services ─── */}
                    <Text style={styles.sectionTitle}>Services Offered</Text>
                    <View style={styles.servicesRow}>
                        {SERVICES.map(s => {
                            const on = services.includes(s.key);
                            return (
                                <Pressable
                                    key={s.key}
                                    style={[styles.serviceBtn, on && styles.serviceOn]}
                                    onPress={() => toggleService(s.key)}
                                >
                                    <Text style={[styles.serviceTxt, on && styles.serviceTxtOn]}>
                                        {s.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* ─── Courts ─── */}
                    <Text style={styles.sectionTitle}>Courts Available</Text>
                    {COURT_TYPES.map(c => (
                        <View key={c.key} style={styles.courtRow}>
                            <Text style={styles.dayLabel}>{c.label}</Text>
                            <Picker
                                selectedValue={courts[c.key]}
                                onValueChange={v =>
                                    setCourts(q => ({ ...q, [c.key]: v.toString() }))
                                }
                                style={styles.courtPicker}
                            >
                                {Array.from({ length: 11 }, (_, i) => (
                                    <Picker.Item key={i} label={`${i}`} value={`${i}`} />
                                ))}
                            </Picker>
                        </View>
                    ))}

                    {/* time picker modal */}
                    {pickerVisible && (
                        <Modal transparent animationType="fade">
                            <View style={styles.modalOverlay}>
                                <View style={styles.pickerModal}>
                                    <DateTimePicker
                                        value={tempTime}
                                        mode="time"
                                        is24Hour
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={onTimeChange}
                                        style={{ width: '100%' }}
                                    />
                                    <View style={styles.pickerActions}>
                                        <Pressable
                                            style={styles.pickerActionBtn}
                                            onPress={cancelPicker}
                                        >
                                            <Text style={styles.pickerActionTxt}>Cancel</Text>
                                        </Pressable>
                                        <Pressable
                                            style={styles.pickerActionBtn}
                                            onPress={confirmPicker}
                                        >
                                            <Text style={styles.pickerActionTxt}>Confirm</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        </Modal>
                    )}

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
            </ScrollView>
        </LinearGradient>
    );
}

const PRIMARY = '#4f46e5';

const styles = StyleSheet.create({
    bg: { flex: 1 },
    center: { padding: 24, paddingTop: 40, paddingBottom: 80 },
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
        height: 48,
    },
    input: {
        flex: 1,
        color: '#fff',
        marginLeft: 8,
        fontSize: 16,
    },
    btn: {
        backgroundColor: PRIMARY,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 4,
    },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
    alt: { textAlign: 'center', color: '#d1d5db', marginTop: 8 },

    sectionTitle: {
        color: '#e0e7ff',
        fontSize: 16,
        fontWeight: '600',
        marginVertical: 12,
    },

    // Hours
    hoursRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    dayLabel: {
        width: 80,
        color: '#fff',
        fontWeight: '600',
    },
    timeBtn: {
        flex: 1,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        justifyContent: 'center',
        marginHorizontal: 4,
    },
    timeTxt: { color: '#fff', textAlign: 'center' },

    // Services
    servicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    serviceBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        margin: 4,
    },
    serviceOn: {
        backgroundColor: PRIMARY,
    },
    serviceTxt: {
        color: '#fff',
    },
    serviceTxtOn: {
        color: '#fff',
        fontWeight: '600',
    },

    // Courts
    courtRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    courtPicker: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        color: '#fff',
    },

    // Picker Modal
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0008',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerModal: {
        width: '80%',
        backgroundColor: '#312e81',
        borderRadius: 12,
        overflow: 'hidden',
    },
    pickerActions: {
        flexDirection: 'row',
        backgroundColor: '#1f1f2e',
    },
    pickerActionBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    pickerActionTxt: {
        color: '#fff',
        fontWeight: '600',
    },
});
