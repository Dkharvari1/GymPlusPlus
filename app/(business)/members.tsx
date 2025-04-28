// app/(business)/members.tsx

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Alert,
    Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../lib/firebaseConfig';
import {
    doc,
    collection,
    query,
    where,
    onSnapshot,
    deleteDoc,
    getDocs,
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function MembersScreen() {
    const uid = auth.currentUser!.uid;
    const [gymId, setGymId] = useState<string | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // ① load this gym owner’s gymId
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
    }, [uid]);

    // ② subscribe to all members for that gym
    useEffect(() => {
        if (!gymId) return;
        const q = query(
            collection(db, 'users'),
            where('gymId', '==', gymId)
        );
        const unsub = onSnapshot(
            q,
            snap => {
                setMembers(
                    snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
                );
                setLoading(false);
            },
            e => console.warn('members fetch error', e)
        );
        return () => unsub();
    }, [gymId]);

    // ③ cancel membership handler
    const handleCancel = (member: any) => {
        Alert.alert(
            'Cancel membership?',
            `Remove ${member.displayName || 'this member'} permanently?`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // 1. delete Firestore user doc
                            await deleteDoc(doc(db, 'users', member.id));
                            // 2. (optional) delete all their bookings
                            const bookSnap = await getDocs(
                                query(collection(db, 'bookings'), where('userId', '==', member.id))
                            );
                            await Promise.all(
                                bookSnap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id)))
                            );
                            Alert.alert('Membership cancelled');
                        } catch (err: any) {
                            console.error('Failed to cancel membership', err);
                            Alert.alert('Error', err.message);
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <LinearGradient
                colors={['#312e81', '#4f46e5', '#7c3aed']}
                style={styles.bg}
            >
                <ActivityIndicator size="large" color="#fff" style={{ marginTop: 60 }} />
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={['#312e81', '#4f46e5', '#7c3aed']}
            style={styles.bg}
        >
            <Text style={styles.title}>Members</Text>

            <FlatList
                data={members}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.item}
                        onPress={() => handleCancel(item)}
                    >
                        <View>
                            <Text style={styles.name}>
                                {item.displayName || 'User'}
                            </Text>
                            <Text style={styles.email}>{item.email}</Text>
                        </View>
                        <MaterialCommunityIcons
                            name="account-cancel"
                            size={24}
                            color="#ef4444"
                        />
                    </Pressable>
                )}
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: {
        flex: 1,
        paddingTop: 60,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 24,
    },
    list: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 12,
        padding: 16,
        borderRadius: 18,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    email: {
        fontSize: 14,
        color: '#e0e7ff',
        marginTop: 4,
    },
});
