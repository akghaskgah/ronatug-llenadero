// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.15.0/firebase-firestore.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAmmppwXIbv8a_CHYlYmncszryWnwZfKh8",
  authDomain: "ronatug-app.firebaseapp.com",
  projectId: "ronatug-app",
  storageBucket: "ronatug-app.firebasestorage.app",
  messagingSenderId: "522890399950",
  appId: "1:522890399950:web:69123d81fb384896b0409f",
  measurementId: "G-XN19GS0ZBG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);