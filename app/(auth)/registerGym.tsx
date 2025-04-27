import React, { useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, ActivityIndicator,
    Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';
import AuthCard from '../../ui/AuthCard';

export default function RegisterGym() {
    const router = useRouter();
    const [gymName, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [pw, setPw] = useState('');
    const [busy, setBusy] = useState(false);

    const valid = () => gymName && email && phone && pw.length >= 6;

    async function submit() {
        if (!valid()) { Alert.alert('Fill all fields'); return; }
        setBusy(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
            await updateProfile(cred.user, { displayName: gymName });

            const gymRef = await addDoc(collection(db, 'gyms'), {
                name: gymName, ownerUid: cred.user.uid, email: email.trim(),
                phone, createdAt: serverTimestamp(),
            });

            await setDoc(doc(db, 'users', cred.user.uid), {
                uid: cred.user.uid, role: 'business', gymId: gymRef.id,
                gymName, email: email.trim(), phone, createdAt: serverTimestamp(),
            });

            router.replace('/(tabs)');
        } catch (e: any) { Alert.alert('Error', e.message); }
        finally { setBusy(false); }
    }

    const Input = (p: any) => (
        <View key={p.placeholder} style={s.row}>
            <MaterialCommunityIcons name={p.icon} size={22} color="#6b7280" />
            <TextInput {...p} placeholderTextColor="#9ca3af" style={s.input} />
        </View>
    );

    return (
        <LinearGradient colors={['#312e81', '#4f46e5', '#7c3aed']} style={s.bg}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%' }}>
                <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <AuthCard>
                        <Text style={s.title}>Register Gym</Text>

                        <Input icon="office-building-marker" placeholder="Gym Name" value={gymName} onChangeText={setName} />
                        <Input icon="email-outline" placeholder="Business Email" keyboardType="email-address"
                            autoCapitalize="none" value={email} onChangeText={setEmail} />
                        <Input icon="phone" placeholder="Phone Number" keyboardType="phone-pad"
                            value={phone} onChangeText={setPhone} />
                        <Input icon="lock-outline" placeholder="Password" secureTextEntry
                            value={pw} onChangeText={setPw} />

                        <Pressable android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={s.btn} onPress={submit}>
                            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Sign Up</Text>}
                        </Pressable>

                        <Pressable onPress={() => router.push('/(auth)/register')}>
                            <Text style={s.alt}>Register as Member instead</Text>
                        </Pressable>
                    </AuthCard>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const PRIMARY = '#4f46e5';
const s = StyleSheet.create({
    bg: { flex: 1 },
    title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 24, textAlign: 'center' },
    row: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 18, paddingHorizontal: 16, marginBottom: 16
    },
    input: { flex: 1, height: 48, color: '#fff', marginLeft: 8, fontSize: 16 },
    btn: { backgroundColor: PRIMARY, borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
    alt: { textAlign: 'center', color: '#d1d5db' },
});
