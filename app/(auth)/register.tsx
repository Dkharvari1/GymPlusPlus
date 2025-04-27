import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RectButton } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import {
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
} from 'firebase/auth';
import {
    doc,
    setDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';
import AuthCard from '../../ui/AuthCard';

export default function RegisterScreen() {
    const router = useRouter();

    // ───────────────────────────── form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [biz, setBiz] = useState(false);
    const [busy, setBusy] = useState(false);

    // ───────────────────────────── main action
    async function register() {
        if (!name || !email || !pw) {
            Alert.alert('Missing information', 'Please fill in all fields.');
            return;
        }

        setBusy(true);

        try {
            // 1. Auth account
            const cred = await createUserWithEmailAndPassword(
                auth,
                email.trim(),
                pw
            );

            // 2. Auth profile (displayName)
            await updateProfile(cred.user, { displayName: name });

            // 3. Firestore profile
            await setDoc(
                doc(db, 'users', cred.user.uid),
                {
                    uid: cred.user.uid,
                    name,
                    email: email.trim(),
                    role: biz ? 'business' : 'member',
                    isBusiness: biz,
                    photoURL: cred.user.photoURL ?? null,
                    createdAt: serverTimestamp(),
                    lastLoginAt: serverTimestamp(),
                },
                { merge: true }
            );

            // 4. (optional) email verification
            // await sendEmailVerification(cred.user);

            // 5. Navigate to logged-in stack
            router.replace('/(tabs)');
        } catch (err: any) {
            console.error(err);
            Alert.alert('Sign-up failed', err.message);
        } finally {
            setBusy(false);
        }
    }

    // ───────────────────────────── UI
    return (
        <LinearGradient
            colors={['#312e81', '#4f46e5', '#7c3aed']}
            style={styles.bg}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ width: '100%' }}
            >
                <AuthCard>
                    <Text style={styles.title}>Create Account</Text>

                    {/* name */}
                    <InputRow
                        icon="account-outline"
                        placeholder="Name"
                        value={name}
                        onChangeText={setName}
                    />

                    {/* email */}
                    <InputRow
                        icon="email-outline"
                        placeholder="Email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />

                    {/* password */}
                    <InputRow
                        icon="lock-outline"
                        placeholder="Password"
                        secureTextEntry
                        value={pw}
                        onChangeText={setPw}
                    />

                    {/* biz toggle */}
                    <RectButton
                        rippleColor="rgba(124,58,237,0.2)"
                        style={[styles.roleBtn, biz && styles.roleBtnActive]}
                        onPress={() => setBiz((v) => !v)}
                    >
                        <Text style={[styles.roleTxt, biz && styles.roleTxtActive]}>
                            {biz ? '✓  Registering as Business' : 'Register as Business'}
                        </Text>
                    </RectButton>

                    {/* primary button */}
                    <RectButton
                        style={styles.btn}
                        onPress={register}
                        enabled={!busy}
                    >
                        {busy ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnText}>Sign Up</Text>
                        )}
                    </RectButton>

                    {/* switch to login */}
                    <Text style={styles.switchTxt}>
                        Have an account?
                        <Text
                            style={styles.switchLink}
                            onPress={() => router.back()}
                        >
                            {'  '}Log in
                        </Text>
                    </Text>
                </AuthCard>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

// ───────────────────────────── reusable input row
function InputRow(props: any) {
    return (
        <View style={styles.inputWrap}>
            <MaterialCommunityIcons
                name={props.icon}
                size={22}
                color="#6b7280"
            />
            <TextInput
                {...props}
                placeholderTextColor="#9ca3af"
                style={styles.input}
            />
        </View>
    );
}

// ───────────────────────────── styles
const PRIMARY = '#4f46e5';

const styles = StyleSheet.create({
    bg: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 24,
        textAlign: 'center',
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 18,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    input: {
        flex: 1,
        height: 48,
        color: '#fff',
        marginLeft: 8,
        fontSize: 16,
    },
    roleBtn: {
        borderWidth: 1.5,
        borderColor: '#a78bfa',
        borderRadius: 18,
        paddingVertical: 10,
        alignItems: 'center',
        marginBottom: 20,
    },
    roleBtnActive: { backgroundColor: PRIMARY },
    roleTxt: {
        fontSize: 15,
        fontWeight: '600',
        color: '#a78bfa',
    },
    roleTxtActive: { color: '#fff' },
    btn: {
        backgroundColor: PRIMARY,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    switchTxt: {
        textAlign: 'center',
        color: '#d1d5db',
    },
    switchLink: {
        color: '#fff',
        fontWeight: '600',
    },
});
