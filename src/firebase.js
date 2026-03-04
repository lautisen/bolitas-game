import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';

// Reusing your existing Firebase project for convenience
const firebaseConfig = {
    apiKey: "AIzaSyCCL-H1wcRJw9QIDAWQYLNnb5daegm3VA4",
    authDomain: "bolitas-game.firebaseapp.com",
    databaseURL: "https://bolitas-game-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bolitas-game",
    storageBucket: "bolitas-game.firebasestorage.app",
    messagingSenderId: "728484913932",
    appId: "1:728484913932:web:ef445241159d5ad9985f29",
    measurementId: "G-5ZKQ41JR7L"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to save or update high score
export async function saveScore(username, score) {
    if (!username) return;

    try {
        const userRef = doc(db, 'bolitas_leaderboard', username);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
            const currentScore = snapshot.data().score;
            if (score > currentScore) {
                await setDoc(userRef, { score: score, timestamp: Date.now() }, { merge: true });
            }
        } else {
            await setDoc(userRef, { score: score, timestamp: Date.now() });
        }
    } catch (error) {
        console.error("Error saving score to Firestore: ", error);
    }
}

// Function to get top 10 scores
export async function getLeaderboard() {
    try {
        const lbRef = collection(db, 'bolitas_leaderboard');
        const q = query(lbRef, orderBy('score', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);

        const scores = [];
        querySnapshot.forEach((doc) => {
            scores.push({
                username: doc.id,
                score: doc.data().score
            });
        });

        return scores;
    } catch (error) {
        console.error("Error getting leaderboard from Firestore: ", error);
        return [];
    }
}
