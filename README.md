# ♛ Hide&Mate — Multijugador Online

Juego de tablero multijugador en tiempo real usando **Firebase Realtime Database** y alojado en **GitHub Pages**.

---

## 📝 DESCRIPCIÓN DEL JUEGO

> **Si quieres modificar las reglas del juego**, edita el archivo `js/game-logic.js`.  
> Allí encontrarás la descripción completa comentada al inicio del archivo.

### Resumen

| Elemento | Descripción |
|---|---|
| **Tablero** | Ajedrez 8×8 con casillas bloqueadas aleatoriamente (10 por defecto) |
| **Buscador** | 1 jugador controla a la **Reina** (♛). Empieza en la esquina inferior derecha |
| **Escondidos** | El resto de jugadores controlan cada uno un **Rey** (♚). Se colocan aleatoriamente **fuera de la línea de visión** de la reina |
| **Visión Reina** | Ve en 8 direcciones de ataque. Muros bloquean la visión. Descubre muros al verlos y los recuerda |
| **Visión Reyes** | Igual que la reina (8 direcciones, muros bloquean). PERO **siempre ven a la reina** en el mapa |
| **Movimiento Reina** | Como reina de ajedrez (cualquier distancia en 8 direcciones). **Límite:** 15 movs (2 jug), 20 (3 jug), 25 (4 jug). No salta muros ni reyes |
| **Movimiento Reyes** | Como rey de ajedrez (1 casilla en cualquier dirección) |
| **Captura** | La reina captura un rey moviéndose a su casilla |
| **Victoria Reina** | Capturar a todos los reyes antes de gastar sus movimientos |
| **Victoria Reyes** | Sobrevivir hasta que la reina gaste todos sus movimientos |
| **Puntuación** | Reina gana → +2 pts. Reyes ganan → +1 pt cada rey vivo. Se acumula entre rondas |

---

## 🚀 GUÍA DE CONFIGURACIÓN COMPLETA

### Índice
1. [Crear el proyecto en Firebase](#1-crear-el-proyecto-en-firebase)
2. [Activar Realtime Database](#2-activar-realtime-database)
3. [Obtener la configuración](#3-obtener-la-configuración)
4. [Configurar reglas de seguridad](#4-configurar-las-reglas-de-seguridad)
5. [Conectar el proyecto](#5-conectar-el-proyecto-con-tu-código)
6. [Publicar en GitHub Pages](#6-publicar-en-github-pages)
7. [Probar con varios jugadores](#7-probar-con-varios-jugadores)

---

### 1. Crear el proyecto en Firebase

1. Ve a [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Haz clic en **"Crear un proyecto"** (o _Add project_)
3. Ponle un nombre, por ejemplo: `mi-juego-multijugador`
4. **Desactiva Google Analytics** (no lo necesitas para esto)
5. Haz clic en **"Crear proyecto"** y espera a que se cree

![Paso 1: Crear proyecto](https://firebase.google.com/images/products/realtime-database/database-overview.png)

---

### 2. Activar Realtime Database

1. En el menú lateral izquierdo, ve a **"Compilación" → "Realtime Database"**
2. Haz clic en **"Crear base de datos"**
3. Selecciona la ubicación más cercana a ti (ej: `europe-west1` para España)
4. En **modo de seguridad**, selecciona **"Comenzar en modo de prueba"** (luego lo configuraremos mejor)
5. Haz clic en **"Habilitar"**

✅ Tu Realtime Database ya está activa. Verás una URL similar a:  
`https://mi-juego-multijugador-default-rtdb.firebaseio.com`

---

### 3. Obtener la configuración

1. En la consola de Firebase, haz clic en el icono de ⚙️ **engranaje** → **"Configuración del proyecto"**
2. Baja hasta la sección **"Tus apps"**
3. Haz clic en **"Agregar app"** → elige el icono **`</>` (Web)**
4. Ponle un apodo (ej: `Mi Juego Web`)
5. **NO marques** "Firebase Hosting" (usaremos GitHub Pages)
6. Haz clic en **"Registrar app"**
7. Verás un bloque de código como este:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "mi-juego-multijugador.firebaseapp.com",
  databaseURL: "https://mi-juego-multijugador-default-rtdb.firebaseio.com",
  projectId: "mi-juego-multijugador",
  storageBucket: "mi-juego-multijugador.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

8. **Copia este objeto completo.** Lo necesitarás para el paso 5.

---

### 4. Configurar las reglas de seguridad

1. En el menú lateral, ve a **"Realtime Database" → pestaña "Reglas"**
2. **Borra** las reglas que haya y pega el contenido del archivo `database.rules.json` de este proyecto:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true,
        "players": {
          "$playerId": {
            ".validate": "newData.hasChildren(['name', 'connected', 'joinedAt'])"
          }
        },
        "gameState": {
          ".validate": "newData.hasChildren(['phase', 'currentTurn', 'turnOrder'])"
        },
        "messages": {
          "$messageId": {
            ".validate": "newData.hasChildren(['playerId', 'text', 'timestamp', 'type'])"
          }
        }
      }
    }
  }
}
```

3. Haz clic en **"Publicar"**

✅ Estas reglas permiten que cualquiera lea/escriba en las salas de juego, pero validan que los datos tengan la estructura correcta.

---

### 5. Conectar el proyecto con tu código

1. Abre el archivo **`js/firebase-config.js`** de este proyecto
2. **Reemplaza** el objeto `firebaseConfig` con el que copiaste en el paso 3:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxx",    // ← PEGA TUS VALORES AQUÍ
  authDomain: "mi-juego-multijugador.firebaseapp.com",
  databaseURL: "https://mi-juego-multijugador-default-rtdb.firebaseio.com",
  projectId: "mi-juego-multijugador",
  storageBucket: "mi-juego-multijugador.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

3. Guarda el archivo

---

### 6. Publicar en GitHub Pages

#### Opción A: Usando la interfaz web de GitHub

1. Ve a [https://github.com/new](https://github.com/new)
2. Crea un repositorio nuevo (público o privado)
3. Sube todos los archivos de este proyecto a la raíz del repositorio
4. Ve a **Settings → Pages**
5. En **"Branch"**, selecciona `main` y carpeta `/ (root)`
6. Haz clic en **"Save"**
7. Espera ~1 minuto. Tu web estará en:  
   `https://TU-USUARIO.github.io/TU-REPOSITORIO/`

#### Opción B: Usando git (recomendado)

```bash
# Clonar o inicializar el repositorio
git clone https://github.com/TU-USUARIO/TU-REPOSITORIO.git
cd TU-REPOSITORIO

# Copiar todos los archivos de este proyecto a la carpeta
cp -r /ruta/a/mi-juego-online/* .

# Subir a GitHub
git add .
git commit -m "Primera versión del juego"
git push origin main

# Activar GitHub Pages en Settings → Pages → Branch: main → Save
```

---

### 7. Probar con varios jugadores

1. **Abre tu web** en el navegador (la URL de GitHub Pages)
2. Escribe tu nombre y haz clic en **"Crear Sala Nueva"**
3. Aparecerá un **código de 4 letras** (ej: `ABCD`)
4. **Comparte ese código** con tus amigos (WhatsApp, Discord, etc.)
5. Tus amigos abren la misma URL, escriben su nombre, ponen el código y hacen clic en **"Unirse a Sala"**
6. Cuando todos estén, el anfitrión hace clic en **"Iniciar Partida"**

#### Para probar tú solo (varias pestañas):

1. Abre la web en **Pestaña 1** → Crea sala → Copia el código
2. Abre la web en **Pestaña 2** (modo incógnito o navegador distinto) → Únete con el código
3. Abre más pestañas si quieres más jugadores
4. En la Pestaña 1 (anfitrión), haz clic en **"Iniciar Partida"**

---

## 🏗️ ESTRUCTURA DEL PROYECTO

```
mi-juego-online/
├── index.html                  ← Página principal (lobby + juego)
├── js/
│   ├── firebase-config.js      ← 🔧 Configuración de Firebase (RELLENAR)
│   ├── game-infrastructure.js  ← 🏗️ Infraestructura multijugador (NO TOCAR)
│   └── game-logic.js           ← 🎮 Lógica del juego (MODIFICAR AQUÍ)
├── css/
│   └── style.css               ← 🎨 Estilos visuales
├── database.rules.json         ← 🔒 Reglas de seguridad Firebase
└── README.md                   ← 📖 Esta guía
```

### ¿Qué archivo debo modificar?

| Si quieres... | Modifica... |
|---|---|
| Cambiar reglas del juego | `js/game-logic.js` |
| Cambiar colores / estilos | `css/style.css` |
| Cambiar textos / layout | `index.html` |
| Conectar a Firebase | `js/firebase-config.js` |
| Cambiar cómo funciona la red | ❌ NO toques `game-infrastructure.js` |

---

## 🎮 API DE LA INFRAESTRUCTURA

Tu juego (`game-logic.js`) usa esta API para la sincronización online:

```javascript
// Crear / unirse a salas
await game.createRoom("Nombre");           // → { roomCode, playerId }
await game.joinRoom("ABCD", "Nombre");     // → { playerId, roomData }
await game.leaveRoom();

// Tablero (sincronizado automáticamente)
await game.board.set(tableroCompleto);
const tablero = game.board.get();
await game.board.update({ "3/5": "X" });   // Actualizar solo una casilla

// Turnos
await game.turn.set(playerId);
await game.turn.next();
const turno = game.turn.current();
const esMiTurno = game.turn.isMyTurn();
await game.turn.setOrder([p1, p2, p3]);

// Variables personalizadas
await game.vars.set("puntuacion", 100);
const pts = game.vars.get("puntuacion", 0);
await game.vars.increment("contador", 1);

// Objetos personalizados
await game.objects.set("mazo", [...cartas]);
const mazo = game.objects.get("mazo");

// Mensajes
await game.sendMessage("Texto", "accion");

// Control de partida
await game.startGame({ board: tableroInicial });
await game.resetGame();
await game.setWinner(playerId);

// Eventos
game.on("stateChange", (estado) => { ... });
game.on("playerJoin", (jugador) => { ... });
game.on("playerLeave", (jugador) => { ... });
game.on("gameStart", (estado) => { ... });
game.on("message", (msg) => { ... });
game.on("connectionChange", (conectado) => { ... });
```

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### "Firebase no está cargado"
- Asegúrate de que los scripts del CDN de Firebase están en el `<head>` de `index.html` **ANTES** de `firebase-config.js`
- Verifica que tu `firebaseConfig` es correcto

### "La sala no existe"
- El código de sala distingue mayúsculas. Introdúcelo exactamente como te lo dieron
- Las salas vacías se eliminan automáticamente. Si todos salieron, la sala desaparece

### "No puedo mover"
- Solo puedes mover cuando es tu turno (indicador verde)
- Primero haz clic en tu pieza (reina o rey), luego en el destino
- La reina no puede saltar sobre casillas bloqueadas ni reyes
- Los reyes solo se mueven 1 casilla

### "Los cambios no se ven en el otro navegador"
- Verifica que ambos navegadores están en la misma sala (mismo código)
- Comprueba la conexión a internet
- Mira el indicador verde/rojo en la esquina inferior izquierda

### "Quiero más/menos casillas bloqueadas"
- Edita `js/game-logic.js` y cambia `this.CASILLAS_BLOQUEADAS = 10;` al número que quieras

---

## 📊 LÍMITES DEL PLAN GRATUITO (SPARK)

| Concepto | Límite | ¿Suficiente? |
|---|---|---|
| Conexiones simultáneas | 100 | ✅ Sobrado para un juego de mesa |
| Descargas mensuales | 10 GB | ✅ Más que suficiente |
| Datos almacenados | 1 GB | ✅ Miles de partidas |
| Reglas de seguridad | Básicas | ✅ Suficiente para este proyecto |

---

## 🧹 LIMPIEZA AUTOMÁTICA

- ✅ Cuando un jugador cierra el navegador, se le elimina de la sala automáticamente
- ✅ Si el anfitrión se va, se transfiere el rol a otro jugador
- ✅ Las salas vacías se eliminan automáticamente
- ✅ Si un rey es capturado, su jugador pasa a ser espectador

---

¿Preguntas? ¡A jugar! 🎮
