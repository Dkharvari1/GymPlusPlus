// app/(business)/areas.tsx

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    SafeAreaView,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
    Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;

// Only these three are “courts”
const COURT_TYPES = ['basketball', 'pickleball', 'racquetball'] as const;
type CourtType = typeof COURT_TYPES[number];

const COURT_LABEL: Record<CourtType, string> = {
    basketball: 'Basketball Court',
    pickleball: 'Pickleball Court',
    racquetball: 'Racquetball Court',
};

// Ensure these exactly match the icon names in MaterialCommunityIcons
const COURT_ICON: Record<CourtType, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
    basketball: 'basketball',
    pickleball: 'tennis',
    racquetball: 'tennis-ball',
};

export default function AreasScreen() {
    const uid = auth.currentUser!.uid;
    const [gymId, setGymId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [courtBookings, setCourtBookings] = useState<any[]>([]);

    // 1️⃣ Load the gymId from the signed-in user’s document
    useEffect(() => {
        (async () => {
            try {
                const userSnap = await getDoc(doc(db, 'users', uid));
                if (userSnap.exists()) {
                    setGymId((userSnap.data() as any).gymId);
                }
            } catch (e) {
                console.warn('Failed to load gymId', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [uid]);

    // 2️⃣ Subscribe to all bookings for this gym, filter to today’s courts only
    useEffect(() => {
        if (!gymId) return;

        setLoading(true);

        // start of today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const startTs = Timestamp.fromDate(todayStart);

        // start of tomorrow
        const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        const endTs = Timestamp.fromDate(tomorrow);

        const q = query(
            collection(db, 'bookings'),
            where('gymId', '==', gymId)
        );

        const unsub = onSnapshot(
            q,
            snap => {
                const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                const todayCourts = all
                    // only court bookings within [todayStart, tomorrow)
                    .filter(b => {
                        if (!COURT_TYPES.includes(b.type)) return false;
                        const ts: Timestamp = b.start;
                        return ts >= startTs && ts < endTs;
                    })
                    // sort by start time asc
                    .sort((a, b) => {
                        const aMs = (a.start as Timestamp).toDate().getTime();
                        const bMs = (b.start as Timestamp).toDate().getTime();
                        return aMs - bMs;
                    });

                setCourtBookings(todayCourts);
                setLoading(false);
            },
            err => {
                console.warn('Bookings listener error', err);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [gymId]);

    if (loading) {
        return (
            <LinearGradient
                colors={['#312e81', '#4f46e5', '#7c3aed']}
                style={styles.center}
            >
                <ActivityIndicator size="large" color="#fff" />
            </LinearGradient>
        );
    }

    const renderItem = ({ item }: { item: any }) => {
        const start = (item.start as Timestamp).toDate();
        const time = start.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
        const type = item.type as CourtType;

        return (
            <View style={styles.card}>
                <MaterialCommunityIcons
                    name={COURT_ICON[type]}
                    size={28}
                    color="#4f46e5"
                />
                <View style={styles.cardText}>
                    <Text style={styles.cardLabel}>{COURT_LABEL[type]}</Text>
                    <Text style={styles.cardSub}>{time}</Text>
                </View>
            </View>
        );
    };

    return (
        <LinearGradient
            colors={['#312e81', '#4f46e5', '#7c3aed']}
            style={styles.bg}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
        >
            <SafeAreaView style={styles.container}>
                <Text style={styles.title}>Today’s Court Bookings</Text>

                {courtBookings.length === 0 ? (
                    <Text style={styles.empty}>No courts booked today.</Text>
                ) : (
                    <FlatList
                        data={courtBookings}
                        keyExtractor={b => b.id}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 24 }}
                    />
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1 },
    center: {
        flex: 1,
        backgroundColor: '#312e81',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: { flex: 1, padding: 24 },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 16,
        textAlign: 'center',
    },
    empty: {
        color: '#e0e7ff',
        fontSize: 16,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 32,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        width: CARD_WIDTH,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        alignSelf: 'center',
    },
    cardText: { marginLeft: 12 },
    cardLabel: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    cardSub: {
        color: '#cbd5e1',
        fontSize: 14,
        marginTop: 4,
    },
});
