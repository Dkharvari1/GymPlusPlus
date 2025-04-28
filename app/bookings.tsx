// app/bookings.tsx

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    ActivityIndicator,
    Dimensions,
    Alert,
    SafeAreaView,
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
    const [showPicker, setShowPicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());

    // load current user's gymId
    useEffect(() => {
        getDoc(doc(db, 'users', uid)).then((snap) => {
            setGymId(snap.exists() ? (snap.data() as any).gymId : null);
        });
    }, [uid]);

    // subscribe to your bookings
    useEffect(() => {
        const q = query(collection(db, 'bookings'), where('userId', '==', uid));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
                arr.sort(
                    (a, b) => (b.start as Timestamp).seconds - (a.start as Timestamp).seconds
                );
                setList(arr);
                setLoading(false);
            },
            (err) => {
                console.warn('Booking query error', err);
                setError(err.message);
                setLoading(false);
                // fallback fetch
                getDocs(q).then((docs) => {
                    const arr = docs.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
                    arr.sort(
                        (a, b) => (b.start as Timestamp).seconds - (a.start as Timestamp).seconds
                    );
                    setList(arr);
                });
            }
        );
        return unsub;
    }, [uid]);

    // open the inline picker
    const startBooking = (type: BType) => {
        setSelType(type);
        setTempDate(new Date());
        setShowPicker(true);
    };

    // update tempDate as user spins
    const onChange = (_: any, selected?: Date) => {
        if (selected) setTempDate(selected);
    };

    // confirm and write to Firestore
    const confirmPick = async () => {
        setShowPicker(false);
        if (!selType || !gymId) return;
        const start = tempDate;
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        // check for collisions
        const clashQ = query(
            collection(db, 'bookings'),
            where('gymId', '==', gymId),
            where('type', '==', selType),
            where('start', '==', Timestamp.fromDate(start))
        );
        // const clashSnap = await getDocs(clashQ);
        // if (!clashSnap.empty) {
        //     Alert.alert('Slot taken', 'Please choose another time.');
        //     console.log("Alert!");
        //     return;
        // }
        console.log("here3");


        try {
            await addDoc(collection(db, 'bookings'), {
                userId: uid,
                gymId,
                type: selType,
                title: TITLES[selType],
                start: Timestamp.fromDate(start),
                end: Timestamp.fromDate(end),
                createdAt: serverTimestamp(),
            });
            console.log("complete");
        } catch (e: any) {
            console.error('Booking write error', e);
            Alert.alert('Error', 'Could not save booking. Try again.');
        }

        setSelType(null);
    };

    return (
        <LinearGradient colors={['#312e81', '#4f46e5']} style={styles.bg}>
            <SafeAreaView style={styles.header}>
                <Pressable style={styles.back} onPress={() => router.back()}>
                    <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
                </Pressable>
                <Text style={styles.title}>Bookings</Text>
            </SafeAreaView>

            {/* Booking options */}
            <View style={styles.row}>
                {OPTIONS.map((o) => (
                    <Pressable
                        key={o.type}
                        style={styles.btn}
                        onPress={() => startBooking(o.type)}
                    >
                        <MaterialCommunityIcons name={o.icon} size={24} color="#4f46e5" />
                        <Text style={styles.btnTxt}>{o.label}</Text>
                    </Pressable>
                ))}
            </View>

            {/* Inline iOS date-time picker */}
            {showPicker && (
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
                            onPress={() => setShowPicker(false)}
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

            {/* Bookings list / loading / empty state */}
            {loading && <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />}
            {error && <Text style={styles.err}>{error}</Text>}
            {!loading && list.length === 0 && (
                <Text style={styles.empty}>No bookings yet.</Text>
            )}
            {list.length > 0 && (
                <FlatList
                    data={list}
                    keyExtractor={(b) => b.id}
                    style={{ width: '100%' }}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    renderItem={({ item }) => (
                        <View style={styles.item}>
                            <MaterialCommunityIcons
                                name={
                                    OPTIONS.find((o) => o.type === item.type)?.icon ||
                                    'calendar'
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
                    )}
                />
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: {
        flex: 1,
        paddingHorizontal: 24,
        backgroundColor: '#312e81',
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
