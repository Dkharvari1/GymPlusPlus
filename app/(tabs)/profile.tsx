// app/(tabs)/profile.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, Image, ActivityIndicator,
  ScrollView, Modal, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, doc, getDocs, onSnapshot, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { signOut, updateEmail, updateProfile } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../../lib/firebaseConfig';

/* ─────────────────────────────────────────────────────────── */
export default function ProfileScreen() {
  const router = useRouter();
  const user  = auth.currentUser!;
  const uid   = user.uid;

  /* profile fields */
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const [name,   setName]   = useState(user.displayName || '');
  const [email,  setEmail]  = useState(user.email || '');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(user.photoURL || null);

  /* gym */
  const [gymId, setGymId]     = useState<string | null>(null);
  const [gyms,  setGyms]      = useState<{ id: string; name: string }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingGyms, setLoadingGyms] = useState(true);

  /* 🔄 LIVE user doc listener */
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const d = snap.data() as any;
        setHeight(d?.height?.toString() || '');
        setWeight(d?.weight?.toString() || '');
        setGymId(d?.gymId ?? null);          // updates instantly after profile picker saves
        setLoading(false);
      },
      (err) => console.warn('user listener', err.code)
    );
    return unsub;
  }, [uid]);

  /* fetch gyms once */
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'gyms'));
      setGyms(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name })));
      setLoadingGyms(false);
    })();
  }, []);

  /* avatar helpers */
  async function pickAvatar() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], quality: 0.8,
    });
    if (!res.canceled) setAvatarUri(res.assets[0].uri);
  }
  async function uploadAvatar(uri: string) {
    const blob = await (await fetch(uri)).blob();
    const sRef = ref(storage, `avatars/${uid}`);
    await uploadBytes(sRef, blob);
    return await getDownloadURL(sRef);
  }

  /* save core profile */
  async function saveProfile() {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      let photoURL = user.photoURL;
      if (avatarUri && avatarUri !== user.photoURL) photoURL = await uploadAvatar(avatarUri);
      await updateProfile(user, { displayName: name.trim(), photoURL });
      if (email.trim() !== user.email) await updateEmail(user, email.trim());
      await updateDoc(doc(db, 'users', uid), {
        height: Number(height) || null,
        weight: Number(weight) || null,
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  /* commit gym (allows empty string for “no gym”) */
  async function commitGym(id: string) {
    const val = id || null;      // convert "" -> null
    setGymId(val);
    setPickerOpen(false);
    await updateDoc(doc(db, 'users', uid), { gymId: val, updatedAt: serverTimestamp() });
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace('/(auth)/login');
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );

  return (
    <LinearGradient colors={['#312e81', '#4f46e5', '#7c3aed']} style={styles.bg}>
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

        {/* Editable rows */}
        <EditableRow icon="account-outline" value={name}   onChangeText={setName}   editing={editing} placeholder="Name" />
        <EditableRow icon="email-outline"  value={email}  onChangeText={setEmail}  editing={editing} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
        <EditableRow icon="human-male-height" value={height} onChangeText={setHeight} editing={editing} placeholder="Height (cm)" keyboardType="numeric" />
        <EditableRow icon="scale-bathroom" value={weight} onChangeText={setWeight} editing={editing} placeholder="Weight (kg)" keyboardType="numeric" />

        {/* Gym row */}
        <View style={styles.row}>
          <MaterialCommunityIcons name="dumbbell" size={22} color="#6b7280" />
          <Pressable style={{ flex: 1, marginLeft: 8 }} onPress={() => setPickerOpen(true)}>
            <Text style={styles.value}>
              {gymId
                ? gyms.find(g => g.id === gymId)?.name ?? 'Unknown gym'
                : 'No gym selected'}
            </Text>
          </Pressable>
        </View>

        {/* actions */}
        {editing ? (
          <Pressable style={[styles.btn, !name.trim() && { opacity: 0.5 }]} onPress={saveProfile} disabled={saving || !name.trim()}>
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

      {/* Gym picker */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <LinearGradient colors={['#7c3aed', '#4f46e5', '#312e81']} style={{ flex: 1, paddingTop: 60 }}>
          <Text style={styles.modalTitle}>Select your gym</Text>

          {loadingGyms ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
          ) : (
            <Picker
              selectedValue={gymId ?? ''}
              onValueChange={commitGym}
              style={styles.picker}
              dropdownIconColor="#fff"
              itemStyle={{ color: '#fff' }}
              mode={Platform.OS === 'ios' ? 'dialog' : 'dropdown'}
            >
              {/* ❕ “no gym” option */}
              <Picker.Item label="— No gym / use app without a gym —" value="" color="#cbd5e1" />
              {gyms.map(g => (
                <Picker.Item key={g.id} label={g.name} value={g.id} color="#fff" />
              ))}
            </Picker>
          )}

          <Pressable style={styles.modalClose} onPress={() => setPickerOpen(false)}>
            <Text style={styles.modalCloseTxt}>Done</Text>
          </Pressable>
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
}

/* small helper component */
function EditableRow({ icon, value, onChangeText, editing, placeholder, ...props }: any) {
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

/* styles (unchanged) */
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
  value: { flex: 1, marginLeft: 8, fontSize: 16, color: '#e0e7ff' },

  btn: { width: '100%', backgroundColor: PRIMARY, borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutBtn: { backgroundColor: '#475569' },

  modalTitle: { textAlign: 'center', color: '#e0e7ff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  picker: { flex: 1, color: '#fff' },
  modalClose: { padding: 18, alignItems: 'center' },
  modalCloseTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
