// app/(business)/settings.tsx

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ScrollView,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function GymSettingsScreen() {
    const router = useRouter();
    const uid = auth.currentUser?.uid;

    const [gymId, setGymId] = useState<string | null>(null);
    const [gymData, setGymData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [editing, setEditing] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    /* fetch gymId then gym doc */
    useEffect(() => {
        if (!uid) return;
        (async () => {
            // first load user's gymId
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (!userSnap.exists()) {
                Alert.alert('Error', 'User profile not found');
                setLoading(false);
                return;
            }
            const gId = (userSnap.data() as any).gymId;
            setGymId(gId);

            // then load gym data
            if (gId) {
                const gymSnap = await getDoc(doc(db, 'gyms', gId));
                if (gymSnap.exists()) {
                    const data = gymSnap.data();
                    setGymData(data);
                    setName(data.name ?? '');
                    setEmail(data.email ?? '');
                    setPhone(data.phone ?? '');
                }
            }
            setLoading(false);
        })();
    }, [uid]);

    async function handleSave() {
        if (!gymId) return;
        if (!name.trim() || !email.trim() || !phone.trim()) {
            Alert.alert('All fields are required');
            return;
        }
        setLoading(true);
        try {
            await updateDoc(doc(db, 'gyms', gymId), {
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                updatedAt: serverTimestamp(),
            });
            setGymData({ ...gymData, name: name.trim(), email: email.trim(), phone: phone.trim() });
            setEditing(false);
            Alert.alert('Saved', 'Gym settings updated');
        } catch (err: any) {
            Alert.alert('Error saving', err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSignOut() {
        try {
            await signOut(auth);
            router.replace('/login');
        } catch (err: any) {
            Alert.alert('Sign out failed', err.message);
        }
    }

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
                <Text style={styles.title}>Gym Settings</Text>

                {/* Name */}
                <View style={styles.row}>
                    <MaterialCommunityIcons name="office-building" size={22} color="#6b7280" />
                    {editing ? (
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Gym Name"
                            placeholderTextColor="#9ca3af"
                        />
                    ) : (
                        <Text style={styles.value}>{gymData?.name || '–'}</Text>
                    )}
                </View>

                {/* Email */}
                <View style={styles.row}>
                    <MaterialCommunityIcons name="email-outline" size={22} color="#6b7280" />
                    {editing ? (
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Business Email"
                            placeholderTextColor="#9ca3af"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    ) : (
                        <Text style={styles.value}>{gymData?.email || '–'}</Text>
                    )}
                </View>

                {/* Phone */}
                <View style={styles.row}>
                    <MaterialCommunityIcons name="phone" size={22} color="#6b7280" />
                    {editing ? (
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Phone Number"
                            placeholderTextColor="#9ca3af"
                            keyboardType="phone-pad"
                        />
                    ) : (
                        <Text style={styles.value}>{gymData?.phone || '–'}</Text>
                    )}
                </View>

                {/* Buttons */}
                {editing ? (
                    <Pressable
                        style={[styles.btn, !name.trim() && { opacity: 0.5 }]}
                        onPress={handleSave}
                        disabled={!name.trim() || loading}
                        android_ripple={{ color: '#ffffff22' }}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnText}>Save</Text>
                        )}
                    </Pressable>
                ) : (
                    <Pressable
                        style={styles.btn}
                        onPress={() => setEditing(true)}
                        android_ripple={{ color: '#ffffff22' }}
                    >
                        <Text style={styles.btnText}>Edit Gym Info</Text>
                    </Pressable>
                )}

                <Pressable
                    style={[styles.btn, styles.logoutBtn]}
                    onPress={handleSignOut}
                    android_ripple={{ color: '#ffffff22' }}
                >
                    <MaterialCommunityIcons
                        name="logout"
                        size={20}
                        color="#fff"
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.btnText}>Sign Out</Text>
                </Pressable>
            </ScrollView>
        </LinearGradient>
    );
}

const PRIMARY = '#4f46e5';

const styles = StyleSheet.create({
    bg: { flex: 1 },
    container: {
        paddingTop: 80,
        paddingHorizontal: 24,
        alignItems: 'stretch',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#312e81',
    },
    title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 32, textAlign: 'center' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 18,
        paddingHorizontal: 16,
        marginBottom: 16,
        height: 48,
    },
    input: { flex: 1, marginLeft: 8, color: '#fff', fontSize: 16 },
    value: { flex: 1, marginLeft: 8, color: '#fff', fontSize: 16 },
    btn: {
        flexDirection: 'row',
        justifyContent: 'center',
        backgroundColor: PRIMARY,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    logoutBtn: { backgroundColor: '#ef4444' },
});

