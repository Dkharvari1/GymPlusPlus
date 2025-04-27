import { Tabs } from 'expo-router';

export default function AppTabs() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#7c3aed',   // purple-600
            }}
        >
            <Tabs.Screen name="index" options={{ title: 'Home' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        </Tabs>
    );
}
