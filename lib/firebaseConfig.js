// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
    initializeAuth,            // ← RN-specific initialiser
    getAuth,
    getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBTiKlMV0qk4s8H29OO-Wg6NReWwjHtoNk",
    authDomain: "gymplusplus-d3240.firebaseapp.com",
    projectId: "gymplusplus-d3240",
    storageBucket: "gymplusplus-d3240.firebasestorage.app",
    messagingSenderId: "900504310058",
    appId: "1:900504310058:web:12366371198d6314254e53"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

