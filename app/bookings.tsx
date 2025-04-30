// app/bookings.tsx

import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    getDocs,
    getDoc,
    doc,
    Timestamp,
    serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import DateTimePicker from '@react-native-community/datetimepicker';

type BType = 'trainer' | 'basketball' | 'pickleball' | 'racquetball' | 'massage';

const OPTIONS: { type: BType; label: string; icon: any }[] = [
    { type: 'trainer', label: 'Personal Trainer', icon: 'account-tie' },
    { type: 'basketball', label: 'Basketball Court', icon: 'basketball' },
    { type: 'pickleball', label: 'Pickleball Court', icon: 'tennis' },
    { type: 'racquetball', label: 'Racquetball Court', icon: 'tennis-ball' },
    { type: 'massage', label: 'Massage', icon: 'hand-heart' },
];

const TITLES: Record<BType, string> = {
    trainer: 'Personal Trainer',
    basketball: 'Basketball Court',
    pickleball: 'Pickleball Court',
    racquetball: 'Racquetball Court',
    massage: 'Massage',
};

const { width } = Dimensions.get('window');
const BTN = (width - 64) / 2;

export default function BookingsScreen() {
    const router = useRouter();
    const uid = auth.currentUser!.uid;

    const [gymId, setGymId] = useState<string | null>(null);
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selType, setSelType] = useState<BType | null>(null);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [selStaff, setSelStaff] = useState<string | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());

    // 1️⃣ Load user's gymId
    useEffect(() => {
        getDoc(doc(db, 'users', uid)).then(snap => {
            if (snap.exists()) setGymId((snap.data() as any).gymId);
        });
    }, [uid]);

    // 2️⃣ Subscribe to user's booking history
    useEffect(() => {
        const q = query(collection(db, 'bookings'), where('userId', '==', uid));
        const unsub = onSnapshot(
            q,
            snap => {
                const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                arr.sort(
                    (a, b) =>
                        (b.start as Timestamp).seconds - (a.start as Timestamp).seconds
                );
                setList(arr);
                setLoading(false);
            },
            err => {
                console.warn('Booking query error', err);
                setError(err.message);
                setLoading(false);
                getDocs(q).then(docs => {
                    const arr = docs.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                    arr.sort(
                        (a, b) =>
                            (b.start as Timestamp).seconds - (a.start as Timestamp).seconds
                    );
                    setList(arr);
                });
            }
        );
        return unsub;
    }, [uid]);

    // 3️⃣ Load staff when booking a trainer/massage
    useEffect(() => {
        if (!gymId || (selType !== 'trainer' && selType !== 'massage')) {
            setStaffList([]);
            return;
        }
        const q = query(
            collection(db, 'trainers'),
            where('gymId', '==', gymId),
            where('role', '==', selType)
        );
        const unsub = onSnapshot(q, snap => {
            setStaffList(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        });
        return unsub;
    }, [gymId, selType]);

    // 4️⃣ Begin booking
    const startBooking = (type: BType) => {
        setSelType(type);
        setSelStaff(null);
        setShowDatePicker(false);
        setTempDate(new Date());
    };

    // 5️⃣ Choose staff
    const onChooseStaff = (staffId: string) => {
        setSelStaff(staffId);
        setShowDatePicker(true);
    };

    // 6️⃣ Date change
    const onChange = (_: any, selected?: Date) => {
        if (selected) setTempDate(selected);
    };

    // 7️⃣ Confirm booking
    const confirmPick = async () => {
        setShowDatePicker(false);
        if (!selType || !gymId || !selStaff) return;

        const start = tempDate;
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        try {
            await addDoc(collection(db, 'bookings'), {
                userId: uid,
                gymId,
                type: selType,
                staffId: selStaff,
                title: TITLES[selType],
                start: Timestamp.fromDate(start),
                end: Timestamp.fromDate(end),
                createdAt: serverTimestamp(),
            });
        } catch (e: any) {
            console.error('Booking write error', e);
            Alert.alert('Error', 'Could not save booking. Try again.');
        }

        setSelType(null);
        setSelStaff(null);
    };

    return (
        <LinearGradient colors={['#312e81', '#4f46e5']} style={styles.bg}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <SafeAreaView style={styles.header}>
                    <Pressable style={styles.back} onPress={() => router.back()}>
                        <MaterialCommunityIcons
                            name="chevron-left"
                            size={28}
                            color="#fff"
                        />
                    </Pressable>
                    <Text style={styles.title}>Bookings</Text>
                </SafeAreaView>

                {/* 𝗢𝗽𝘁𝗶𝗼𝗻𝘀 */}
                <View style={styles.row}>
                    {OPTIONS.map(o => (
                        <Pressable
                            key={o.type}
                            style={[
                                styles.btn,
                                selType === o.type && { backgroundColor: '#c7d2fe' },
                            ]}
                            onPress={() => startBooking(o.type)}
                        >
                            <MaterialCommunityIcons
                                name={o.icon}
                                size={24}
                                color="#4f46e5"
                            />
                            <Text style={styles.btnTxt}>{o.label}</Text>
                        </Pressable>
                    ))}
                </View>

                {/* 𝗦𝘁𝗮𝗳𝗳 𝗦𝗲𝗹𝗲𝗰𝘁𝗶𝗼𝗻 */}
                {selType &&
                    (selType === 'trainer' || selType === 'massage') && (
                        <View style={styles.staffContainer}>
                            <Text style={styles.staffLabel}>
                                Select{' '}
                                {selType === 'trainer' ? 'Trainer' : 'Therapist'}
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

                {/* 𝗗𝗮𝘁𝗲-𝗣𝗶𝗰𝗸𝗲𝗿 */}
                {showDatePicker && (
                    <View style={styles.pickerContainer}>
                        <DateTimePicker
                            value={tempDate}
                            mode="datetime"
                            display="spinner"
                            textColor="#1e293b"
                            onChange={onChange}
                            style={styles.picker}
                        />
                        <View style={styles.pickerButtons}>
                            <Pressable
                                onPress={() => setShowDatePicker(false)}
                                style={styles.pickerBtn}
                            >
                                <Text>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={confirmPick} style={styles.pickerBtn}>
                                <Text>Confirm</Text>
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* 𝗟𝗶𝘀𝘁 / 𝗘𝗿𝗿𝗼𝗿 / 𝗘𝗺𝗽𝘁𝘆 */}
                {loading && (
                    <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
                )}
                {error && <Text style={styles.err}>{error}</Text>}
                {!loading && list.length === 0 && (
                    <Text style={styles.empty}>No bookings yet.</Text>
                )}
                {list.map(item => (
                    <View key={item.id} style={styles.item}>
                        <MaterialCommunityIcons
                            name={
                                OPTIONS.find(o => o.type === item.type)?.icon ?? 'calendar'
                            }
                            size={22}
                            color="#4f46e5"
                        />
                        <View style={{ marginLeft: 10 }}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            <Text style={styles.itemSub}>
                                {(item.start as Timestamp).toDate().toLocaleString()}
                            </Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: {
        flex: 1,
        backgroundColor: '#312e81',
    },
    scrollContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    back: {
        position: 'absolute',
        left: 16,
        top: 60,
        padding: 4,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        paddingVertical: 12,
    },

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
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    btnTxt: {
        marginTop: 6,
        fontSize: 13,
        fontWeight: '600',
        color: '#4f46e5',
        textAlign: 'center',
    },

    staffContainer: {
        marginBottom: 16,
        width: '100%',
    },
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
    staffTxt: {
        color: '#fff',
        fontSize: 16,
    },

    pickerContainer: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 16,
        overflow: 'hidden',
    },
    picker: {
        width: '100%',
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

    item: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginVertical: 6,
        width: '100%',
    },
    itemTitle: {
        fontWeight: '600',
        color: '#1e293b',
    },
    itemSub: {
        color: '#64748b',
        fontSize: 13,
        marginTop: 2,
    },

    empty: {
        color: '#e0e7ff',
        fontSize: 16,
        marginTop: 20,
        textAlign: 'center',
    },
    err: {
        color: '#fecaca',
        fontSize: 13,
        marginTop: 20,
        textAlign: 'center',
    },
});
