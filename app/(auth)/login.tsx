import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import AuthCard from '../../ui/AuthCard';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [busy, setBusy] = useState(false);

    async function handleLogin() {
        setBusy(true);
        try {
            await login(email.trim(), pw);
            // after login, determine user role
            const uid = auth.currentUser!.uid;
            const userSnap = await getDoc(doc(db, 'users', uid));
            const data = userSnap.exists() ? (userSnap.data() as any) : {};
            if (data.role === 'business') {
                // navigate to dashboard screen for gym owners
                router.replace('/dashboard');
            } else {
                // navigate to main tabs for regular members
                router.replace('/(tabs)');
            }
        } catch (e: any) {
            Alert.alert('Login failed', e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <LinearGradient
            colors={['#7c3aed', '#4f46e5', '#312e81']}
            style={styles.bg}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
        >
            <AuthCard>
                <Text style={styles.title}>Welcome Back</Text>

                <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="email-outline" size={22} color="#6b7280" />
                    <TextInput
                        placeholder="Email"
                        placeholderTextColor="#9ca3af"
                        style={styles.input}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>

                <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="lock-outline" size={22} color="#6b7280" />
                    <TextInput
                        placeholder="Password"
                        placeholderTextColor="#9ca3af"
                        style={styles.input}
                        secureTextEntry
                        value={pw}
                        onChangeText={setPw}
                    />
                </View>

                <Pressable
                    style={styles.btn}
                    onPress={handleLogin}
                    disabled={busy}
                    android_ripple={{ color: '#e0e7ff' }}
                >
                    {busy ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.btnText}>Log In</Text>
                    )}
                </Pressable>

                <Text style={styles.switchTxt}>
                    New here?
                    <Text
                        style={styles.switchLink}
                        onPress={() => router.push('/register')}
                    >
                        {' '}Create account
                    </Text>
                </Text>
            </AuthCard>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 24, textAlign: 'center' },

    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 18,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    input: { flex: 1, height: 48, color: '#fff', marginLeft: 8, fontSize: 16 },

    btn: {
        backgroundColor: '#4f46e5',
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 16,
        width: '100%',
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    switchTxt: { textAlign: 'center', color: '#d1d5db' },
    switchLink: { color: '#fff', fontWeight: '600' },
});
