// app/(business)/members.tsx

import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Alert,
    Pressable,
    TextInput,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../lib/firebaseConfig';
import {
    doc,
    collection,
    query,
    where,
    onSnapshot,
    updateDoc,
    getDoc,
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

export default function MembersScreen() {
    const uid = auth.currentUser!.uid;
    const [gymId, setGymId] = useState<string | null>(null);
    const [membershipPackages, setMembershipPackages] = useState<
        { name: string; price: number; description: string }[]
    >([]);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state for upgrading
    const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
    const [memberToUpgrade, setMemberToUpgrade] = useState<any | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<string>('');

    // ① load this gym owner’s gymId
    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, 'users', uid),
            snap => {
                if (snap.exists()) {
                    setGymId((snap.data() as any).gymId ?? null);
                }
            },
            e => console.warn('user doc error', e)
        );
        return () => unsub();
    }, [uid]);

    // ② once we have gymId, fetch membershipPackages from gyms/{gymId}
    useEffect(() => {
        if (!gymId) return;
        (async () => {
            const gymSnap = await getDoc(doc(db, 'gyms', gymId));
            if (gymSnap.exists()) {
                const data = gymSnap.data() as any;
                setMembershipPackages(data.membershipPackages ?? []);
            }
        })();
    }, [gymId]);

    // ③ subscribe to all members in that gym
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

    // ④ filter by searchTerm
    const filtered = useMemo(() => {
        const t = searchTerm.trim().toLowerCase();
        if (!t) return members;
        return members.filter(m => {
            const name = (m.displayName ?? '').toLowerCase();
            const email = (m.email ?? '').toLowerCase();
            return name.includes(t) || email.includes(t);
        });
    }, [members, searchTerm]);

    // ⑤ cancel membership (clear gymId & gymName)
    const handleCancel = (member: any) => {
        Alert.alert(
            'Cancel membership?',
            `Remove ${member.displayName || 'this member'} from your gym?`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await updateDoc(doc(db, 'users', member.id), {
                                gymId: null,
                                gymName: null,
                                package: null,
                            });
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

    // ⑥ open upgrade modal
    const openUpgrade = (member: any) => {
        setMemberToUpgrade(member);
        setSelectedPackage(member.package ?? '');
        setUpgradeModalVisible(true);
    };

    // ⑦ confirm upgrade
    const confirmUpgrade = async () => {
        if (!memberToUpgrade) return;
        try {
            await updateDoc(doc(db, 'users', memberToUpgrade.id), {
                package: selectedPackage,
            });
            setUpgradeModalVisible(false);
            setMemberToUpgrade(null);
            Alert.alert('Package updated');
        } catch (err: any) {
            console.error('Failed to upgrade package', err);
            Alert.alert('Error', err.message);
        }
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

            {/* Search bar */}
            <View style={styles.searchWrap}>
                <MaterialCommunityIcons name="magnify" size={20} color="#9ca3af" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search members..."
                    placeholderTextColor="#9ca3af"
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
            </View>

            <FlatList
                data={filtered}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={() => (
                    <Text style={styles.empty}>
                        {searchTerm ? 'No matching members.' : 'No members yet.'}
                    </Text>
                )}
                renderItem={({ item }) => (
                    <View style={styles.item}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{item.displayName || 'User'}</Text>
                            <Text style={styles.email}>{item.email}</Text>
                            <Text style={styles.pkg}>
                                Package: {item.package ?? 'None'}
                            </Text>
                        </View>
                        <View style={styles.actions}>
                            <Pressable onPress={() => openUpgrade(item)} style={styles.actionBtn}>
                                <MaterialCommunityIcons
                                    name="arrow-up-bold"
                                    size={20}
                                    color="#4f46e5"
                                />
                            </Pressable>
                            <Pressable onPress={() => handleCancel(item)} style={styles.actionBtn}>
                                <MaterialCommunityIcons
                                    name="account-cancel"
                                    size={20}
                                    color="#ef4444"
                                />
                            </Pressable>
                        </View>
                    </View>
                )}
            />

            {/* Upgrade modal */}
            <Modal visible={upgradeModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>Upgrade Package</Text>
                        <Picker
                            selectedValue={selectedPackage}
                            onValueChange={v => setSelectedPackage(v)}
                            style={styles.picker}
                        >
                            <Picker.Item label="None" value={""} />
                            {membershipPackages.map((p, i) => (
                                <Picker.Item
                                    key={i}
                                    label={`${p.name} — $${p.price}`}
                                    value={p.name}
                                />
                            ))}
                        </Picker>
                        <View style={styles.modalRow}>
                            <Pressable
                                onPress={() => setUpgradeModalVisible(false)}
                                style={styles.modalBtn}
                            >
                                <Text style={styles.modalBtnTxt}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={confirmUpgrade}
                                style={[styles.modalBtn, !memberToUpgrade && { opacity: 0.5 }]}
                            >
                                <Text style={styles.modalBtnTxt}>Confirm</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1, paddingTop: 60 },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 16,
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 24,
        marginBottom: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 18,
        paddingHorizontal: 12,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        paddingVertical: 8,
        marginLeft: 8,
    },
    list: { paddingHorizontal: 24, paddingBottom: 40 },
    item: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 12,
        borderRadius: 18,
        padding: 16,
    },
    name: { fontSize: 16, fontWeight: '600', color: '#fff' },
    email: { fontSize: 14, color: '#e0e7ff', marginTop: 4 },
    pkg: { fontSize: 14, color: '#c7d2fe', marginTop: 4, fontStyle: 'italic' },
    actions: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: { marginLeft: 12 },

    empty: {
        color: '#e0e7ff',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 40,
    },

    /* Modal */
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0008',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: '80%',
        backgroundColor: '#312e81',
        borderRadius: 12,
        padding: 16,
    },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    picker: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', marginBottom: 12 },
    modalRow: { flexDirection: 'row', justifyContent: 'space-between' },
    modalBtn: { flex: 1, marginHorizontal: 4, backgroundColor: '#4f46e5', borderRadius: 8, padding: 12, alignItems: 'center' },
    modalBtnTxt: { color: '#fff', fontWeight: '600' },
});
