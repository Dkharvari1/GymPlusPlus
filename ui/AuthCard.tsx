import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export default function AuthCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
        padding: 28,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        backdropFilter: 'blur(12px)',         // web only; ignored native
    },
});
