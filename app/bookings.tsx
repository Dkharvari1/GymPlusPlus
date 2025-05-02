// app/bookings.tsx

import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Dimensions,
    Alert,
    SafeAreaView,
    ScrollView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    getDoc,
    doc,
    Timestamp,
    serverTimestamp,
    deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';

const { width } = Dimensions.get('window');
const BTN = (width - 64) / 2;

// Friendly labels for built-ins
const BUILT_IN_LABELS: Record<string, string> = {
    trainer: 'Personal Trainer',
    massage: 'Massage Therapist',
};

function prettify(key?: string): string {
    if (!key) return '';
    return key
        .split('_')
        .map(w => w[0].toUpperCase() + w.slice(1))
        .join(' ');
}
function getLabel(key?: string | null): string {
    if (!key) return '';
    return BUILT_IN_LABELS[key] ?? prettify(key);
}

// Weekday names for business hours lookup
const WEEK_DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
] as const;

export default function BookingsScreen() {
    const router = useRouter();
    const uid = auth.currentUser!.uid;

    const [gymId, setGymId] = useState<string | null>(null);
    const [gymData, setGymData] = useState<any>(null);

    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Staff names cache
    const [staffNames, setStaffNames] = useState<Record<string, string>>({});

    // Booking flow
    const [selService, setSelService] = useState<string | null>(null);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [selStaff, setSelStaff] = useState<string | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());

    // All existing bookings for the chosen instructor
    const [staffBookings, setStaffBookings] = useState<any[]>([]);

    // 1️⃣ Load gymId from user
    useEffect(() => {
        (async () => {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
                setGymId((snap.data() as any).gymId ?? null);
            }
        })();
    }, [uid]);

    // 2️⃣ Listen to gym document
    useEffect(() => {
        if (!gymId) return;
        const unsub = onSnapshot(doc(db, 'gyms', gymId), snap => {
            if (snap.exists()) setGymData(snap.data());
        });
        return () => unsub();
    }, [gymId]);

    // 3️⃣ Compute bookable options
    const options = useMemo(() => {
        if (!gymData) return [];
        const rawServices = Array.isArray(gymData.services) ? gymData.services : [];
        const svcKeys = rawServices
            .map((s: any) => (typeof s === 'string' ? s : s.key))
            .filter((k: any) => typeof k === 'string');

        const courtsObj =
            gymData.courts && typeof gymData.courts === 'object'
                ? (gymData.courts as Record<string, number>)
                : {};
        const courtKeys = Object.entries(courtsObj)
            .filter(([, cnt]) => cnt > 0)
            .map(([k]) => k);

        return [
            ...svcKeys.map((key: string) => ({ type: key, label: getLabel(key) })),
            ...courtKeys.map(key => ({ type: key, label: getLabel(key) })),
        ];
    }, [gymData]);

    // 4️⃣ Subscribe to my bookings
    useEffect(() => {
        const q = query(collection(db, 'bookings'), where('userId', '==', uid));
        const unsub = onSnapshot(
            q,
            snap => {
                const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                arr.sort(
                    (a, b) =>
                        (b.start as Timestamp).toDate().getTime() -
                        (a.start as Timestamp).toDate().getTime()
                );
                setList(arr);
                setLoading(false);
            },
            err => {
                console.warn(err);
                setError(err.message);
                setLoading(false);
            }
        );
        return () => unsub();
    }, [uid]);

    // ⚡️ Fetch each booked staff’s name
    useEffect(() => {
        const ids = Array.from(new Set(list.map(b => b.staffId).filter(Boolean)));
        if (ids.length === 0) {
            setStaffNames({});
            return;
        }
        Promise.all(
            ids.map(id =>
                getDoc(doc(db, 'trainers', id)).then(snap =>
                    snap.exists() ? (snap.data() as any).name : '—'
                )
            )
        ).then(names => {
            const map: Record<string, string> = {};
            ids.forEach((id, i) => (map[id] = names[i]));
            setStaffNames(map);
        });
    }, [list]);

    // 5️⃣ Load trainers for a staff-based service
    useEffect(() => {
        if (!gymId || !selService || !Array.isArray(gymData?.services)) {
            setStaffList([]);
            return;
        }
        const svcKeys = (gymData.services as any[]).map(s =>
            typeof s === 'string' ? s : s.key
        );
        if (!svcKeys.includes(selService)) {
            setStaffList([]);
            return;
        }
        const q = query(
            collection(db, 'trainers'),
            where('gymId', '==', gymId),
            where('service', '==', selService)
        );
        const unsub = onSnapshot(q, snap => {
            setStaffList(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        });
        return () => unsub();
    }, [gymData, gymId, selService]);

    // Subscribe to that instructor’s existing bookings
    useEffect(() => {
        if (!selStaff || !gymId) {
            setStaffBookings([]);
            return;
        }
        const q = query(
            collection(db, 'bookings'),
            where('gymId', '==', gymId),
            where('staffId', '==', selStaff)
        );
        const unsub = onSnapshot(q, snap => {
            setStaffBookings(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        });
        return () => unsub();
    }, [selStaff, gymId]);

    // 6️⃣ Start booking
    function startBooking(type: string) {
        setSelService(type);
        setSelStaff(null);
        setTempDate(new Date());
        const svcKeys = Array.isArray(gymData?.services)
            ? (gymData.services as any[]).map(s => (typeof s === 'string' ? s : s.key))
            : [];
        if (svcKeys.includes(type)) {
            Alert.alert(
                'Select Instructor',
                `Please select a ${getLabel(type).toLowerCase()}.`
            );
        } else {
            setShowDatePicker(true);
        }
    }

    // 7️⃣ Pick a staff member
    function onChooseStaff(id: string) {
        setSelStaff(id);
        setShowDatePicker(true);
    }

    // 8️⃣ Date/time change
    function onDateChange(_: any, sel?: Date) {
        if (sel) setTempDate(sel);
    }

    // Compute gym hours bounds & label
    const dayHours = useMemo(() => {
        if (!gymData?.hours) return null;
        const dayName = WEEK_DAYS[tempDate.getDay()];
        const h = (gymData.hours as Record<string, { open: string; close: string }>)[
            dayName
        ];
        if (!h?.open || !h?.close) return null;
        const [oh, om] = h.open.split(':').map(Number);
        const [ch, cm] = h.close.split(':').map(Number);
        const min = new Date(tempDate);
        min.setHours(oh, om, 0, 0);
        const max = new Date(tempDate);
        max.setHours(ch, cm, 0, 0);
        return { min, max, label: `${h.open} – ${h.close}` };
    }, [gymData?.hours, tempDate]);

    // 9️⃣ Confirm booking
    async function confirmBooking() {
        setShowDatePicker(false);
        if (!selService || !gymId) return;

        // enforce gym hours
        if (dayHours) {
            const ms = tempDate.getTime();
            if (ms < dayHours.min.getTime() || ms >= dayHours.max.getTime()) {
                Alert.alert(
                    'Closed',
                    `Please pick a time within gym hours: ${dayHours.label}`
                );
                return;
            }
        }

        // conflict check for instructor
        if (selStaff) {
            const newStartMs = tempDate.getTime();
            const newEndMs = new Date(newStartMs + 60 * 60 * 1000).getTime();
            const conflict = staffBookings.some(b => {
                const bs = (b.start as Timestamp).toDate().getTime();
                const be = (b.end as Timestamp).toDate().getTime();
                return newStartMs < be && bs < newEndMs;
            });
            if (conflict) {
                Alert.alert(
                    'Unavailable',
                    'That instructor is already booked at the selected time.'
                );
                return;
            }
        }

        const start = tempDate;
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        try {
            await addDoc(collection(db, 'bookings'), {
                userId: uid,
                gymId,
                type: selService,
                ...(selStaff ? { staffId: selStaff } : {}),
                title: getLabel(selService),
                start: Timestamp.fromDate(start),
                end: Timestamp.fromDate(end),
                createdAt: serverTimestamp(),
            });
            setSelService(null);
            setSelStaff(null);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', 'Could not save booking. Try again.');
        }
    }

    // 🔟 Cancel a booking
    const handleCancelBooking = (id: string) => {
        Alert.alert(
            'Cancel booking?',
            'Are you sure you want to cancel this booking?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'bookings', id));
                            Alert.alert('Booking cancelled');
                        } catch (err: any) {
                            console.error(err);
                            Alert.alert('Error', 'Could not cancel booking');
                        }
                    },
                },
            ]
        );
    };

    return (
        <LinearGradient
            colors={['#312e81', '#4f46e5']}
            style={styles.bg}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <SafeAreaView style={styles.header}>
                    <Pressable style={styles.back} onPress={() => router.back()}>
                        <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
                    </Pressable>
                    <Text style={styles.title}>Book a Session</Text>
                </SafeAreaView>

                {/* 1️⃣ pick service / court */}
                <View style={styles.row}>
                    {options.map(o => (
                        <Pressable
                            key={o.type}
                            style={[
                                styles.btn,
                                selService === o.type && { backgroundColor: '#c7d2fe' },
                            ]}
                            onPress={() => startBooking(o.type)}
                        >
                            <MaterialCommunityIcons
                                name="calendar-plus"
                                size={24}
                                color="#4f46e5"
                            />
                            <Text style={styles.btnTxt}>{o.label}</Text>
                        </Pressable>
                    ))}
                </View>

                {/* 2️⃣ pick staff (if service) */}
                {selService &&
                    Array.isArray(gymData?.services) &&
                    (gymData.services as any[])
                        .map(s => (typeof s === 'string' ? s : s.key))
                        .includes(selService) &&
                    !showDatePicker && (
                        <View style={styles.staffContainer}>
                            <Text style={styles.staffLabel}>
                                Select {getLabel(selService).toLowerCase()}
                            </Text>
                            {staffList.length === 0 ? (
                                <Text style={styles.empty}>No staff available.</Text>
                            ) : (
                                staffList.map(s => (
                                    <Pressable
                                        key={s.id}
                                        style={[
                                            styles.staffBtn,
                                            selStaff === s.id && { backgroundColor: '#4f46e5' },
                                        ]}
                                        onPress={() => onChooseStaff(s.id)}
                                    >
                                        <Text
                                            style={[
                                                styles.staffTxt,
                                                selStaff === s.id && { color: '#fff' },
                                            ]}
                                        >
                                            {s.name}
                                        </Text>
                                    </Pressable>
                                ))
                            )}
                        </View>
                    )}

                {/* 3️⃣ date+time picker */}
                {showDatePicker && (
                    <View style={styles.pickerContainer}>
                        <DateTimePicker
                            value={tempDate}
                            mode="datetime"
                            display="spinner"
                            textColor="#000"
                            accentColor="#4f46e5"
                            onChange={onDateChange}
                            style={styles.picker}
                        />
                        {dayHours && (
                            <Text style={styles.hoursInfo}>Gym hours: {dayHours.label}</Text>
                        )}
                        <View style={styles.pickerButtons}>
                            <Pressable
                                style={styles.pickerBtn}
                                onPress={() => setShowDatePicker(false)}
                            >
                                <Text>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.pickerBtn} onPress={confirmBooking}>
                                <Text>Confirm</Text>
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* 4️⃣ Your bookings */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                    Your Bookings
                </Text>
                {loading ? (
                    <ActivityIndicator color="#fff" style={{ marginVertical: 20 }} />
                ) : error ? (
                    <Text style={styles.err}>{error}</Text>
                ) : list.length === 0 ? (
                    <Text style={styles.empty}>No bookings yet.</Text>
                ) : (
                    list.map(item => {
                        const date = (item.start as Timestamp).toDate();
                        return (
                            <View key={item.id} style={styles.item}>
                                <MaterialCommunityIcons
                                    name="calendar"
                                    size={22}
                                    color="#4f46e5"
                                />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.itemTitle}>{item.title}</Text>
                                    <Text style={styles.itemSub}>{date.toLocaleString()}</Text>
                                    {item.staffId && (
                                        <Text style={styles.itemSub}>
                                            With: {staffNames[item.staffId] ?? '–'}
                                        </Text>
                                    )}
                                </View>
                                <Pressable
                                    onPress={() => handleCancelBooking(item.id)}
                                    style={styles.cancelBtn}
                                >
                                    <MaterialCommunityIcons
                                        name="cancel"
                                        size={24}
                                        color="#ef4444"
                                    />
                                </Pressable>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1, backgroundColor: '#312e81' },
    scrollContainer: { paddingHorizontal: 24, paddingBottom: 40 },
    header: {
        alignItems: 'center',
        marginBottom: 20,
        marginTop: Platform.OS === 'android' ? 40 : 0,
    },
    back: { position: 'absolute', left: 0, top: 60, padding: 4 },
    title: { color: '#fff', fontSize: 24, fontWeight: '700', paddingVertical: 12 },

    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 12,
    },
    btn: {
        width: BTN,
        margin: 6,
        backgroundColor: '#fff',
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    btnTxt: {
        marginTop: 6,
        fontSize: 13,
        fontWeight: '600',
        color: '#4f46e5',
        textAlign: 'center',
    },

    staffContainer: { marginBottom: 16, width: '100%' },
    staffLabel: {
        color: '#e0e7ff',
        marginBottom: 8,
        fontSize: 15,
        fontWeight: '600',
    },
    staffBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    staffTxt: { color: '#fff', fontSize: 16 },

    pickerContainer: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 16,
        overflow: 'hidden',
    },
    picker: { width: '100%' },
    hoursInfo: {
        color: '#fff',
        textAlign: 'center',
        marginVertical: 8,
    },
    pickerButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 12,
    },
    pickerBtn: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#e5e7eb',
    },

    sectionTitle: {
        color: '#e0e7ff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    empty: {
        color: '#e0edf7',
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 12,
    },
    err: {
        color: '#fecaca',
        fontSize: 13,
        textAlign: 'center',
        marginVertical: 12,
    },

    item: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginVertical: 6,
        width: '100%',
    },
    itemTitle: { fontWeight: '600', color: '#1e293b' },
    itemSub: { color: '#64748b', fontSize: 13, marginTop: 2 },

    cancelBtn: {
        padding: 8,
        marginLeft: 12,
    },
});
