// =========================
// FIREBASE CONFIG
// =========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy
}
from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// =========================
// CONFIG
// =========================

const firebaseConfig = {
    apiKey: "AIzaSyBBD9AsoqvIN5En9oMy2iDhqbYF7CY1e-w",
    authDomain: "bdd-enzo-barber.firebaseapp.com",
    projectId: "bdd-enzo-barber",
    storageBucket: "bdd-enzo-barber.firebasestorage.app",
    messagingSenderId: "770352249365",
    appId: "1:770352249365:web:abbf14294d514f7ac5ec1c"
};

// =========================
// INIT
// =========================

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

// =========================
// EXPORTS
// =========================

export {
    db,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy
};