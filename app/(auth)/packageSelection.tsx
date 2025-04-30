// app/(auth)/packageSelection.tsx

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Alert,
    SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Package {
    name: string;
    price?: number | string;
    description?: string;
}

export default function PackageSelection() {
    const router = useRouter();
    const uid = auth.currentUser?.uid!;
    const [loading, setLoading] = useState(true);
    const [gymId, setGymId] = useState<string | null>(null);
    const [packages, setPackages] = useState<Package[]>([]);

    // 1️⃣ load user's gymId
    useEffect(() => {
        (async () => {
            try {
                const userSnap = await getDoc(doc(db, 'users', uid));
                if (!userSnap.exists()) throw new Error('User profile not found');
                const data = userSnap.data();
                if (!data.gymId) throw new Error('No gym selected');
                setGymId(data.gymId);
            } catch (e: any) {
                Alert.alert('Error', e.message, [
                    { text: 'OK', onPress: () => router.replace('/login') },
                ]);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // 2️⃣ fetch gym's membershipPackages
    useEffect(() => {
        if (!gymId) return;
        (async () => {
            setLoading(true);
            try {
                const gymSnap = await getDoc(doc(db, 'gyms', gymId));
                if (!gymSnap.exists()) throw new Error('Gym not found');
                const data = gymSnap.data();
                setPackages(Array.isArray(data.membershipPackages) ? data.membershipPackages : []);
            } catch (e: any) {
                Alert.alert('Error', e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [gymId]);

    // 3️⃣ choose package
    const choose = async (pkg: Package) => {
        try {
            await updateDoc(doc(db, 'users', uid), {
                selectedPackage: pkg,
            });
            router.replace('/(auth)/goalSetup');
        } catch (e: any) {
            Alert.alert('Error', 'Could not save your selection');
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
            <SafeAreaView style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
                </Pressable>
                <Text style={styles.title}>Choose Your Package</Text>
            </SafeAreaView>

            {packages.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.empty}>No membership packages available.</Text>
                </View>
            ) : (
                <FlatList
                    data={packages}
                    keyExtractor={(_, i) => String(i)}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => {
                        // ensure price is a number before toFixed
                        const priceNum = typeof item.price === 'number'
                            ? item.price
                            : Number(item.price);
                        const priceLabel = Number.isFinite(priceNum)
                            ? `$${priceNum.toFixed(2)}`
                            : `$${item.price ?? '0.00'}`;

                        return (
                            <Pressable
                                style={styles.card}
                                onPress={() => choose(item)}
                                android_ripple={{ color: '#ffffff22' }}
                            >
                                <Text style={styles.pkgName}>{item.name}</Text>
                                <Text style={styles.pkgPrice}>{priceLabel}</Text>
                                {item.description ? (
                                    <Text style={styles.pkgDesc}>{item.description}</Text>
                                ) : null}
                            </Pressable>
                        );
                    }}
                />
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    backBtn: { marginRight: 8 },
    title: { color: '#fff', fontSize: 20, fontWeight: '600' },

    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    empty: { color: '#cbd5e1', fontSize: 16 },

    list: { paddingHorizontal: 16, paddingBottom: 40 },
    card: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
    },
    pkgName: { color: '#fff', fontSize: 18, fontWeight: '700' },
    pkgPrice: { color: '#c7d2fe', fontSize: 16, marginVertical: 4 },
    pkgDesc: { color: '#e0e7ff', fontSize: 14 },
});
