import React from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();                  // “light” | “dark”

    const BG = colorScheme === 'dark' ? styles.darkBg : styles.lightBg;
    const TEXT = colorScheme === 'dark' ? styles.darkText : styles.lightText;

    return (
        <View style={[styles.container, BG]}>
            <Text style={styles.code}>404</Text>

            <Text style={[styles.message, TEXT]}>
                Whoops — that page doesn’t exist.
            </Text>

            <Pressable style={styles.button} onPress={() => router.replace('/')}>
                <Text style={styles.buttonText}>Go to Home</Text>
            </Pressable>
        </View>
    );
}

const PRIMARY = '#7c3aed';      // purple-600
const LIGHT_BG = '#ffffff';
const DARK_BG = '#1a1a1a';
const LIGHT_TXT = '#404040';
const DARK_TXT = '#d4d4d4';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    lightBg: { backgroundColor: LIGHT_BG },
    darkBg: { backgroundColor: DARK_BG },

    code: {
        fontSize: 56,
        fontWeight: '800',
        color: PRIMARY,
        marginBottom: 16,
    },
    message: {
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 32,
    },
    lightText: { color: LIGHT_TXT },
    darkText: { color: DARK_TXT },

    button: {
        backgroundColor: PRIMARY,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
