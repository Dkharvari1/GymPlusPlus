import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { auth } from '../../lib/firebaseConfig';

export default function ProfileScreen() {
    const user = auth.currentUser;

    return (
        <View style={styles.container}>
            <Text style={styles.name}>{user?.displayName ?? 'User'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {/* add edit-profile, logout, etc. here */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
    email: { fontSize: 16, color: '#64748b' },
});
