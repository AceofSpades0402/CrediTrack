// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAcy7G-p3fCtC1m9w7eBg53yLRKpg9MVHk",
    authDomain: "microcredit-app-abdae.firebaseapp.com",
    projectId: "microcredit-app-abdae",
    storageBucket: "microcredit-app-abdae.firebasestorage.app",
    messagingSenderId: "796640134803",
    appId: "1:796640134803:web:7a552f9fbbacb2ef372f66",
    measurementId: "G-JPXSC3FEZE"
};

// Initialize Firebase
// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);