import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, Pressable, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import {
    collection, doc, getDocs, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';
import AuthCard from '../../ui/AuthCard';

export default function RegisterMember() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    /* fields */
    const [username, setUser] = useState('');
    const [email, setEmail] = useState('');
    const [height, setH] = useState('');
    const [weight, setW] = useState('');
    const [pw, setPw] = useState('');

    /* gyms */
    const [gyms, setGyms] = useState<{ id: string; name: string }[]>([]);
    const [gymId, setGym] = useState('loading');

    useEffect(() => {
        (async () => {
            const snap = await getDocs(collection(db, 'gyms'));
            const list = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
            list.push({ id: 'join', name: 'Get membership through the app' });
            setGyms(list);
            setGym(list[0]?.id ?? 'join');
        })();
    }, []);

    const num = (s: string) => { const n = Number(s); return isNaN(n) ? null : n; };
    const valid = () =>
        username && email && num(height) !== null && num(weight) !== null && pw.length >= 6;

    async function submit() {
        if (!valid()) { Alert.alert('Fill all fields'); return; }
        setBusy(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
            await updateProfile(cred.user, { displayName: username });
            await setDoc(doc(db, 'users', cred.user.uid), {
                uid: cred.user.uid, role: 'member',
                username, email: email.trim(),
                height: num(height), weight: num(weight),
                gymId: gymId === 'join' ? null : gymId,
                membershipRequested: gymId === 'join',
                createdAt: serverTimestamp(),
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
                        <Text style={s.title}>Create Account</Text>

                        <Input icon="account-outline" placeholder="Username" value={username} onChangeText={setUser} />
                        <Input icon="email-outline" placeholder="Email" keyboardType="email-address" autoCapitalize="none"
                            value={email} onChangeText={setEmail} />
                        <Input icon="human-male-height" placeholder="Height (cm)" keyboardType="numeric"
                            value={height} onChangeText={setH} />
                        <Input icon="scale-bathroom" placeholder="Weight (kg)" keyboardType="numeric"
                            value={weight} onChangeText={setW} />

                        <Text style={s.label}>Select Gym</Text>
                        <View style={s.pickerWrap}>
                            {gyms.length === 0
                                ? <ActivityIndicator color="#fff" />
                                : (
                                    <Picker selectedValue={gymId} style={s.picker} dropdownIconColor="#fff" onValueChange={setGym}>
                                        {gyms.map(g => <Picker.Item key={g.id} label={g.name} value={g.id} color="#000" />)}
                                    </Picker>
                                )}
                        </View>

                        <Input icon="lock-outline" placeholder="Password" secureTextEntry value={pw} onChangeText={setPw} />

                        <Pressable android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={s.btn} onPress={submit}>
                            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Sign Up</Text>}
                        </Pressable>

                        <Pressable onPress={() => router.push('/(auth)/registerGym')}>
                            <Text style={s.alt}>Are you a gym?  Register here →</Text>
                        </Pressable>

                        <Pressable onPress={() => router.back()}>
                            <Text style={s.alt}>Have an account?  Log in</Text>
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
    label: { color: '#d1d5db', marginBottom: 4, marginLeft: 4 },
    pickerWrap: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 18, marginBottom: 16 },
    picker: { color: '#fff' },
    btn: { backgroundColor: PRIMARY, borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
    alt: { textAlign: 'center', color: '#d1d5db', marginBottom: 6 },
});
