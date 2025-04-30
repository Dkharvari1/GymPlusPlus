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
    Platform,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import {
    doc,
    getDoc,
    onSnapshot,
    collection,
    updateDoc,
    addDoc,
    deleteDoc,
    serverTimestamp,
    query,
    where,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebaseConfig';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
type Day = typeof DAYS[number];

export default function GymSettingsScreen() {
    const router = useRouter();
    const uid = auth.currentUser?.uid!;

    const [gymId, setGymId] = useState<string | null>(null);
    const [gymData, setGymData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [editing, setEditing] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    const [hours, setHours] = useState<Record<Day, { open: string; close: string }>>(
        DAYS.reduce((acc, d) => ({ ...acc, [d]: { open: '', close: '' } }), {} as any)
    );
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerDay, setPickerDay] = useState<Day>(DAYS[0]);
    const [pickerMode, setPickerMode] = useState<'open' | 'close'>('open');
    const [tempTime, setTempTime] = useState(new Date());

    const [serviceTypes, setServiceTypes] = useState<{ key: string; label: string }[]>([]);
    const [newServiceLabel, setNewServiceLabel] = useState('');

    const [courtTypes, setCourtTypes] = useState<{ key: string; label: string }[]>([]);
    const [courts, setCourts] = useState<Record<string, number>>({});
    const [newCourtLabel, setNewCourtLabel] = useState('');

    const [staffList, setStaffList] = useState<any[]>([]);
    const [showAddStaff, setShowAddStaff] = useState(false);
    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffService, setNewStaffService] = useState('');
    const [postingStaff, setPostingStaff] = useState(false);

    // 1️⃣ load gymId, subscribe gymData
    useEffect(() => {
        (async () => {
            const u = await getDoc(doc(db, 'users', uid));
            if (u.exists()) {
                const gId = (u.data() as any).gymId;
                setGymId(gId);
                const unsub = onSnapshot(doc(db, 'gyms', gId), snap => {
                    if (snap.exists()) {
                        const d = snap.data();
                        setGymData(d);
                        // populate form
                        setName(d.name || '');
                        setEmail(d.email || '');
                        setPhone(d.phone || '');
                        setHours(d.hours || hours);
                        // services
                        const svs = Array.isArray(d.services) ? d.services : [];
                        setServiceTypes(svs.map((k: string) => ({
                            key: k,
                            label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                        })));
                        // courts
                        if (typeof d.courts === 'object') {
                            setCourts(d.courts);
                            setCourtTypes(Object.keys(d.courts).map(key => ({
                                key,
                                label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                            })));
                        }
                    }
                    setLoading(false);
                });
                return () => unsub();
            }
        })();
    }, [uid]);

    // 2️⃣ subscribe trainers
    useEffect(() => {
        if (!gymId) return;
        const q = query(collection(db, 'trainers'), where('gymId', '==', gymId));
        const unsub = onSnapshot(q, snap => {
            setStaffList(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        });
        return () => unsub();
    }, [gymId]);

    // guard: don’t render until gymData loaded
    if (loading || !gymData) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    // time picker handlers
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
    function onTimeChange(_: any, sel?: Date) {
        if (sel) setTempTime(sel);
    }
    function cancelPicker() { setPickerVisible(false); }
    function confirmPicker() {
        const hh = tempTime.getHours().toString().padStart(2, '0');
        const mm = tempTime.getMinutes().toString().padStart(2, '0');
        setHours(h => ({
            ...h,
            [pickerDay]: { ...h[pickerDay], [pickerMode]: `${hh}:${mm}` }
        }));
        setPickerVisible(false);
    }

    // add service
    function addServiceType() {
        const lab = newServiceLabel.trim();
        if (!lab) return Alert.alert('Enter a service name');
        const key = lab.toLowerCase().replace(/\s+/g, '_');
        if (serviceTypes.some(s => s.key === key)) return Alert.alert('Already exists');
        setServiceTypes(st => [...st, { key, label: lab }]);
        setNewServiceLabel('');
    }
    // add court
    function addCourtType() {
        const lab = newCourtLabel.trim();
        if (!lab) return Alert.alert('Enter a court name');
        const key = lab.toLowerCase().replace(/\s+/g, '_');
        if (courtTypes.some(c => c.key === key)) return Alert.alert('Already exists');
        setCourtTypes(ct => [...ct, { key, label: lab }]);
        setCourts(c => ({ ...c, [key]: 0 }));
        setNewCourtLabel('');
    }
    // add staff
    async function addStaff() {
        if (!newStaffName.trim() || !newStaffService) {
            return Alert.alert('Name & service required');
        }
        setPostingStaff(true);
        await addDoc(collection(db, 'trainers'), {
            gymId,
            name: newStaffName.trim(),
            service: newStaffService,
            createdAt: serverTimestamp()
        });
        setNewStaffName('');
        setNewStaffService('');
        setShowAddStaff(false);
        setPostingStaff(false);
    }

    // save gym changes
    async function handleSave() {
        if (!name.trim() || !email.trim() || !phone.trim()) {
            return Alert.alert('Name, email & phone required');
        }
        setLoading(true);
        await updateDoc(doc(db, 'gyms', gymId!), {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            hours,
            services: serviceTypes.map(s => s.key),
            courts,
            updatedAt: serverTimestamp()
        });
        setEditing(false);
        Alert.alert('Saved');
        setLoading(false);
    }

    // sign out
    async function handleSignOut() {
        await signOut(auth);
        router.replace('/login');
    }

    return (
        <LinearGradient colors={['#312e81', '#4f46e5', '#7c3aed']} style={styles.bg}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Gym Settings</Text>

                {/* Gym Info */}
                <View style={styles.row}>
                    <MaterialCommunityIcons name="office-building" size={22} color="#6b7280" />
                    {editing
                        ? <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Gym Name"
                            placeholderTextColor="#9ca3af"
                        />
                        : <Text style={styles.value}>{gymData.name}</Text>
                    }
                </View>
                <View style={styles.row}>
                    <MaterialCommunityIcons name="email-outline" size={22} color="#6b7280" />
                    {editing
                        ? <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Email"
                            keyboardType="email-address"
                            placeholderTextColor="#9ca3af"
                            autoCapitalize="none"
                        />
                        : <Text style={styles.value}>{gymData.email}</Text>
                    }
                </View>
                <View style={styles.row}>
                    <MaterialCommunityIcons name="phone" size={22} color="#6b7280" />
                    {editing
                        ? <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Phone"
                            keyboardType="phone-pad"
                            placeholderTextColor="#9ca3af"
                        />
                        : <Text style={styles.value}>{gymData.phone}</Text>
                    }
                </View>
                {editing
                    ? <Pressable style={styles.btn} onPress={handleSave}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnText}>Save Info</Text>
                        }
                    </Pressable>
                    : <Pressable style={styles.btn} onPress={() => setEditing(true)}>
                        <Text style={styles.btnText}>Edit Info</Text>
                    </Pressable>
                }

                {/* Business Hours */}
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
                <Text style={styles.sectionTitle}>Services</Text>
                <View style={styles.addRow}>
                    <TextInput
                        style={styles.newInput}
                        placeholder="New service"
                        placeholderTextColor="#ccc"
                        value={newServiceLabel}
                        onChangeText={setNewServiceLabel}
                    />
                    <Pressable style={styles.addBtn} onPress={addServiceType}>
                        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                    </Pressable>
                </View>
                <View style={styles.servicesRow}>
                    {serviceTypes.map(s => (
                        <View key={s.key} style={styles.tag}>
                            <Text style={styles.tagTxt}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Courts */}
                <Text style={styles.sectionTitle}>Courts</Text>
                <View style={styles.addRow}>
                    <TextInput
                        style={styles.newInput}
                        placeholder="New court"
                        placeholderTextColor="#ccc"
                        value={newCourtLabel}
                        onChangeText={setNewCourtLabel}
                    />
                    <Pressable style={styles.addBtn} onPress={addCourtType}>
                        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                    </Pressable>
                </View>
                {courtTypes.map(c => (
                    <View key={c.key} style={styles.courtRow}>
                        <Text style={styles.dayLabel}>{c.label}</Text>
                        <Picker
                            selectedValue={courts[c.key]}
                            onValueChange={v => setCourts(cc => ({ ...cc, [c.key]: Number(v) }))}
                            style={styles.courtPicker}
                        >
                            {Array.from({ length: 11 }, (_, i) => (
                                <Picker.Item key={i} label={`${i}`} value={i} />
                            ))}
                        </Picker>
                    </View>
                ))}

                {/* Staff */}
                <Text style={styles.sectionTitle}>Staff Members</Text>
                <Pressable style={[styles.btn, { marginBottom: 12 }]} onPress={() => setShowAddStaff(true)}>
                    <MaterialCommunityIcons name="account-plus" size={20} color="#fff" />
                    <Text style={[styles.btnText, { marginLeft: 8 }]}>Add Staff</Text>
                </Pressable>
                {staffList.map(s => (
                    <View key={s.id} style={styles.staffRow}>
                        <Text style={styles.staffName}>{s.name}</Text>
                        <Text style={styles.staffSvc}>{s.service}</Text>
                        <Pressable onPress={async () => { await deleteDoc(doc(db, 'trainers', s.id)) }}>
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#f87171" />
                        </Pressable>
                    </View>
                ))}

                {/* Sign Out */}
                <Pressable style={[styles.btn, styles.logoutBtn]} onPress={handleSignOut}>
                    <MaterialCommunityIcons name="logout" size={20} color="#fff" />
                    <Text style={[styles.btnText, { marginLeft: 8 }]}>Sign Out</Text>
                </Pressable>
            </ScrollView>

            {/* Time Picker Modal */}
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

            {/* Add Staff Modal */}
            <Modal visible={showAddStaff} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>Add New Staff</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Name"
                            placeholderTextColor="#ccc"
                            value={newStaffName}
                            onChangeText={setNewStaffName}
                        />
                        <Picker
                            selectedValue={newStaffService}
                            onValueChange={setNewStaffService}
                            style={styles.modalPicker}
                        >
                            <Picker.Item label="Select service…" value="" />
                            {serviceTypes.map(s => (
                                <Picker.Item key={s.key} label={s.label} value={s.key} />
                            ))}
                        </Picker>
                        <View style={styles.modalBtns}>
                            <Pressable style={styles.modalBtn} onPress={() => setShowAddStaff(false)}>
                                <Text style={styles.modalBtnTxt}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.modalBtn, postingStaff && { opacity: 0.5 }]} onPress={addStaff}>
                                <Text style={styles.modalBtnTxt}>{postingStaff ? 'Adding…' : 'Add'}</Text>
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#312e81' },
    container: { padding: 24, paddingTop: 80, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 24, textAlign: 'center' },
    row: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 18, paddingHorizontal: 16, marginBottom: 16, height: 48
    },
    input: { flex: 1, marginLeft: 8, color: '#fff', fontSize: 16 },
    value: { flex: 1, marginLeft: 8, color: '#fff', fontSize: 16 },
    btn: {
        flexDirection: 'row', backgroundColor: PRIMARY, borderRadius: 18, paddingVertical: 14,
        alignItems: 'center', justifyContent: 'center', marginBottom: 12
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    logoutBtn: { backgroundColor: '#ef4444' },
    sectionTitle: { color: '#e0e7ff', fontSize: 16, fontWeight: '600', marginVertical: 12 },
    hoursRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    dayLabel: { width: 80, color: '#fff', fontWeight: '600' },
    timeBtn: {
        flex: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8, justifyContent: 'center', marginHorizontal: 4
    },
    timeTxt: { color: '#fff', textAlign: 'center' },
    addRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    newInput: {
        flex: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8, paddingHorizontal: 8, color: '#fff'
    },
    addBtn: { marginLeft: 8, backgroundColor: PRIMARY, padding: 8, borderRadius: 8 },
    servicesRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
    tag: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, margin: 4 },
    tagTxt: { color: '#fff' },
    courtRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    courtPicker: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' },
    staffRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 12, marginBottom: 8
    },
    staffName: { color: '#fff', fontSize: 16, fontWeight: '600' },
    staffSvc: { color: '#e0e7ff' },
    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center' },
    pickerModal: { width: '80%', backgroundColor: '#312e81', borderRadius: 12, overflow: 'hidden' },
    pickerActions: { flexDirection: 'row', backgroundColor: '#1f1f2e' },
    pickerActionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    pickerActionTxt: { color: '#fff', fontWeight: '600' },
    modal: { width: '80%', backgroundColor: '#312e81', borderRadius: 12, padding: 16 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    modalInput: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, color: '#fff', marginBottom: 12 },
    modalPicker: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', marginBottom: 12 },
    modalBtns: { flexDirection: 'row', justifyContent: 'space-between' },
    modalBtn: { flex: 1, marginHorizontal: 4, backgroundColor: PRIMARY, borderRadius: 8, padding: 12, alignItems: 'center' },
    modalBtnTxt: { color: '#fff', fontWeight: '600' },
});
