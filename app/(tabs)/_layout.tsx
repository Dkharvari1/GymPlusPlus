import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/* …imports unchanged … */

export default function TabLayout() {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#4f46e5',          // purple-500
          tabBarStyle: { backgroundColor: '#fff' },
        }}
      >
        {/* existing screens */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="home-variant" color={color} size={size} />
            ),
          }}
        />
  
        <Tabs.Screen
          name="bookings"
          options={{
            title: 'Bookings',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calendar-clock" color={color} size={size} />
            ),
          }}
        />
  
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="chat" color={color} size={size} />
            ),
          }}
        />
  
        {/* ——— NEW ① Nutrition ——— */}
        <Tabs.Screen
          name="nutrition"
          options={{
            title: 'Nutrition',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="food-apple" color={color} size={size} />
            ),
          }}
        />
  
        {/* ——— NEW ② QR ——— */}
        <Tabs.Screen
          name="qr"
          options={{
            title: 'QR',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="qrcode-scan" color={color} size={size} />
            ),
          }}
        />
  
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account-circle" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    );
  }
  