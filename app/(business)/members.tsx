import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../lib/firebaseConfig';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';

export default function MembersScreen() {
    const uid = auth.currentUser!.uid;
    const [gymId, setGymId] = useState<string | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // fetch gymId from user profile
    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, 'users', uid),
            snap => {
                if (snap.exists()) {
                    setGymId((snap.data() as any).gymId);
                }
            },
            e => console.warn('user doc error', e)
        );
        return () => unsub();
    }, []);

    // subscribe to members of this gym
    useEffect(() => {
        if (!gymId) return;
        const q = query(
            collection(db, 'users'),
            where('gymId', '==', gymId)
        );
        const unsub = onSnapshot(
            q,
            snap => {
                setMembers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
                setLoading(false);
            },
            e => console.warn('members fetch error', e)
        );
        return () => unsub();
    }, [gymId]);

    return (
        <LinearGradient colors={['#312e81', '#4f46e5', '#7c3aed']} style={styles.bg}>
            <Text style={styles.title}>Members</Text>

            {loading ? (
                <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={members}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingHorizontal: 24 }}
                    renderItem={({ item }) => (
                        <View style={styles.item}>
                            <Text style={styles.name}>{item.displayName || 'User'}</Text>
                            <Text style={styles.email}>{item.email}</Text>
                        </View>
                    )}
                />
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1, paddingTop: 60 },
    title: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
    item: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 12,
        marginHorizontal: 24,
        padding: 16,
        borderRadius: 18,
    },
    name: { fontSize: 16, fontWeight: '600', color: '#fff' },
    email: { fontSize: 14, color: '#e0e7ff', marginTop: 4 },
});
