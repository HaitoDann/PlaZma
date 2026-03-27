const firebaseConfig = {
  apiKey:            "AIzaSyAKwNEbNa6f40oSMwGp6dcDY1ZY6hUN1Ks",          // ← ta valeur
  authDomain:        "plazma-esport.firebaseapp.com",
  projectId:         "plazma-esport",
  storageBucket:     "plazma-esport.firebasestorage.app",
  messagingSenderId: "534325929279",
  appId:             "1:534325929279:web:b507a46c601fa6625edf8a"
};

// Initialisation Firebase (v9 compat — fonctionne via CDN)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ↓ Exporte la fonction de sync pour toutes les pages
function syncToFirestore(collection, docId, data) {
  return db.collection(collection).doc(docId).set(data);
}

function listenFirestore(collection, docId, callback) {
  return db.collection(collection).doc(docId)
    .onSnapshot(doc => {
      if (doc.exists) callback(doc.data());
    });
}