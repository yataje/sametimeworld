import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyC3K0DIlCqOvHOsezWfeymHUng8mjR7AOs',
  authDomain: 'sametimeworld.firebaseapp.com',
  databaseURL: 'https://sametimeworld-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'sametimeworld',
  storageBucket: 'sametimeworld.firebasestorage.app',
  messagingSenderId: '216343557917',
  appId: '1:216343557917:web:5faf26bece10fe49b293f4',
  measurementId: 'G-T4XKT8GQBW',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const database = getDatabase(firebaseApp);
