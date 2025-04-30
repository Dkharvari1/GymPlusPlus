// app/(business)/settings.tsx

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ScrollView,
    Alert,
    Modal,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
    query,
    where,
    collection,
    onSnapshot,
    addDoc,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

type Day =
    | 'Sunday'
    | 'Monday'
    | 'Tuesday'
    | 'Wednesday'
    | 'Thursday'
    | 'Friday'
    | 'Saturday';

const DAYS: Day[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

export default function GymSettingsScreen() {
    const router = useRouter();
    const uid = auth.currentUser?.uid ?? '';

    // ─ Gym + User Data ──────────────────────────────────────────────────────
    const [gymId, setGymId] = useState<string | null>(null);
    const [gymData, setGymData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // ─ Basic Info ───────────────────────────────────────────────────────────
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // ─ Business Hours ───────────────────────────────────────────────────────
    const [hours, setHours] = useState<Record<Day, { open: string; close: string }>>(
        DAYS.reduce(
            (acc, d) => ({ ...acc, [d]: { open: '', close: '' } }),
            {} as Record<Day, { open: string; close: string }>
        )
    );
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerDay, setPickerDay] = useState<Day>('Sunday');
    const [pickerMode, setPickerMode] = useState<'open' | 'close'>('open');
    const [tempTime, setTempTime] = useState<Date>(new Date());

    // ─ Staff Roles (custom) ─────────────────────────────────────────────────
    // stored in gymData.roles: string[]
    const [newRoleLabel, setNewRoleLabel] = useState('');
    const [roles, setRoles] = useState<string[]>([]);

    // ─ Staff Members ────────────────────────────────────────────────────────
    interface Trainer { id: string; name: string; role: string }
    const [staffList, setStaffList] = useState<Trainer[]>([]);
    const [showAddStaff, setShowAddStaff] = useState(false);
    const [staffName, setStaffName] = useState('');
    const [staffRole, setStaffRole] = useState('');

    // ─── fetch gymId → gymData ──────────────────────────────────────────────
    useEffect(() => {
        if (!uid) return;
        (async () => {
            try {
                // 1) get user's gymId
                const uSnap = await getDoc(doc(db, 'users', uid));
                if (!uSnap.exists()) throw new Error('User profile missing');
                const gId = (uSnap.data() as any).gymId;
                setGymId(gId);

                // 2) load gym doc
                const gSnap = await getDoc(doc(db, 'gyms', gId));
                if (gSnap.exists()) {
                    const data = gSnap.data();
                    setGymData(data);
                    setName(data.name ?? '');
                    setEmail(data.email ?? '');
                    setPhone(data.phone ?? '');
                    if (data.hours) setHours(data.hours);
                    setRoles(Array.isArray(data.roles) ? data.roles : []);
                }
            } catch (e: any) {
                Alert.alert('Load error', e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [uid]);

    // ─── fetch staff members ────────────────────────────────────────────────
    useEffect(() => {
        if (!gymId) return;
        const q = query(
            collection(db, 'trainers'),
            where('gymId', '==', gymId)
        );
        return onSnapshot(q, snap => {
            setStaffList(
                snap.docs.map(d => ({
                    id: d.id,
                    ...(d.data() as any),
                }))
            );
        });
    }, [gymId]);

    // ─── save gym info + hours + roles ─────────────────────────────────────
    async function handleSave() {
        if (!gymId) return;
        if (!name.trim() || !email.trim() || !phone.trim()) {
            return Alert.alert('All fields required');
        }
        setLoading(true);
        try {
            await updateDoc(doc(db, 'gyms', gymId), {
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                hours,
                roles,
                updatedAt: serverTimestamp(),
            });
            setGymData({ ...gymData, name, email, phone, hours, roles });
            setEditing(false);
            Alert.alert('Saved');
        } catch (e: any) {
            Alert.alert('Save failed', e.message);
        } finally {
            setLoading(false);
        }
    }

    // ─── add a new custom role ─────────────────────────────────────────────
    async function addRole() {
        const label = newRoleLabel.trim();
        if (!label) return Alert.alert('Enter a role name');
        if (roles.includes(label)) return Alert.alert('Role already exists');
        const updated = [...roles, label];
        setRoles(updated);
        setNewRoleLabel('');
        // persist
        if (gymId) {
            await updateDoc(doc(db, 'gyms', gymId), {
                roles: arrayUnion(label),
            });
        }
    }

    // ─── add a new staff member ────────────────────────────────────────────
    async function addStaffMember() {
        if (!gymId) return;
        if (!staffName.trim() || !staffRole) {
            return Alert.alert('Name + role required');
        }
        try {
            await addDoc(collection(db, 'trainers'), {
                gymId,
                name: staffName.trim(),
                role: staffRole,
                createdAt: serverTimestamp(),
            });
            setStaffName('');
            setStaffRole('');
            setShowAddStaff(false);
        } catch (e: any) {
            Alert.alert('Add staff failed', e.message);
        }
    }

    // ─── sign out ──────────────────────────────────────────────────────────
    async function handleSignOut() {
        try {
            await signOut(auth);
            router.replace('/login');
        } catch (e: any) {
            Alert.alert('Sign out failed', e.message);
        }
    }

    // ─── time picker ───────────────────────────────────────────────────────
    function openPicker(day: Day, mode: 'open' | 'close') {
        setPickerDay(day);
        setPickerMode(mode);
        const existing = hours[day][mode];
        setTempTime(
            existing ? new Date(`1970-01-01T${existing}:00`) : new Date()
        );
        setPickerVisible(true);
    }
    function onTimeChange(_: any, d?: Date) {
        if (d) setTempTime(d);
    }
    function cancelPicker() {
        setPickerVisible(false);
    }
    function confirmPicker() {
        const hh = tempTime.getHours().toString().padStart(2, '0');
        const mm = tempTime.getMinutes().toString().padStart(2, '0');
        setHours(h => ({
            ...h,
            [pickerDay]: { ...h[pickerDay], [pickerMode]: `${hh}:${mm}` },
        }));
        setPickerVisible(false);
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    return (
        <LinearGradient
            colors={['#312e81', '#4f46e5', '#7c3aed']}
            style={styles.bg}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Gym Settings</Text>

                {/* ── Basic Info ── */}
                <View style={styles.row}>
                    <MaterialCommunityIcons name="office-building" size={22} color="#6b7280" />
                    {editing ? (
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Gym Name"
                            placeholderTextColor="#9ca3af"
                        />
                    ) : (
                        <Text style={styles.value}>{gymData.name}</Text>
                    )}
                </View>
                <View style={styles.row}>
                    <MaterialCommunityIcons name="email-outline" size={22} color="#6b7280" />
                    {editing ? (
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Email"
                            placeholderTextColor="#9ca3af"
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    ) : (
                        <Text style={styles.value}>{gymData.email}</Text>
                    )}
                </View>
                <View style={styles.row}>
                    <MaterialCommunityIcons name="phone" size={22} color="#6b7280" />
                    {editing ? (
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Phone"
                            placeholderTextColor="#9ca3af"
                            keyboardType="phone-pad"
                        />
                    ) : (
                        <Text style={styles.value}>{gymData.phone}</Text>
                    )}
                </View>

                {/* ── Business Hours ── */}
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

                {/* ── Staff Roles ── */}
                <Text style={styles.sectionTitle}>Staff Roles</Text>
                {roles.map(r => (
                    <Text key={r} style={styles.tag}>{r}</Text>
                ))}
                <View style={styles.newRow}>
                    <TextInput
                        style={styles.newInput}
                        placeholder="New role…"
                        placeholderTextColor="#ccc"
                        value={newRoleLabel}
                        onChangeText={setNewRoleLabel}
                    />
                    <Pressable style={styles.addBtn} onPress={addRole}>
                        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                    </Pressable>
                </View>

                {/* ── Staff Members ── */}
                <View style={styles.staffHeader}>
                    <Text style={styles.sectionTitle}>Staff Members</Text>
                    <Pressable onPress={() => setShowAddStaff(true)}>
                        <MaterialCommunityIcons name="account-plus" size={24} color="#fff" />
                    </Pressable>
                </View>
                {staffList.map(s => (
                    <View key={s.id} style={styles.staffRow}>
                        <Text style={styles.staffName}>{s.name}</Text>
                        <Text style={styles.staffRole}>{s.role}</Text>
                    </View>
                ))}

                {/* ── Edit / Save / Sign Out ── */}
                {editing ? (
                    <Pressable style={styles.btn} onPress={handleSave}>
                        <Text style={styles.btnText}>Save Changes</Text>
                    </Pressable>
                ) : (
                    <Pressable style={styles.btn} onPress={() => setEditing(true)}>
                        <Text style={styles.btnText}>Edit Gym Info</Text>
                    </Pressable>
                )}
                <Pressable style={[styles.btn, styles.logoutBtn]} onPress={handleSignOut}>
                    <MaterialCommunityIcons name="logout" size={20} color="#fff" />
                    <Text style={styles.btnText}>Sign Out</Text>
                </Pressable>
            </ScrollView>

            {/* ── Time Picker Modal ── */}
            <Modal visible={pickerVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.pickerModal}>
                        <DateTimePicker
                            value={tempTime}
                            mode="time"
                            is24Hour
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={onTimeChange}
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

            {/* ── Add Staff Modal ── */}
            <Modal visible={showAddStaff} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>Add Staff Member</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Name"
                            placeholderTextColor="#ccc"
                            value={staffName}
                            onChangeText={setStaffName}
                        />
                        <Text style={styles.modalLabel}>Role</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={staffRole}
                                onValueChange={v => setStaffRole(v)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Select role…" value="" />
                                {roles.map(r => (
                                    <Picker.Item key={r} label={r} value={r} />
                                ))}
                            </Picker>
                        </View>
                        <View style={styles.modalBtns}>
                            <Pressable style={styles.modalBtn} onPress={() => setShowAddStaff(false)}>
                                <Text style={styles.modalBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.modalBtn} onPress={addStaffMember}>
                                <Text style={styles.modalBtnText}>Add</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const PRIMARY = '#4f46e5';
const styles = StyleSheet.create({
    bg: { flex: 1 },
    container: {
        paddingTop: 80,
        paddingHorizontal: 24,
        alignItems: 'stretch',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#312e81',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 32,
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
    input: { flex: 1, marginLeft: 8, color: '#fff', fontSize: 16 },
    value: { flex: 1, marginLeft: 8, color: '#fff', fontSize: 16 },

    sectionTitle: {
        color: '#e0e7ff',
        fontSize: 16,
        fontWeight: '600',
        marginVertical: 12,
    },
    // hours
    hoursRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    dayLabel: { width: 80, color: '#fff', fontWeight: '600' },
    timeBtn: {
        flex: 1,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        justifyContent: 'center',
        marginHorizontal: 4,
    },
    timeTxt: { color: '#fff', textAlign: 'center' },

    // tags
    tag: {
        backgroundColor: '#4f46e5',
        color: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginRight: 8,
        marginBottom: 8,
    },
    newRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    newInput: {
        flex: 1,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        paddingHorizontal: 8,
        color: '#fff',
    },
    addBtn: {
        marginLeft: 8,
        backgroundColor: PRIMARY,
        borderRadius: 8,
        padding: 8,
    },

    // staff list
    staffHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    staffRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    staffName: { color: '#fff', fontWeight: '600' },
    staffRole: { color: '#c7d2fe' },

    // buttons
    btn: {
        flexDirection: 'row',
        justifyContent: 'center',
        backgroundColor: PRIMARY,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    logoutBtn: { backgroundColor: '#ef4444' },

    // picker modal
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

    // Add staff modal
    modal: {
        width: '80%',
        backgroundColor: '#312e81',
        borderRadius: 12,
        padding: 16,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 8,
        color: '#fff',
        marginBottom: 12,
    },
    modalLabel: { color: '#e0e7ff', marginBottom: 4 },
    pickerWrapper: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        marginBottom: 16,
    },
    picker: { color: '#fff' },
    modalBtns: { flexDirection: 'row', justifyContent: 'space-between' },
    modalBtn: {
        flex: 1,
        backgroundColor: PRIMARY,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    modalBtnText: { color: '#fff', fontWeight: '600' },
});
