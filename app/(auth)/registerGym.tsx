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

// ─── Days of week ───────────────────────────────────────────────────────────
const DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
] as const;
type Day = typeof DAYS[number];

// ─── Built-in services & courts ────────────────────────────────────────────
const BUILT_IN_SERVICES = [
    { key: 'trainer', label: 'Personal Training' },
    { key: 'massage', label: 'Massage Therapy' },
] as const;

const INITIAL_COURTS = [
    { key: 'basketball', label: 'Basketball Courts' },
    { key: 'pickleball', label: 'Pickleball Courts' },
    { key: 'racquetball', label: 'Racquetball Courts' },
] as const;

// ─── Reusable row ──────────────────────────────────────────────────────────
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

    // ─── Basic info ────────────────────────────────────────────────────────────
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [pw, setPw] = useState('');

    // ─── Business hours ────────────────────────────────────────────────────────
    const [hours, setHours] = useState<Record<Day, { open: string; close: string }>>(
        DAYS.reduce((acc, d) => ({ ...acc, [d]: { open: '', close: '' } }), {} as any)
    );

    // ─── Services ──────────────────────────────────────────────────────────────
    const [serviceTypes, setServiceTypes] = useState<{ key: string; label: string }[]>(
        BUILT_IN_SERVICES.map(s => ({ key: s.key, label: s.label }))
    );
    const [services, setServices] = useState<string[]>([]);
    const [newServiceLabel, setNewServiceLabel] = useState('');

    // ─── Courts ────────────────────────────────────────────────────────────────
    const [courtTypes, setCourtTypes] = useState<{ key: string; label: string }[]>(
        INITIAL_COURTS.map(c => ({ key: c.key, label: c.label }))
    );
    const [courts, setCourts] = useState<Record<string, string>>(
        INITIAL_COURTS.reduce((acc, c) => ({ ...acc, [c.key]: '0' }), {} as any)
    );
    const [newCourtLabel, setNewCourtLabel] = useState('');

    // ─── Staff Roles ───────────────────────────────────────────────────────────
    const [roleTypes, setRoleTypes] = useState<{ key: string; label: string }[]>([]);
    const [newRoleLabel, setNewRoleLabel] = useState('');

    // ─── Time picker ───────────────────────────────────────────────────────────
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerDay, setPickerDay] = useState<Day>(DAYS[0]);
    const [pickerMode, setPickerMode] = useState<'open' | 'close'>('open');
    const [tempTime, setTempTime] = useState(new Date());

    const valid = () => !!name && !!email && !!phone && pw.length >= 6;

    function openPicker(day: Day, mode: 'open' | 'close') {
        setPickerDay(day);
        setPickerMode(mode);
        const existing = hours[day][mode];
        setTempTime(
            existing
                ? new Date(`1970-01-01T${existing}:00`)
                : new Date()
        );
        setPickerVisible(true);
    }
    const onTimeChange = (_: any, sel?: Date) => sel && setTempTime(sel);
    const cancelPicker = () => setPickerVisible(false);
    const confirmPicker = () => {
        const hh = tempTime.getHours().toString().padStart(2, '0');
        const mm = tempTime.getMinutes().toString().padStart(2, '0');
        setHours(h => ({
            ...h,
            [pickerDay]: { ...h[pickerDay], [pickerMode]: `${hh}:${mm}` }
        }));
        setPickerVisible(false);
    };

    // ─── Services logic ────────────────────────────────────────────────────────
    const toggleService = (key: string) =>
        setServices(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key]);

    function addServiceType() {
        const label = newServiceLabel.trim();
        if (!label) return Alert.alert('Enter a service name first');
        const key = label.toLowerCase().replace(/\s+/g, '_');
        if (serviceTypes.some(s => s.key === key)) {
            return Alert.alert('That service already exists');
        }
        setServiceTypes(st => [...st, { key, label }]);
        setNewServiceLabel('');
    }

    // ─── Courts logic ─────────────────────────────────────────────────────────
    function addCourtType() {
        const label = newCourtLabel.trim();
        if (!label) return Alert.alert('Enter a court name first');
        const key = label.toLowerCase().replace(/\s+/g, '_');
        if (courtTypes.some(c => c.key === key)) {
            return Alert.alert('That court type already exists');
        }
        setCourtTypes(ct => [...ct, { key, label }]);
        setCourts(c => ({ ...c, [key]: '0' }));
        setNewCourtLabel('');
    }

    // ─── Roles logic ──────────────────────────────────────────────────────────
    function addRoleType() {
        const label = newRoleLabel.trim();
        if (!label) return Alert.alert('Enter a role name first');
        const key = label.toLowerCase().replace(/\s+/g, '_');
        if (roleTypes.some(r => r.key === key)) {
            return Alert.alert('That role already exists');
        }
        setRoleTypes(r => [...r, { key, label }]);
        setNewRoleLabel('');
    }

    // ─── Submit everything ────────────────────────────────────────────────────
    async function submit() {
        if (!valid()) {
            Alert.alert('All fields + password ≥ 6 required.');
            return;
        }
        setBusy(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
            await updateProfile(cred.user, { displayName: name });
            const uid = cred.user.uid;

            // 1️⃣ user doc
            await setDoc(doc(db, 'users', uid), {
                uid,
                role: 'business',
                email: email.trim(),
                phone,
                createdAt: serverTimestamp()
            }, { merge: true });

            // 2️⃣ gym doc
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
                roles: roleTypes,           // ← new roles array
                createdAt: serverTimestamp(),
            });

            // 3️⃣ link user → gym
            await updateDoc(doc(db, 'users', uid), {
                gymId: gymRef.id,
                gymName: name
            });

            router.replace('/dashboard');
        } catch (e: any) {
            Alert.alert('Error', e.message);
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

                    {/* Basic */}
                    <Row icon="office-building-marker" placeholder="Gym Name" value={name} onChangeText={setName} />
                    <Row icon="email-outline" placeholder="Business Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                    <Row icon="phone" placeholder="Phone Number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                    <Row icon="lock-outline" placeholder="Password" secureTextEntry value={pw} onChangeText={setPw} />

                    {/* Hours */}
                    <Text style={styles.sectionTitle}>Business Hours</Text>
                    {DAYS.map(d => (
                        <View key={d} style={styles.hoursRow}>
                            <Text style={styles.dayLabel}>{d.slice(0, 3)}</Text>
                            <Pressable style={styles.timeBtn} onPress={() => openPicker(d, 'open')}>
                                <Text style={styles.timeTxt}>{hours[d].open || '--:--'}</Text>
                            </Pressable>
                            <Pressable style={styles.timeBtn} onPress={() => openPicker(d, 'close')}>
                                <Text style={styles.timeTxt}>{hours[d].close || '--:--'}</Text>
                            </Pressable>
                        </View>
                    ))}

                    {/* Services */}
                    <Text style={styles.sectionTitle}>Services Offered</Text>
                    <View style={styles.addRow}>
                        <TextInput
                            style={styles.newInput}
                            placeholder="New service"
                            placeholderTextColor="#ccc"
                            value={newServiceLabel}
                            onChangeText={setNewServiceLabel}
                        />
                        <Pressable style={styles.addBtn} onPress={addServiceType}>
                            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                        </Pressable>
                    </View>
                    <View style={styles.servicesRow}>
                        {serviceTypes.map(s => (
                            <Pressable
                                key={s.key}
                                style={[styles.serviceBtn, services.includes(s.key) && styles.serviceOn]}
                                onPress={() => toggleService(s.key)}
                            >
                                <Text style={[styles.serviceTxt, services.includes(s.key) && styles.serviceTxtOn]}>
                                    {s.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Courts */}
                    <Text style={styles.sectionTitle}>Courts Available</Text>
                    <View style={styles.addRow}>
                        <TextInput
                            style={styles.newInput}
                            placeholder="New court type"
                            placeholderTextColor="#ccc"
                            value={newCourtLabel}
                            onChangeText={setNewCourtLabel}
                        />
                        <Pressable style={styles.addBtn} onPress={addCourtType}>
                            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                        </Pressable>
                    </View>
                    {courtTypes.map(c => (
                        <View key={c.key} style={styles.courtRow}>
                            <Text style={styles.dayLabel}>{c.label}</Text>
                            <Picker
                                selectedValue={courts[c.key]}
                                onValueChange={v => setCourts(q => ({ ...q, [c.key]: v.toString() }))}
                                style={styles.courtPicker}
                            >
                                {Array.from({ length: 11 }, (_, i) => (<Picker.Item key={i} label={`${i}`} value={`${i}`} />))}
                            </Picker>
                        </View>
                    ))}

                    {/* Staff Roles */}
                    <Text style={styles.sectionTitle}>Staff Roles</Text>
                    <View style={styles.addRow}>
                        <TextInput
                            style={styles.newInput}
                            placeholder="New role"
                            placeholderTextColor="#ccc"
                            value={newRoleLabel}
                            onChangeText={setNewRoleLabel}
                        />
                        <Pressable style={styles.addBtn} onPress={addRoleType}>
                            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                        </Pressable>
                    </View>
                    <View style={styles.rolesRow}>
                        {roleTypes.map(r => (
                            <View key={r.key} style={styles.roleBadge}>
                                <Text style={styles.roleBadgeTxt}>{r.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Time‐picker modal */}
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
                                        <Pressable style={styles.pickerActionBtn} onPress={cancelPicker}>
                                            <Text style={styles.pickerActionTxt}>Cancel</Text>
                                        </Pressable>
                                        <Pressable style={styles.pickerActionBtn} onPress={confirmPicker}>
                                            <Text style={styles.pickerActionTxt}>Confirm</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        </Modal>
                    )}

                    {/* Submit */}
                    <Pressable
                        style={[styles.btn, busy && { opacity: 0.5 }]}
                        onPress={submit}
                        disabled={busy}
                        android_ripple={{ color: '#ffffff22' }}
                    >
                        {busy
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnTxt}>Sign Up</Text>
                        }
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

    title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 24, textAlign: 'center' },

    row: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 18, paddingHorizontal: 16,
        marginBottom: 16, height: 48
    },
    input: { flex: 1, color: '#fff', marginLeft: 8, fontSize: 16 },

    sectionTitle: { color: '#e0e7ff', fontSize: 16, fontWeight: '600', marginVertical: 12 },

    /** Hours **/
    hoursRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    dayLabel: { width: 80, color: '#fff', fontWeight: '600' },
    timeBtn: {
        flex: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8, justifyContent: 'center', marginHorizontal: 4
    },
    timeTxt: { color: '#fff', textAlign: 'center' },

    /** Add‐row **/
    addRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    newInput: {
        flex: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8, paddingHorizontal: 8, color: '#fff'
    },
    addBtn: { marginLeft: 8, backgroundColor: PRIMARY, padding: 8, borderRadius: 8 },

    /** Services **/
    servicesRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
    serviceBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, margin: 4
    },
    serviceOn: { backgroundColor: PRIMARY },
    serviceTxt: { color: '#fff' },
    serviceTxtOn: { color: '#fff', fontWeight: '600' },

    /** Courts **/
    courtRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    courtPicker: {
        flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8, color: '#fff'
    },

    /** Roles **/
    rolesRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
    roleBadge: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, margin: 4
    },
    roleBadgeTxt: { color: '#fff', fontWeight: '600' },

    /** Modal **/
    modalOverlay: {
        ...StyleSheet.absoluteFillObject, backgroundColor: '#0008',
        justifyContent: 'center', alignItems: 'center'
    },
    pickerModal: { width: '80%', backgroundColor: '#312e81', borderRadius: 12, overflow: 'hidden' },
    pickerActions: { flexDirection: 'row', backgroundColor: '#1f1f2e' },
    pickerActionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    pickerActionTxt: { color: '#fff', fontWeight: '600' },

    /** Submit **/
    btn: {
        backgroundColor: PRIMARY, borderRadius: 18, paddingVertical: 14,
        alignItems: 'center', marginTop: 16, marginBottom: 4
    },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
    alt: { textAlign: 'center', color: '#d1d5db', marginTop: 8 },
});
