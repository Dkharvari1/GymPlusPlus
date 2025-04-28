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
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { signOut, updateProfile, updateEmail } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../lib/firebaseConfig";

/**
 * ProfileScreen — matches the app's purple gradient theme.
 * Features:
 *  • avatar upload to Firebase Storage
 *  • inline editing of display name, email, height & weight
 *  • save (updates Auth + Firestore) / cancel
 *  • log out
 */
export default function ProfileScreen() {
    const user = auth.currentUser!;

    /* remote profile data */
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    /* editable copies */
    const [name, setName] = useState(user.displayName || "");
    const [email, setEmail] = useState(user.email || "");
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [avatarUri, setAvatarUri] = useState<string | null>(user.photoURL);

    /* fetch Firestore doc */
    useEffect(() => {
        (async () => {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists()) {
                const d = snap.data();
                setProfile(d);
                setHeight(d.height?.toString() ?? "");
                setWeight(d.weight?.toString() ?? "");
            }
            setLoading(false);
        })();
    }, []);

    /* ───── avatar helpers ───── */
    async function pickAvatar() {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.75,
        });
        if (res.canceled) return;
        setAvatarUri(res.assets[0].uri);
    }

    async function uploadAvatar(uri: string): Promise<string> {
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(fileRef, blob);
        return await getDownloadURL(fileRef);
    }

    /* ───── save profile ───── */
    async function save() {
        if (!name) return;
        setSaving(true);
        try {
            let photoURL = user.photoURL;
            if (avatarUri && avatarUri !== user.photoURL) {
                photoURL = await uploadAvatar(avatarUri);
            }
            if (photoURL !== user.photoURL || name !== user.displayName) {
                await updateProfile(user, { displayName: name, photoURL });
            }
            if (email !== user.email) {
                await updateEmail(user, email);
            }
            await updateDoc(doc(db, "users", user.uid), {
                height: Number(height) || null,
                weight: Number(weight) || null,
                updatedAt: new Date(),
            });
            setEditing(false);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    }

    /* sign out */
    function logout() {
        signOut(auth);
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
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
            >
                {/* avatar */}
                <Pressable onPress={editing ? pickAvatar : undefined}>
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

                {/* editable rows */}
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

                {/* buttons */}
                {editing ? (
                    <Pressable
                        style={[styles.btn, !name && { opacity: 0.4 }]}
                        onPress={save}
                        disabled={saving || !name}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnTxt}>Save</Text>
                        )}
                    </Pressable>
                ) : (
                    <Pressable style={styles.btn} onPress={() => setEditing(true)}>
                        <Text style={styles.btnTxt}>Edit Profile</Text>
                    </Pressable>
                )}

                <Pressable style={[styles.btn, styles.logoutBtn]} onPress={logout}>
                    <Text style={styles.btnTxt}>Log out</Text>
                </Pressable>
            </ScrollView>
        </LinearGradient>
    );
}

/* helper for editable row */
function EditableRow({
    icon,
    value,
    onChangeText,
    editing,
    placeholder,
    ...inputProps
}: {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
    value: string;
    onChangeText: (t: string) => void;
    editing: boolean;
    placeholder: string;
    [k: string]: any;
}) {
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
                    {...inputProps}
                />
            ) : (
                <Text style={styles.value}>{value || "–"}</Text>
            )}
        </View>
    );
}

/* ──────────────────────────────────────────────────────────────── */
const PRIMARY = "#4f46e5";
const styles = StyleSheet.create({
    bg: { flex: 1 },
    container: {
        alignItems: "center",
        padding: 24,
        paddingTop: 40,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#312e81",
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 16,
        borderWidth: 3,
        borderColor: "rgba(255,255,255,0.45)",
    },
    avatarPlaceholder: {
        backgroundColor: "#475569",
        alignItems: "center",
        justifyContent: "center",
    },
    cameraBadge: {
        position: "absolute",
        bottom: 4,
        right: 4,
        backgroundColor: PRIMARY,
        borderRadius: 12,
        padding: 4,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.25)",
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 12,
        height: 48,
        width: "100%",
    },
    input: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: "#fff",
    },
    value: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: "#fff",
    },
    btn: {
        backgroundColor: PRIMARY,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: "center",
        width: "100%",
        marginTop: 12,
    },
    logoutBtn: { backgroundColor: "#ef4444" },
    btnTxt: { color: "#fff", fontSize: 16, fontWeight: "600" },
});