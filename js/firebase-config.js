/**
 * ============================================================
 * CONFIGURACIÓN DE FIREBASE
 * ============================================================
 * 
 * INSTRUCCIONES:
 * 1. Ve a https://console.firebase.google.com/
 * 2. Crea un nuevo proyecto (o usa uno existente)
 * 3. Ve a "Configuración del proyecto" > "Tus apps" > "Agregar app" > Web
 * 4. Copia el objeto firebaseConfig que te proporcionan
 * 5. Pega esos valores aquí debajo, reemplazando los placeholders
 * 
 * EJEMPLO de cómo debería quedar:
 *   const firebaseConfig = {
 *     apiKey: "AIzaSyD-xxxxxxxxxxxxxxxxxxxxx",
 *     authDomain: "mi-juego-multijugador.firebaseapp.com",
 *     databaseURL: "https://mi-juego-multijugador-default-rtdb.firebaseio.com",
 *     projectId: "mi-juego-multijugador",
 *     storageBucket: "mi-juego-multijugador.appspot.com",
 *     messagingSenderId: "123456789012",
 *     appId: "1:123456789012:web:abcdef1234567890"
 *   };
 */

const firebaseConfig = {
  apiKey: "AIzaSyAUaUGBzQLzY_oZokkTGfwudVOyK8vABUs",
  authDomain: "mi-juego-hide-and-mate.firebaseapp.com",
  databaseURL: "https://mi-juego-hide-and-mate-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mi-juego-hide-and-mate",
  storageBucket: "mi-juego-hide-and-mate.firebasestorage.app",
  messagingSenderId: "790595265181",
  appId: "1:790595265181:web:35fe793b5ab80e53702a74"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencia global a la base de datos
const database = firebase.database();

console.log("✅ Firebase inicializado correctamente");
