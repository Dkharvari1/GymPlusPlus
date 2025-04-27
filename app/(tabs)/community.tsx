import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CommunityScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.txt}>💬  Community chat feed coming soon.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    txt: { fontSize: 16, color: '#475569', textAlign: 'center', paddingHorizontal: 32 },
});
