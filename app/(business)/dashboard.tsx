// app/(business)/dashboard.tsx

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Pressable,
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
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function DashboardScreen() {
    const uid = auth.currentUser?.uid!;
    const [gym, setGym] = useState<any>(null);
    const [membersCount, setMembersCount] = useState(0);
    const [bookingsCount, setBookingsCount] = useState(0);
    const [todayBookings, setTodayBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // announcement form
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [posting, setPosting] = useState(false);

    // recent announcements
    const [announcements, setAnnouncements] = useState<any[]>([]);

    // ── 1️⃣ Load gym owned by this user ─────────────────────────────
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

    // ── 2️⃣ Member count ────────────────────────────────────────────
    useEffect(() => {
        if (!gym) return;
        const q = query(collection(db, 'users'), where('gymId', '==', gym.id));
        const unsub = onSnapshot(
            q,
            snap => setMembersCount(snap.size),
            err => console.warn('members fetch error', err)
        );
        return unsub;
    }, [gym]);

    // ── 3️⃣ Booking count ────────────────────────────────────────────
    useEffect(() => {
        if (!gym) return;
        const q = query(collection(db, 'bookings'), where('gymId', '==', gym.id));
        const unsub = onSnapshot(
            q,
            snap => setBookingsCount(snap.size),
            err => console.warn('bookings fetch error', err)
        );
        return unsub;
    }, [gym]);

    // ── 4️⃣ Today’s bookings ─────────────────────────────────────────
    useEffect(() => {
        if (!gym) return;
        // midnight today
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        // midnight tomorrow
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

        const q = query(
            collection(db, 'bookings'),
            where('gymId', '==', gym.id),
            where('start', '>=', Timestamp.fromDate(start)),
            where('start', '<', Timestamp.fromDate(end)),
            orderBy('start')
        );
        const unsub = onSnapshot(
            q,
            snap => {
                setTodayBookings(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            },
            err => console.warn('today bookings fetch error', err)
        );
        return unsub;
    }, [gym]);

    // ── 5️⃣ Fetch recent announcements ───────────────────────────────
    useEffect(() => {
        if (!gym) return;
        const q = query(
            collection(db, 'announcements'),
            where('gymId', '==', gym.id),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
        const unsub = onSnapshot(
            q,
            snap => {
                setAnnouncements(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            },
            err => console.warn('announcements fetch error', err)
        );
        return unsub;
    }, [gym]);

    // ── 6️⃣ Post a new announcement ─────────────────────────────────
    const postAnnouncement = async () => {
        if (!title.trim() || !desc.trim() || !gym) return;
        setPosting(true);
        try {
            await addDoc(collection(db, 'announcements'), {
                gymId: gym.id,
                title: title.trim(),
                description: desc.trim(),
                createdAt: serverTimestamp(),
            });
            setTitle('');
            setDesc('');
        } catch (e: any) {
            console.error('Failed to post update', e);
        } finally {
            setPosting(false);
        }
    };

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
                <Text style={styles.title}>{gym?.name ?? 'Dashboard'}</Text>

                {/* ── Summary cards ──────────────────────────────────────────── */}
                <View style={styles.card}>
                    <MaterialCommunityIcons name="account-group" size={32} color="#4f46e5" />
                    <Text style={styles.cardLabel}>Members</Text>
                    <Text style={styles.cardValue}>{membersCount}</Text>
                </View>
                <View style={styles.card}>
                    <MaterialCommunityIcons name="calendar-check" size={32} color="#4f46e5" />
                    <Text style={styles.cardLabel}>Total Bookings</Text>
                    <Text style={styles.cardValue}>{bookingsCount}</Text>
                </View>

                {/* ── Today’s Bookings ───────────────────────────────────────── */}
                <Text style={styles.sectionTitle}>Today’s Bookings</Text>
                {todayBookings.length === 0 ? (
                    <Text style={styles.empty}>No bookings for today.</Text>
                ) : (
                    todayBookings.map(b => {
                        const start = (b.start as Timestamp).toDate();
                        return (
                            <View key={b.id} style={styles.updateCard}>
                                <Text style={styles.updateTitle}>{b.title}</Text>
                                <Text style={styles.updateTime}>
                                    {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        );
                    })
                )}

                {/* ── Post a Community Update ────────────────────────────────── */}
                <Text style={styles.sectionTitle}>Post an Update</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Title"
                    placeholderTextColor="#ccc"
                    value={title}
                    onChangeText={setTitle}
                />
                <TextInput
                    style={[styles.input, styles.multiline]}
                    placeholder="Description"
                    placeholderTextColor="#ccc"
                    value={desc}
                    onChangeText={setDesc}
                    multiline
                />
                <Pressable
                    style={[
                        styles.postBtn,
                        (!title.trim() || !desc.trim() || posting) && { opacity: 0.5 },
                    ]}
                    onPress={postAnnouncement}
                    disabled={!title.trim() || !desc.trim() || posting}
                >
                    {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.postBtnText}>Post Update</Text>}
                </Pressable>

                {/* ── Recent Updates ─────────────────────────────────────────── */}
                <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Recent Updates</Text>
                {announcements.length === 0 ? (
                    <Text style={styles.empty}>No updates yet.</Text>
                ) : (
                    announcements.map(u => (
                        <View key={u.id} style={styles.updateCard}>
                            <Text style={styles.updateTitle}>{u.title}</Text>
                            <Text style={styles.updateDesc}>{u.description}</Text>
                            <Text style={styles.updateTime}>
                                {u.createdAt
                                    .toDate()
                                    .toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                            </Text>
                        </View>
                    ))
                )}
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#312e81' },
    container: { padding: 24, paddingTop: 80, alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 24, textAlign: 'center' },
    card: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 18,
        padding: 24,
        marginBottom: 16,
        alignItems: 'center',
    },
    cardLabel: { marginTop: 8, fontSize: 16, color: '#fff', fontWeight: '600' },
    cardValue: { marginTop: 4, fontSize: 22, color: '#fff', fontWeight: '700' },

    sectionTitle: {
        width: '100%',
        color: '#e0e7ff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 24,
        marginBottom: 8,
    },
    empty: { color: '#94a3b8', fontStyle: 'italic', marginTop: 12, textAlign: 'center' },

    updateCard: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    updateTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
    updateDesc: { color: '#e0e7ff', marginTop: 4 },
    updateTime: { color: '#c7d2fe', fontSize: 12, marginTop: 6, textAlign: 'right' },

    input: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: '#fff',
        marginBottom: 12,
    },
    multiline: { height: 80, textAlignVertical: 'top' },

    postBtn: {
        width: '100%',
        backgroundColor: '#4f46e5',
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    postBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
