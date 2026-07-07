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

## 🧹 LIMPIEZA AUTOMÁTICA

- ✅ Cuando un jugador cierra el navegador, se le elimina de la sala automáticamente
- ✅ Si el anfitrión se va, se transfiere el rol a otro jugador
- ✅ Las salas vacías se eliminan automáticamente
- ✅ Si un rey es capturado, su jugador pasa a ser espectador

---

¿Preguntas? ¡A jugar! 🎮
