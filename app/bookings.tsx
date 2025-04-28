import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    ActivityIndicator,
    Dimensions,
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
    getDoc,
    getDocs,
    doc,
    Timestamp,
    serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import DateTimePicker from '@react-native-community/datetimepicker';

/* ── constants ──────────────────────────────────────────────── */
type BType =
    | 'trainer'
    | 'basketball'
    | 'pickleball'
    | 'racquetball'
    | 'massage';

const TYPES: { type: BType; label: string; icon: any }[] = [
    { type: 'trainer', label: 'Personal Trainer', icon: 'account-tie' },
    { type: 'basketball', label: 'Basketball Court', icon: 'basketball' },
    { type: 'pickleball', label: 'Pickleball Court', icon: 'tennis' },
    { type: 'racquetball', label: 'Racquetball Court', icon: 'tennis-ball' },
    { type: 'massage', label: 'Massage', icon: 'hand-heart' },
];

const TITLE: Record<BType, string> = {
    trainer: 'Personal Trainer',
    basketball: 'Basketball Court',
    pickleball: 'Pickleball Court',
    racquetball: 'Racquetball Court',
    massage: 'Massage',
};

const HOURS = Array.from({ length: 16 }, (_, i) => 6 + i); // 6 am → 9 pm
const { width } = Dimensions.get('window');
const BTN = (width - 60) / 2;

/* ── component ──────────────────────────────────────────────── */
export default function BookingsScreen() {
    const router = useRouter();
    const uid = auth.currentUser!.uid;

    const [gymId, setGymId] = useState<string | null>(null);
    const [list, setList] = useState<any[] | null>(null);
    const [err, setErr] = useState<string | null>(null);

    /* wizard */
    const [step, setStep] = useState<'date' | 'hour' | null>(null);
    const [selType, setSelType] = useState<BType | null>(null);
    const [date, setDate] = useState(new Date());
    const [taken, setTaken] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);

    /* ─ fetch user’s gymId ─ */
    useEffect(() => {
        getDoc(doc(db, 'users', uid)).then(s =>
            setGymId(s.exists() ? (s.data() as any).gymId : null)
        );
    }, []);

    /* ─ live bookings list (no composite index needed) ─ */
    useEffect(() => {
        const q = query(collection(db, 'bookings'), where('userId', '==', uid));
        return onSnapshot(
            q,
            snap => {
                const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                arr.sort((a, b) => (b.start as Timestamp).seconds - (a.start as Timestamp).seconds);
                setList(arr);
            },
            e => {
                console.warn('booking query error', e);
                setErr(e.message);
                /* fallback one-shot */
                getDocs(q).then(docs => {
                    const arr = docs.docs.map(d => ({ id: d.id, ...d.data() }));
                    arr.sort((a, b) => (b.start as Timestamp).seconds - (a.start as Timestamp).seconds);
                    setList(arr);
                });
            }
        );
    }, []);

    /* ─ load taken hours for the selected day/type ─ */
    useEffect(() => {
        if (!gymId || !selType || step !== 'hour') return;
        const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 86_400_000);

        const q = query(
            collection(db, 'bookings'),
            where('gymId', '==', gymId),
            where('type', '==', selType),
            where('start', '>=', Timestamp.fromDate(dayStart)),
            where('start', '<', Timestamp.fromDate(dayEnd))
        );
        return onSnapshot(q, snap =>
            setTaken(snap.docs.map(d => (d.data().start as Timestamp).toDate().getHours()))
        );
    }, [gymId, selType, date, step]);

    /* ─ wizard handlers ─ */
    function startWizard(t: BType) { setSelType(t); setStep('date'); }
    function onDate(_e: any, d?: Date) { d ? (setDate(d), setStep('hour')) : setStep(null); }

    async function pickHour(h: number) {
        if (!gymId || !selType) return;
        setBusy(true);
        try {
            const start = new Date(date); start.setHours(h, 0, 0, 0);
            const end = new Date(start.getTime() + 60 * 60 * 1000);

            /* collision check */
            const clash = await getDocs(query(
                collection(db, 'bookings'),
                where('gymId', '==', gymId),
                where('type', '==', selType),
                where('start', '==', Timestamp.fromDate(start))
            ));
            if (!clash.empty) { alert('That slot was just taken.'); return; }

            await addDoc(collection(db, 'bookings'), {
                userId: uid,
                gymId,
                type: selType,
                title: TITLE[selType],
                start: Timestamp.fromDate(start),
                end: Timestamp.fromDate(end),
                createdAt: serverTimestamp(),
            });
            setStep(null);
        } finally { setBusy(false); }
    }

    /* ─ UI ─ */
    return (
        <LinearGradient colors={['#312e81', '#4f46e5']} style={styles.bg}>
            {/* back arrow */}
            <Pressable style={styles.back} onPress={() => router.back()}>
                <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
            </Pressable>

            <Text style={styles.title}>Bookings</Text>

            {/* resource buttons */}
            <View style={styles.typeRow}>
                {TYPES.map(t => (
                    <Pressable key={t.type} style={styles.typeBtn} onPress={() => startWizard(t.type)}>
                        <MaterialCommunityIcons name={t.icon} size={24} color="#4f46e5" />
                        <Text style={styles.typeTxt}>{t.label}</Text>
                    </Pressable>
                ))}
            </View>

            {/* list / errors */}
            {err && <Text style={styles.err}>{err}</Text>}
            {list === null ? (
                <ActivityIndicator color="#fff" size="large" style={{ marginTop: 40 }} />
            ) : list.length === 0 ? (
                <Text style={styles.empty}>You have no bookings yet.</Text>
            ) : (
                <FlatList
                    data={list}
                    keyExtractor={b => b.id}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    renderItem={({ item }) => (
                        <View style={styles.item}>
                            <MaterialCommunityIcons
                                name={TYPES.find(t => t.type === item.type)?.icon || 'calendar'}
                                size={22}
                                color="#4f46e5"
                            />
                            <View style={{ marginLeft: 10 }}>
                                <Text style={styles.itemTitle}>{item.title}</Text>
                                <Text style={styles.itemSub}>{fmt(item.start)}</Text>
                            </View>
                        </View>
                    )}
                />
            )}

            {/* wizard overlays */}
            {step === 'date' && (
                <View style={styles.overlay}>
                    <DateTimePicker
                        value={date}
                        mode="date"
                        minimumDate={new Date()}
                        onChange={onDate}
                    />
                </View>
            )}

            {step === 'hour' && (
                <View style={styles.overlay}>
                    <View style={styles.hourSheet}>
                        <Text style={styles.hourTitle}>Select Hour ({TITLE[selType!]})</Text>
                        <View style={styles.hourGrid}>
                            {HOURS.map(h => {
                                const disabled = taken.includes(h);
                                return (
                                    <Pressable
                                        key={h}
                                        style={[styles.hourBtn, disabled && { opacity: 0.3 }]}
                                        disabled={disabled || busy}
                                        onPress={() => pickHour(h)}
                                    >
                                        <Text style={styles.hourTxt}>{h}:00</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        <Pressable onPress={() => setStep(null)}>
                            <Text style={styles.cancel}>cancel</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </LinearGradient>
    );
}

/* ─ helpers ─ */
const fmt = (ts: Timestamp) =>
    ts.toDate().toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

/* ─ styles ─ */
const styles = StyleSheet.create({
    bg: { flex: 1, paddingTop: 60, paddingHorizontal: 24 },
    back: { position: 'absolute', top: 54, left: 20, padding: 4 },
    title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 20 },

    typeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
    typeBtn: {
        width: BTN, margin: 6, backgroundColor: '#fff',
        borderRadius: 18, padding: 14, alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }
    },
    typeTxt: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#4f46e5', textAlign: 'center' },

    item: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        borderRadius: 18, padding: 14, marginBottom: 12
    },
    itemTitle: { fontWeight: '600', color: '#1e293b' },
    itemSub: { color: '#64748b', fontSize: 13, marginTop: 2 },

    empty: { color: '#e0e7ff', fontSize: 16, textAlign: 'center', marginTop: 40 },
    err: { color: '#fecaca', fontSize: 13, textAlign: 'center', marginBottom: 6 },

    overlay: {
        ...StyleSheet.absoluteFillObject, justifyContent: 'center',
        alignItems: 'center', backgroundColor: '#0008'
    },

    hourSheet: {
        width: '90%', backgroundColor: '#fff', borderRadius: 24,
        padding: 18, alignItems: 'center'
    },
    hourTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#1e293b' },
    hourGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    hourBtn: {
        width: 70, margin: 4, paddingVertical: 8, borderRadius: 12,
        backgroundColor: '#e0e7ff', alignItems: 'center'
    },
    hourTxt: { color: '#1e293b', fontWeight: '600' },
    cancel: { color: '#4f46e5', marginTop: 10, fontWeight: '600' },
});
