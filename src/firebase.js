import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, query, orderByChild, limitToLast } from 'firebase/database';

// Reusing your existing Firebase project for convenience
const firebaseConfig = {
    apiKey: "REDACTED_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebasedatabase.app",
    projectId: "your-project",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "REDACTED_APP_ID"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Function to save or update high score
export async function saveScore(username, score) {
    if (!username) return;

    // Solo guardamos scores de TimeAttack en el leaderboard principal por ahora
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
