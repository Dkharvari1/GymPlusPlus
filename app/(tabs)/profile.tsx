import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    Image,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut, updateProfile, updateEmail } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useRouter } from "expo-router";
import { auth, db, storage } from "../../lib/firebaseConfig";

export default function ProfileScreen() {
    const router = useRouter();
    const user = auth.currentUser!;
    const uid = user.uid;

    /* remote profile data */
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    /* editable state */
    const [name, setName] = useState(user.displayName || "");
    const [email, setEmail] = useState(user.email || "");
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [avatarUri, setAvatarUri] = useState<string | null>(user.photoURL || null);

    /* fetch Firestore user doc */
    useEffect(() => {
        (async () => {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
                const data = snap.data();
                setProfile(data);
                setHeight(data.height?.toString() || "");
                setWeight(data.weight?.toString() || "");
            }
            setLoading(false);
        })();
    }, []);

    /* pick new avatar */
    async function pickAvatar() {
        const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!granted) return;
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!res.canceled) {
            setAvatarUri(res.assets[0].uri);
        }
    }

    async function uploadAvatar(uri: string): Promise<string> {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const storageRef = ref(storage, `avatars/${uid}`);
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    }

    /* save changes */
    async function saveProfile() {
        if (!name.trim() || !email.trim()) return;
        setSaving(true);
        try {
            let photoURL = user.photoURL;
            if (avatarUri && avatarUri !== user.photoURL) {
                photoURL = await uploadAvatar(avatarUri);
            }
            // update auth profile
            await updateProfile(user, { displayName: name.trim(), photoURL });
            if (email.trim() !== user.email) {
                await updateEmail(user, email.trim());
            }
            // update Firestore doc
            await updateDoc(doc(db, "users", uid), {
                height: Number(height) || null,
                weight: Number(weight) || null,
                email: email.trim(),
                updatedAt: serverTimestamp(),
            });
            setEditing(false);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    }

    /* logout and navigate to login */
    async function handleLogout() {
        await signOut(auth);
        router.replace('/(auth)/login');
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
            colors={["#312e81", "#4f46e5", "#7c3aed"]}
            style={styles.bg}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
        >
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                {/* Avatar */}
                <Pressable onPress={editing ? pickAvatar : undefined} style={{ marginBottom: 24 }}>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <MaterialCommunityIcons name="account" size={64} color="#94a3b8" />
                        </View>
                    )}
                    {editing && (
                        <View style={styles.cameraBadge}>
                            <MaterialCommunityIcons name="camera" size={20} color="#fff" />
                        </View>
                    )}
                </Pressable>

                {/* Editable fields */}
                <EditableRow
                    icon="account-outline"
                    value={name}
                    onChangeText={setName}
                    editing={editing}
                    placeholder="Name"
                />
                <EditableRow
                    icon="email-outline"
                    value={email}
                    onChangeText={setEmail}
                    editing={editing}
                    placeholder="Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
                <EditableRow
                    icon="human-male-height"
                    value={height}
                    onChangeText={setHeight}
                    editing={editing}
                    placeholder="Height (cm)"
                    keyboardType="numeric"
                />
                <EditableRow
                    icon="scale-bathroom"
                    value={weight}
                    onChangeText={setWeight}
                    editing={editing}
                    placeholder="Weight (kg)"
                    keyboardType="numeric"
                />

                {/* Action buttons */}
                {editing ? (
                    <Pressable
                        style={[styles.btn, !name.trim() && { opacity: 0.5 }]}
                        onPress={saveProfile}
                        disabled={saving || !name.trim()}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Save</Text>}
                    </Pressable>
                ) : (
                    <Pressable style={styles.btn} onPress={() => setEditing(true)}>
                        <Text style={styles.btnTxt}>Edit Profile</Text>
                    </Pressable>
                )}
                <Pressable style={[styles.btn, styles.logoutBtn]} onPress={handleLogout}>
                    <Text style={styles.btnTxt}>Log Out</Text>
                </Pressable>
            </ScrollView>
        </LinearGradient>
    );
}

function EditableRow({
    icon,
    value,
    onChangeText,
    editing,
    placeholder,
    ...props
}: any) {
    return (
        <View style={styles.row}>
            <MaterialCommunityIcons name={icon} size={22} color="#6b7280" />
            {editing ? (
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#9ca3af"
                    {...props}
                />
            ) : (
                <Text style={styles.value}>{value || '–'}</Text>
            )}
        </View>
    );
}

const PRIMARY = '#4f46e5';
const styles = StyleSheet.create({
    bg: { flex: 1 },
    container: { alignItems: 'center', padding: 24, paddingTop: 80 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#312e81' },
    avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 16, borderWidth: 3, borderColor: 'rgba(255,255,255,0.45)' },
    avatarPlaceholder: { backgroundColor: '#475569', justifyContent: 'center', alignItems: 'center' },
    cameraBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: PRIMARY, borderRadius: 12, padding: 4 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 16, paddingHorizontal: 16, marginBottom: 12, height: 48, width: '100%' },
    input: { flex: 1, marginLeft: 8, fontSize: 16, color: '#fff' },
    value: { flex: 1, marginLeft: 8, fontSize: 16, color: '#fff' },
    btn: { backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', width: '100%', marginTop: 12 },
    logoutBtn: { backgroundColor: '#ef4444' },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});