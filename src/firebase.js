import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, query, orderByChild, limitToLast } from 'firebase/database';

// Reusing your existing Firebase project for convenience
const firebaseConfig = {
    apiKey: "AIzaSyBJIa7dDZ3PUWiUWRO23gXZj4peEsMmUEE",
    authDomain: "torre-de-tartas.firebaseapp.com",
    databaseURL: "https://torre-de-tartas-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "torre-de-tartas",
    storageBucket: "torre-de-tartas.firebasestorage.app",
    messagingSenderId: "119201007028",
    appId: "1:119201007028:web:fd25b313bc58656cc15ee1"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Function to save or update high score
export async function saveScore(username, score) {
    if (!username) return;
    const userRef = ref(database, 'bolitas_leaderboard/' + username);

    // Get current score
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
        const currentScore = snapshot.val().score;
        if (score > currentScore) {
            await set(userRef, { score, timestamp: Date.now() });
        }
    } else {
        await set(userRef, { score, timestamp: Date.now() });
    }
}

// Function to get top 10 scores
export async function getLeaderboard() {
    const lbRef = query(ref(database, 'bolitas_leaderboard'), orderByChild('score'), limitToLast(10));
    const snapshot = await get(lbRef);

    const scores = [];
    snapshot.forEach(childSnapshot => {
        scores.push({
            username: childSnapshot.key,
            score: childSnapshot.val().score
        });
    });

    // orderByChild orders ascending, so we reverse it
    return scores.reverse();
}
