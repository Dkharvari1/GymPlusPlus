import React, { useState } from 'react';
import {
    View, Text, TextInput,
    StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RectButton } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';
import AuthCard from '../../ui/AuthCard';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [busy, setBusy] = useState(false);

    async function login() {
        setBusy(true);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), pw);
            router.replace('/(tabs)');
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
            start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        >
            <AuthCard>
                <Text style={styles.title}>Welcome Back</Text>

                {/* email */}
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

                {/* password */}
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

                {/* primary button */}
                <RectButton rippleColor="#e0e7ff" style={styles.btn} onPress={login} enabled={!busy}>
                    {busy ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.btnText}>Log In</Text>
                    )}
                </RectButton>

                {/* switch */}
                <Text style={styles.switchTxt}>
                    New here?
                    <Text style={styles.switchLink} onPress={() => router.push('/(auth)/register')}>  Create account</Text>
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
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    switchTxt: { textAlign: 'center', color: '#d1d5db' },
    switchLink: { color: '#fff', fontWeight: '600' },
});
