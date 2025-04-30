// app/(business)/dashboard.tsx

import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    Pressable,
    Modal,
    Dimensions,
    TextInput,
    StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    addDoc,
    serverTimestamp,
    Timestamp,
    getDocs,
    doc,
    getDoc,
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Calendar, DateData } from 'react-native-calendars';
import { Picker } from '@react-native-picker/picker';

const { width } = Dimensions.get('window');
const BAR_WIDTH = (width - 48) / 16;

export default function DashboardScreen() {
    const router = useRouter();
    const uid = auth.currentUser!.uid;

    const [gym, setGym] = useState<any>(null);
    const [membersCount, setMembersCount] = useState(0);
    const [newMembersCount, setNewMembersCount] = useState(0);
    const [bookingsCount, setBookingsCount] = useState(0);
    const [todayBookings, setTodayBookings] = useState<any[]>([]);
    const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // calendar
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [bookingsForDate, setBookingsForDate] = useState<any[]>([]);
    const [staffMap, setStaffMap] = useState<Record<string, string>>({});
    const [loadingDate, setLoadingDate] = useState(false);

    // staff modal
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [staffName, setStaffName] = useState('');
    const [staffRole, setStaffRole] = useState<'trainer' | 'massage'>('trainer');
    const [postingStaff, setPostingStaff] = useState(false);

    // 1️⃣ load gym
    useEffect(() => {
        const q = query(collection(db, 'gyms'), where('ownerUid', '==', uid));
        return onSnapshot(
            q,
            snap => {
                if (!snap.empty) {
                    const d = snap.docs[0];
                    setGym({ id: d.id, ...(d.data() as any) });
                }
                setLoading(false);
            },
            err => {
                console.warn('gym fetch error', err);
                setLoading(false);
            }
        );
    }, [uid]);

    // 2️⃣ member counts
    useEffect(() => {
        if (!gym) return;
        const q1 = query(collection(db, 'users'), where('gymId', '==', gym.id));
        const unsub1 = onSnapshot(q1, snap => setMembersCount(snap.size));

        (async () => {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const q2 = query(
                collection(db, 'users'),
                where('gymId', '==', gym.id),
                where('createdAt', '>=', Timestamp.fromDate(weekAgo))
            );
            const snap2 = await getDocs(q2);
            setNewMembersCount(snap2.size);
        })();

        return () => unsub1();
    }, [gym]);

    // 3️⃣ booking counts & today’s & upcoming
    useEffect(() => {
        if (!gym) return;
        // total
        const qB = query(collection(db, 'bookings'), where('gymId', '==', gym.id));
        const unsubB = onSnapshot(qB, snap => setBookingsCount(snap.size));

        // today’s
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        const qT = query(
            collection(db, 'bookings'),
            where('gymId', '==', gym.id),
            where('start', '>=', Timestamp.fromDate(start)),
            where('start', '<', Timestamp.fromDate(end)),
            orderBy('start')
        );
        const unsubT = onSnapshot(qT, snap => {
            setTodayBookings(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        });

        // upcoming
        const qU = query(
            collection(db, 'bookings'),
            where('gymId', '==', gym.id),
            where('start', '>=', Timestamp.now()),
            orderBy('start'),
            limit(30)
        );
        const unsubU = onSnapshot(qU, snap => {
            setUpcomingBookings(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        });

        return () => { unsubB(); unsubT(); unsubU(); };
    }, [gym]);

    // 4️⃣ heatmap data (today or selected)
    const heatmapData = useMemo(() => {
        const source = selectedDate ? bookingsForDate : todayBookings;
        const counts: Record<number, number> = {};
        source.forEach(b => {
            const h = (b.start as Timestamp).toDate().getHours();
            counts[h] = (counts[h] || 0) + 1;
        });
        return counts;
    }, [selectedDate, bookingsForDate, todayBookings]);

    // 5️⃣ fetch bookings + staff for selected date
    useEffect(() => {
        if (!selectedDate || !gym) {
            setBookingsForDate([]);
            setStaffMap({});
            return;
        }
        setLoadingDate(true);
        (async () => {
            const [y, m, d] = selectedDate.split('-').map(Number);
            const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
            const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

            const qD = query(
                collection(db, 'bookings'),
                where('gymId', '==', gym.id),
                where('start', '>=', Timestamp.fromDate(dayStart)),
                where('start', '<', Timestamp.fromDate(dayEnd)),
                orderBy('start')
            );
            const snap = await getDocs(qD);
            const bkgs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
            setBookingsForDate(bkgs);

            // now batch-load staff names
            const staffIds = Array.from(new Set(bkgs.map(b => b.staffId).filter(Boolean)));
            const staffDocs = await Promise.all(
                staffIds.map(sid => getDoc(doc(db, 'trainers', sid)))
            );
            const map: Record<string, string> = {};
            staffDocs.forEach(sd => {
                if (sd.exists()) {
                    map[sd.id] = sd.data().name;
                }
            });
            setStaffMap(map);
            setLoadingDate(false);
        })();
    }, [selectedDate, gym]);

    // 6️⃣ add staff
    const addStaff = async () => {
        if (!staffName.trim() || !gym) return;
        setPostingStaff(true);
        try {
            await addDoc(collection(db, 'trainers'), {
                gymId: gym.id,
                name: staffName.trim(),
                role: staffRole,
                createdAt: serverTimestamp(),
            });
            setStaffName(''); setStaffRole('trainer');
            setShowStaffModal(false);
        } catch (e) { console.error(e) }
        setPostingStaff(false);
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>;
    }

    return (
        <LinearGradient
            colors={['#312e81', '#4f46e5', '#7c3aed']}
            style={styles.bg}
            start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>{gym?.name}</Text>

                {/* summary cards */}
                <View style={styles.row}>
                    <View style={styles.card}>
                        <MaterialCommunityIcons name="account-group" size={28} color="#4f46e5" />
                        <Text style={styles.cardLabel}>Members</Text>
                        <Text style={styles.cardValue}>{membersCount}</Text>
                    </View>
                    <View style={styles.card}>
                        <MaterialCommunityIcons name="account-plus" size={28} color="#4f46e5" />
                        <Text style={styles.cardLabel}>New (7d)</Text>
                        <Text style={styles.cardValue}>{newMembersCount}</Text>
                    </View>
                </View>
                <View style={styles.row}>
                    <View style={styles.card}>
                        <MaterialCommunityIcons name="calendar-check" size={28} color="#4f46e5" />
                        <Text style={styles.cardLabel}>Total Bookings</Text>
                        <Text style={styles.cardValue}>{bookingsCount}</Text>
                    </View>
                    <View style={styles.card}>
                        <MaterialCommunityIcons name="calendar-today" size={28} color="#4f46e5" />
                        <Text style={styles.cardLabel}>Today’s</Text>
                        <Text style={styles.cardValue}>{todayBookings.length}</Text>
                    </View>
                </View>

                {/* calendar */}
                <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
                <Calendar
                    style={styles.calendar}
                    onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
                    markedDates={{
                        ...upcomingBookings.reduce((m, b) => {
                            const d = (b.start as Timestamp).toDate().toISOString().slice(0, 10);
                            m[d] = { marked: true, dotColor: '#4f46e5' }; return m;
                        }, {} as Record<string, any>),
                        ...(selectedDate ? { [selectedDate]: { selected: true, selectedColor: '#7c3aed' } } : {})
                    }}
                />

                {/* sessions */}
                {selectedDate && (
                    <View style={{ width: '100%' }}>
                        <Text style={styles.subTitle}>Sessions on {selectedDate}</Text>
                        {loadingDate
                            ? <ActivityIndicator color="#fff" />
                            : bookingsForDate.length === 0
                                ? <Text style={styles.empty}>None</Text>
                                : bookingsForDate.map(b => {
                                    const t = (b.start as Timestamp).toDate();
                                    return (
                                        <View key={b.id} style={styles.updateCard}>
                                            <Text style={styles.updateTitle}>{b.title}</Text>
                                            <Text style={styles.updateTime}>
                                                {t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                            <Text style={styles.updateBy}>
                                                With: {staffMap[b.staffId] || '—'}
                                            </Text>
                                        </View>
                                    );
                                })
                        }
                    </View>
                )}

                {/* peak hours */}
                <Text style={styles.sectionTitle}>
                    Peak Hours ({selectedDate || 'Today'})
                </Text>
                <ScrollView horizontal contentContainerStyle={styles.heatmap}>
                    {Array.from({ length: 24 }, (_, h) => h).map(h => (
                        <View key={h} style={styles.barWrapper}>
                            <View
                                style={{
                                    ...styles.bar,
                                    height: 10 + (heatmapData[h] || 0) * 6,
                                    backgroundColor: (heatmapData[h] || 0) > 0 ? '#4f46e5' : 'rgba(255,255,255,0.2)',
                                }}
                            />
                            <Text style={styles.barLabel}>{h}</Text>
                        </View>
                    ))}
                </ScrollView>

                {/* quick actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.row}>
                    <Pressable style={styles.actionBtn} onPress={() => router.push('/(auth)/register')}>
                        <MaterialCommunityIcons name="account-plus" size={28} color="#fff" />
                        <Text style={styles.actionTxt}>Add Member</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => setShowStaffModal(true)}>
                        <MaterialCommunityIcons name="account-tie" size={28} color="#fff" />
                        <Text style={styles.actionTxt}>Add Staff</Text>
                    </Pressable>
                </View>
            </ScrollView>

            {/* staff modal */}
            <Modal visible={showStaffModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>New Staff</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Name"
                            placeholderTextColor="#ccc"
                            value={staffName}
                            onChangeText={setStaffName}
                        />
                        <Picker
                            selectedValue={staffRole}
                            onValueChange={v => setStaffRole(v as any)}
                            style={styles.picker}
                        >
                            <Picker.Item label="Personal Trainer" value="trainer" />
                            <Picker.Item label="Massage Therapist" value="massage" />
                        </Picker>
                        <View style={styles.modalRow}>
                            <Pressable onPress={() => setShowStaffModal(false)} style={styles.modalBtn}>
                                <Text style={styles.modalBtnTxt}>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={addStaff} style={[styles.modalBtn, postingStaff && { opacity: 0.5 }]}>
                                <Text style={styles.modalBtnTxt}>{postingStaff ? 'Adding…' : 'Add'}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#312e81' },
    container: { padding: 24, paddingTop: 80, alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 24, textAlign: 'center' },
    row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 16 },
    card: { flex: 1, marginHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 18, padding: 16, alignItems: 'center' },
    cardLabel: { color: '#e0e7ff', fontSize: 14, marginTop: 4 },
    cardValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
    sectionTitle: { width: '100%', color: '#e0e7ff', fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 8 },
    calendar: { width: '100%', borderRadius: 12, overflow: 'hidden' },
    subTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '500', marginTop: 12, marginBottom: 8 },
    empty: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginBottom: 8 },
    updateCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, marginBottom: 8 },
    updateTitle: { color: '#fff', fontWeight: '600' },
    updateTime: { color: '#c7d2fe', fontSize: 12, marginTop: 4, textAlign: 'right' },
    updateBy: { color: '#e0e7ff', fontSize: 12, marginTop: 2, fontStyle: 'italic' },
    heatmap: { paddingVertical: 12 },
    barWrapper: { width: BAR_WIDTH, alignItems: 'center', marginHorizontal: 2 },
    bar: { width: BAR_WIDTH, borderRadius: 4 },
    barLabel: { color: '#e0e7ff', fontSize: 10, marginTop: 4 },
    actionBtn: { flex: 1, marginHorizontal: 4, backgroundColor: '#4f46e5', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
    actionTxt: { color: '#fff', marginTop: 4, fontSize: 14 },
    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center' },
    modal: { width: '80%', backgroundColor: '#312e81', borderRadius: 12, padding: 16 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, color: '#fff', marginBottom: 12 },
    picker: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', marginBottom: 12 },
    modalRow: { flexDirection: 'row', justifyContent: 'space-between' },
    modalBtn: { flex: 1, marginHorizontal: 4, backgroundColor: '#4f46e5', borderRadius: 8, padding: 12, alignItems: 'center' },
    modalBtnTxt: { color: '#fff', fontWeight: '600' },
});