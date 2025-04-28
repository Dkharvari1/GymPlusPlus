import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../lib/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function DashboardScreen() {
    const uid = auth.currentUser?.uid;
    const [gym, setGym] = useState<any>(null);
    const [members, setMembers] = useState<number>(0);
    const [bookings, setBookings] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // fetch gym owned by this user
    useEffect(() => {
        if (!uid) return;
        const q = query(
            collection(db, 'gyms'),
            where('ownerUid', '==', uid)
        );
        const unsub = onSnapshot(
            q,
            snap => {
                if (!snap.empty) {
                    const doc = snap.docs[0];
                    setGym({ id: doc.id, ...(doc.data() as any) });
                }
                setLoading(false);
            },
            err => console.warn('gym fetch error', err)
        );
        return () => unsub();
    }, [uid]);

    // member count
    useEffect(() => {
        if (!gym) return;
        const q = query(
            collection(db, 'users'),
            where('gymId', '==', gym.id)
        );
        const unsub = onSnapshot(
            q,
            snap => setMembers(snap.size),
            err => console.warn('members fetch error', err)
        );
        return () => unsub();
    }, [gym]);

    // booking count
    useEffect(() => {
        if (!gym) return;
        const q = query(
            collection(db, 'bookings'),
            where('gymId', '==', gym.id)
        );
        const unsub = onSnapshot(
            q,
            snap => setBookings(snap.size),
            err => console.warn('bookings fetch error', err)
        );
        return () => unsub();
    }, [gym]);

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

                <View style={styles.card}>
                    <MaterialCommunityIcons name="account-group" size={32} color="#4f46e5" />
                    <Text style={styles.cardLabel}>Members</Text>
                    <Text style={styles.cardValue}>{members}</Text>
                </View>

                <View style={styles.card}>
                    <MaterialCommunityIcons name="calendar-check" size={32} color="#4f46e5" />
                    <Text style={styles.cardLabel}>Total Bookings</Text>
                    <Text style={styles.cardValue}>{bookings}</Text>
                </View>

            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1 },
    container: {
        padding: 24,
        paddingTop: 80,
        alignItems: 'center',
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
        marginBottom: 24,
        textAlign: 'center',
    },
    card: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 18,
        padding: 24,
        marginBottom: 16,
        alignItems: 'center',
    },
    cardLabel: {
        marginTop: 8,
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    cardValue: {
        marginTop: 4,
        fontSize: 22,
        color: '#fff',
        fontWeight: '700',
    },
});