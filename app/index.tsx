// app/index.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';   // wherever your AuthContext lives
import { Redirect } from 'expo-router';

export default function Index() {
    const { user, loading } = useAuth();

    if (loading) {
        // or show a spinner...
        return null;
    }

    // If no user, send to login; otherwise send to home tabs
    return <Redirect href={'/login'} />;
}
