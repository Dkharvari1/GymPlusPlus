// app/(business)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function BusinessLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#4f46e5',          // purple-500
                tabBarStyle: { backgroundColor: '#fff' },
            }}
            >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: () => <MaterialCommunityIcons name="view-dashboard" size={24} color="#4f46e5" />,
                }}
            />
            <Tabs.Screen
                name="members"
                options={{
                    title: 'Members',
                    tabBarIcon: () => <MaterialCommunityIcons name="account-group" size={24} color="#4f46e5" />,
                }}
            />
            <Tabs.Screen
                name="areas"
                options={{
                    title: 'Areas',
                    tabBarIcon: () => <MaterialCommunityIcons name="floor-plan" size={24} color="#4f46e5" />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: () => <MaterialCommunityIcons name="cog" size={24} color="#4f46e5" />,
                }}
            />
        </Tabs>
    );
}
