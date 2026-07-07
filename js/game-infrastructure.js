/**
 * ============================================================
 * INFRAESTRUCTURA MULTIJUGADOR ONLINE
 * ============================================================
 * 
 * Esta clase proporciona TODO lo necesario para que tu juego
 * funcione como multijugador online SIN que tengas que escribir
 * ni una sola línea de comunicación de red.
 * 
 * USO BÁSICO (desde game-logic.js):
 * 
 *   const game = new GameInfrastructure();
 *   
 *   // Crear sala
 *   const { roomCode } = await game.createRoom("Jugador1");
 *   
 *   // Unirse a sala
 *   await game.joinRoom("ABCD", "Jugador2");
 *   
 *   // Escuchar cambios
 *   game.on("stateChange", (estado) => {
 *     // Se ejecuta CADA VEZ que el estado cambia en Firebase
 *     actualizarInterfaz(estado);
 *   });
 *   
 *   // Modificar el tablero (se sincroniza automáticamente)
 *   game.board.set({ row: 3, col: 5, valor: "X" });
 *   
 *   // Leer el tablero
 *   const tablero = game.board.get();
 *   
 *   // Gestionar turnos
 *   game.turn.set("playerId123");
 *   game.turn.next(); // avanza al siguiente jugador
 *   
 *   // Variables personalizadas (puntuaciones, contadores, etc.)
 *   game.vars.set("puntuacion", 100);
 *   const pts = game.vars.get("puntuacion");
 *   
 *   // Objetos personalizados (arrays, objetos complejos)
 *   game.objects.set("cartas", [{ valor: 5, palo: "oros" }]);
 *   const cartas = game.objects.get("cartas");
 *   
 *   // Mensajes / acciones entre jugadores
 *   game.sendMessage("He completado mi turno", "accion");
 *   
 *   // Iniciar / reiniciar partida
 *   game.startGame({ tableroInicial: [...] });
 *   game.resetGame();
 * 
 * ============================================================
 */

class GameInfrastructure {

  // =========================================================================
  // CONSTRUCTOR E INICIALIZACIÓN
  // =========================================================================

  constructor() {
    // Verificar que Firebase está disponible
    if (typeof firebase === 'undefined') {
      throw new Error(
        '❌ Firebase no está cargado.\n' +
        'Asegúrate de incluir estos scripts ANTES de game-infrastructure.js:\n' +
        '  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>\n' +
        '  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>\n' +
        '  <script src="js/firebase-config.js"></script>'
      );
    }

    if (typeof database === 'undefined') {
      throw new Error(
        '❌ La variable "database" no está definida.\n' +
        'Asegúrate de incluir firebase-config.js ANTES de game-infrastructure.js'
      );
    }

    /** @type {firebase.database.Database} */
    this.db = database;

    // =====================================================================
    // ESTADO LOCAL
    // =====================================================================
    
    /** Código de la sala actual (null si no está en ninguna sala) */
    this.roomCode = null;

    /** ID único de este jugador */
    this.playerId = null;

    /** Nombre del jugador */
    this.playerName = null;

    /** ¿Es este jugador el anfitrión? */
    this.isHost = false;

    /** ¿Está conectado a Firebase? */
    this.connected = false;

    /** Copia local del estado del juego (se actualiza automáticamente) */
    this._gameState = null;

    /** Copia local de los jugadores en la sala */
    this._players = {};

    /** Cola de mensajes locales */
    this._messages = [];

    /** Turno actual (copia local) */
    this._currentTurn = null;

    /** Orden de turnos (copia local) */
    this._turnOrder = [];

    // =====================================================================
    // REFERENCIAS A LISTENERS (para poder limpiarlos al salir)
    // =====================================================================
    this._activeListeners = [];

    // =====================================================================
    // SISTEMA DE CALLBACKS / EVENTOS
    // =====================================================================
    this._eventCallbacks = {
      stateChange: [],     // (gameState)        -> cuando cambia el estado del juego
      playerJoin: [],      // (player)           -> cuando un jugador se une
      playerLeave: [],     // (player)           -> cuando un jugador se va
      playersUpdate: [],   // (players)          -> cuando se recibe la lista inicial de jugadores
      gameStart: [],       // (gameState)        -> cuando la partida empieza
      message: [],         // (message)          -> cuando llega un mensaje
      connectionChange: [],// (connected: bool)  -> cuando cambia la conexión
      error: []            // (error)            -> cuando ocurre un error
    };

    // =====================================================================
    // INICIALIZACIÓN
    // =====================================================================

    // Intentar recuperar sesión anterior (para reconexión tras recargar)
    this._loadSession();

    // Escuchar el estado de conexión a Firebase
    this._setupConnectionMonitor();
  }

  // =========================================================================
  // SISTEMA DE EVENTOS
  // =========================================================================

  /**
   * Registra un callback para un evento.
   * 
   * Eventos disponibles:
   *   "stateChange"      - El estado del juego cambió (tablero, turnos, etc.)
   *   "playerJoin"       - Un jugador se unió a la sala
   *   "playerLeave"      - Un jugador abandonó la sala
   *   "gameStart"        - La partida comenzó
   *   "message"          - Se recibió un mensaje/acción
   *   "connectionChange" - La conexión a Firebase cambió (online/offline)
   *   "error"            - Ocurrió un error
   * 
   * @param {string} event - Nombre del evento
   * @param {Function} callback - Función a ejecutar cuando ocurra
   * 
   * Ejemplo:
   *   game.on("stateChange", (gameState) => {
   *     console.log("El estado cambió:", gameState);
   *     renderizarTablero(gameState.board);
   *   });
   */
  on(event, callback) {
    if (!this._eventCallbacks[event]) {
      console.warn(`⚠️ Evento desconocido: "${event}". Eventos válidos: ${Object.keys(this._eventCallbacks).join(', ')}`);
      return;
    }
    this._eventCallbacks[event].push(callback);
  }

  /**
   * Elimina un callback registrado.
   * @param {string} event - Nombre del evento
   * @param {Function} callback - La función a eliminar
   */
  off(event, callback) {
    if (!this._eventCallbacks[event]) return;
    this._eventCallbacks[event] = this._eventCallbacks[event].filter(cb => cb !== callback);
  }

  /**
   * Dispara un evento, ejecutando todos los callbacks registrados.
   * @param {string} event - Nombre del evento
   * @param {*} data - Datos a pasar a los callbacks
   */
  _emit(event, data) {
    const callbacks = this._eventCallbacks[event] || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`❌ Error en callback del evento "${event}":`, err);
      }
    });
  }

  // =========================================================================
  // MONITOR DE CONEXIÓN
  // =========================================================================

  /**
   * Configura el listener de conexión a Firebase.
   * Detecta cuando el cliente se conecta/desconecta del servidor de Firebase.
   */
  _setupConnectionMonitor() {
    const connectedRef = this.db.ref('.info/connected');
    
    connectedRef.on('value', (snap) => {
      const wasConnected = this.connected;
      this.connected = snap.val() === true;

      if (wasConnected !== this.connected) {
        console.log(this.connected ? '🟢 Conectado a Firebase' : '🔴 Desconectado de Firebase');
        this._emit('connectionChange', this.connected);
      }
    });
  }

  // =========================================================================
  // GESTIÓN DE SESIÓN (RECONEXIÓN)
  // =========================================================================

  /**
   * Genera un ID único para el jugador.
   * Usa sessionStorage para persistir entre recargas de página
   * (misma pestaña/navegador = mismo jugador).
   */
  _getOrCreatePlayerId() {
    const STORAGE_KEY = 'game_player_id';
    let playerId = sessionStorage.getItem(STORAGE_KEY);
    
    if (!playerId) {
      // Generar ID único: timestamp + random
      playerId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem(STORAGE_KEY, playerId);
    }
    
    return playerId;
  }

  /**
   * Intenta recuperar una sesión anterior (tras recargar la página).
   * Si el jugador estaba en una sala, intenta reconectarse.
   */
  _loadSession() {
    const savedRoom = sessionStorage.getItem('game_room_code');
    const savedPlayerId = this._getOrCreatePlayerId();

    // Si hay una sala guardada, el jugador probablemente recargó la página
    if (savedRoom && savedPlayerId) {
      console.log(`🔄 Detectada sesión previa: sala "${savedRoom}", jugador "${savedPlayerId}"`);
      // La reconexión real ocurre cuando se llama a joinRoom()
    }
  }

  // =========================================================================
  // GESTIÓN DE SALAS
  // =========================================================================

  /**
   * Genera un código de sala único de 4 letras mayúsculas.
   * Comprueba que no exista ya en Firebase (evita colisiones).
   * 
   * @returns {Promise<string>} Código de sala único
   */
  async _generateRoomCode() {
    const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluye I, O (confusas con 1, 0)
    const MAX_INTENTOS = 20;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      // Generar código de 4 letras
      let codigo = '';
      for (let i = 0; i < 4; i++) {
        codigo += LETRAS.charAt(Math.floor(Math.random() * LETRAS.length));
      }

      // Comprobar si ya existe
      const snapshot = await this.db.ref(`rooms/${codigo}`).once('value');
      if (!snapshot.exists()) {
        return codigo;
      }
    }

    throw new Error('No se pudo generar un código de sala único. Inténtalo de nuevo.');
  }

  /**
   * Crea una nueva sala de juego.
   * 
   * @param {string} playerName - Nombre del jugador que crea la sala
   * @param {number} [maxPlayers=4] - Número máximo de jugadores permitidos
   * @returns {Promise<{roomCode: string, playerId: string}>}
   * 
   * Ejemplo:
   *   const { roomCode, playerId } = await game.createRoom("Alice");
   *   console.log(`Sala creada: ${roomCode}`);
   */
  async createRoom(playerName, maxPlayers = 4) {
    if (!playerName || playerName.trim() === '') {
      throw new Error('Debes proporcionar un nombre de jugador.');
    }

    if (this.roomCode) {
      throw new Error('Ya estás en una sala. Sal de la sala actual antes de crear otra.');
    }

    // Generar código único y ID de jugador
    const roomCode = await this._generateRoomCode();
    const playerId = this._getOrCreatePlayerId();

    this.playerId = playerId;
    this.playerName = playerName.trim();
    this.roomCode = roomCode;
    this.isHost = true;

    // Guardar sesión para reconexión
    sessionStorage.setItem('game_room_code', roomCode);

    // Crear la estructura de la sala en Firebase
    const roomData = {
      host: playerId,
      status: 'waiting',        // waiting | playing | finished
      maxPlayers: maxPlayers,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      players: {
        [playerId]: {
          name: this.playerName,
          connected: true,
          joinedAt: firebase.database.ServerValue.TIMESTAMP,
          isHost: true,
          role: null             // Se asignará al iniciar la partida
        }
      },
      gameState: {
        board: null,             // El tablero (lo define el juego)
        phase: 'lobby',          // lobby | playing | finished
        currentTurn: null,       // ID del jugador con el turno actual
        turnOrder: [],           // Array con el orden de turnos
        turnIndex: 0,            // Índice en turnOrder
        winner: null,            // ID del ganador (null = sin ganador)
        custom: {},              // Variables personalizadas
        objects: {}              // Objetos personalizados
      },
      messages: {}
    };

    try {
      await this.db.ref(`rooms/${roomCode}`).set(roomData);
      
      // Configurar onDisconnect: cuando el jugador se desconecte, eliminarlo
      await this._setupDisconnectHandlers();

      // Activar listeners para esta sala
      this._setupRoomListeners();

      console.log(`✅ Sala "${roomCode}" creada correctamente`);
      console.log(`👑 Eres el anfitrión (host)`);

      return { roomCode, playerId };
    } catch (error) {
      // Limpiar estado en caso de error
      this.roomCode = null;
      this.playerId = null;
      this.playerName = null;
      this.isHost = false;
      throw new Error(`Error al crear la sala: ${error.message}`);
    }
  }

  /**
   * Unirse a una sala existente mediante su código.
   * 
   * @param {string} roomCode - Código de 4 letras de la sala
   * @param {string} playerName - Nombre del jugador
   * @returns {Promise<{playerId: string, roomData: Object}>}
   * 
   * Ejemplo:
   *   await game.joinRoom("ABCD", "Bob");
   */
  async joinRoom(roomCode, playerName) {
    if (!roomCode || roomCode.trim() === '') {
      throw new Error('Debes proporcionar un código de sala.');
    }
    if (!playerName || playerName.trim() === '') {
      throw new Error('Debes proporcionar un nombre de jugador.');
    }
    if (this.roomCode) {
      throw new Error('Ya estás en una sala. Sal de la sala actual antes de unirte a otra.');
    }

    const code = roomCode.trim().toUpperCase();
    const playerId = this._getOrCreatePlayerId();

    // Verificar que la sala existe
    const roomSnapshot = await this.db.ref(`rooms/${code}`).once('value');
    if (!roomSnapshot.exists()) {
      throw new Error(`La sala "${code}" no existe. Comprueba el código.`);
    }

    const roomData = roomSnapshot.val();

    // Verificar que la sala no esté llena
    const currentPlayers = roomData.players ? Object.keys(roomData.players).length : 0;
    const maxPlayers = roomData.maxPlayers || 4;
    if (currentPlayers >= maxPlayers) {
      throw new Error(`La sala "${code}" está llena (${currentPlayers}/${maxPlayers}).`);
    }

    // Verificar que la partida no haya empezado ya
    if (roomData.status === 'playing') {
      throw new Error(`La partida en la sala "${code}" ya ha comenzado. No puedes unirte a mitad de partida.`);
    }

    // Unirse a la sala
    this.roomCode = code;
    this.playerId = playerId;
    this.playerName = playerName.trim();
    this.isHost = false;

    sessionStorage.setItem('game_room_code', code);

    try {
      // Añadir jugador a la sala
      await this.db.ref(`rooms/${code}/players/${playerId}`).set({
        name: this.playerName,
        connected: true,
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
        isHost: false,
        role: null
      });

      // Configurar onDisconnect
      await this._setupDisconnectHandlers();

      // Activar listeners
      this._setupRoomListeners();

      console.log(`✅ Te has unido a la sala "${code}"`);
      console.log(`👥 Jugadores en sala: ${currentPlayers + 1}/${maxPlayers}`);

      return { 
        playerId, 
        roomData: {
          host: roomData.host,
          status: roomData.status,
          players: roomData.players
        }
      };
    } catch (error) {
      this.roomCode = null;
      this.playerId = null;
      this.playerName = null;
      sessionStorage.removeItem('game_room_code');
      throw new Error(`Error al unirse a la sala: ${error.message}`);
    }
  }

  /**
   * Abandona la sala actual.
   * Elimina al jugador de la sala y limpia todos los listeners.
   * Si la sala queda vacía, se elimina automáticamente.
   */
  async leaveRoom() {
    if (!this.roomCode || !this.playerId) {
      console.warn('No estás en ninguna sala.');
      return;
    }

    const roomCode = this.roomCode;
    const playerId = this.playerId;

    try {
      // Cancelar onDisconnect antes de eliminar manualmente
      await this.db.ref(`rooms/${roomCode}/players/${playerId}`).onDisconnect().cancel();
      
      // Eliminar al jugador
      await this.db.ref(`rooms/${roomCode}/players/${playerId}`).remove();

      // Si era el host, transferir el host a otro jugador
      if (this.isHost) {
        await this._transferHost(roomCode, playerId);
      }

      // Comprobar si la sala quedó vacía
      await this._checkAndCleanEmptyRoom(roomCode);

    } catch (error) {
      console.error('Error al salir de la sala:', error);
    }

    // Limpiar estado local
    this._cleanup();
    console.log(`👋 Has salido de la sala "${roomCode}"`);
  }

  /**
   * Transfiere el rol de host a otro jugador cuando el host abandona.
   */
  async _transferHost(roomCode, leavingPlayerId) {
    try {
      const playersSnapshot = await this.db.ref(`rooms/${roomCode}/players`).once('value');
      const players = playersSnapshot.val() || {};

      // Buscar otro jugador conectado que no sea el que se va
      const otherPlayers = Object.entries(players).filter(
        ([pid, p]) => pid !== leavingPlayerId && p.connected
      );

      if (otherPlayers.length > 0) {
        // Asignar el host al primer jugador disponible
        const [newHostId] = otherPlayers[0];
        await this.db.ref(`rooms/${roomCode}`).update({
          host: newHostId,
          [`players/${newHostId}/isHost`]: true
        });
        console.log(`👑 Host transferido a ${otherPlayers[0][1].name}`);
      }
    } catch (error) {
      console.error('Error al transferir host:', error);
    }
  }

  /**
   * Comprueba si la sala está vacía y, si es así, la elimina.
   */
  async _checkAndCleanEmptyRoom(roomCode) {
    try {
      const playersSnapshot = await this.db.ref(`rooms/${roomCode}/players`).once('value');
      const players = playersSnapshot.val();

      if (!players || Object.keys(players).length === 0) {
        // Sala vacía: eliminarla
        await this.db.ref(`rooms/${roomCode}`).remove();
        console.log(`🧹 Sala "${roomCode}" eliminada (vacía)`);
      }
    } catch (error) {
      console.error('Error al limpiar sala vacía:', error);
    }
  }

  // =========================================================================
  // MANEJO DE DESCONEXIÓN (onDisconnect)
  // =========================================================================

  /**
   * Configura los handlers de desconexión.
   * Cuando un jugador cierra el navegador o pierde la conexión,
   * Firebase ejecuta automáticamente estas operaciones en el servidor.
   */
  async _setupDisconnectHandlers() {
    if (!this.roomCode || !this.playerId) return;

    const playerRef = this.db.ref(`rooms/${this.roomCode}/players/${this.playerId}`);

    // onDisconnect: cuando el servidor detecte que este cliente se desconectó,
    // marcar al jugador como desconectado y luego eliminarlo
    playerRef.onDisconnect().update({
      connected: false,
      disconnectedAt: firebase.database.ServerValue.TIMESTAMP
    });

    // Además, programar la eliminación del jugador tras un breve retraso
    // (esto permite reconexión rápida si fue un problema temporal de red)
    playerRef.onDisconnect().remove();
  }

  // =========================================================================
  // LISTENERS DE LA SALA (SINCRONIZACIÓN EN TIEMPO REAL)
  // =========================================================================

  /**
   * Configura todos los listeners de Firebase para la sala actual.
   * Estos listeners mantienen el estado local sincronizado con Firebase
   * y disparan los eventos correspondientes.
   */
  _setupRoomListeners() {
    if (!this.roomCode) return;

    const roomRef = this.db.ref(`rooms/${this.roomCode}`);

    // -------------------------------------------------------------------
    // 1. Listener de JUGADORES (cambios en la lista de jugadores)
    // -------------------------------------------------------------------
    const playersRef = roomRef.child('players');
    
    const playersListener = playersRef.on('value', (snapshot) => {
      const oldPlayers = { ...this._players };
      const newPlayers = snapshot.val() || {};
      const isEmpty = Object.keys(oldPlayers).length === 0;

      // Detectar jugadores que se unieron
      Object.keys(newPlayers).forEach(pid => {
        if (!oldPlayers[pid] && pid !== this.playerId) {
          // Este jugador es nuevo
          this._emit('playerJoin', {
            playerId: pid,
            name: newPlayers[pid].name,
            isHost: newPlayers[pid].isHost || false,
            connected: newPlayers[pid].connected
          });
          console.log(`👤 Jugador conectado: ${newPlayers[pid].name}`);
        }
      });

      // Detectar jugadores que se fueron
      Object.keys(oldPlayers).forEach(pid => {
        if (!newPlayers[pid] && pid !== this.playerId) {
          this._emit('playerLeave', {
            playerId: pid,
            name: oldPlayers[pid].name
          });
          console.log(`👋 Jugador desconectado: ${oldPlayers[pid].name}`);
        }
      });

      // Detectar reconexiones
      Object.keys(newPlayers).forEach(pid => {
        if (oldPlayers[pid] && !oldPlayers[pid].connected && newPlayers[pid].connected) {
          console.log(`🔄 Jugador reconectado: ${newPlayers[pid].name}`);
        }
      });

      // Actualizar copia local
      this._players = newPlayers;

      // En la primera carga (oldPlayers vacío), emitir playersUpdate para refrescar UI
      if (isEmpty && Object.keys(newPlayers).length > 0) {
        this._emit('playersUpdate', newPlayers);
      }

      // Si la sala quedó vacía y este cliente sigue conectado, limpiarla
      if (Object.keys(newPlayers).length === 0) {
        this._checkAndCleanEmptyRoom(this.roomCode);
      }
    });
    this._activeListeners.push({ ref: playersRef, event: 'value', handler: playersListener });

    // -------------------------------------------------------------------
    // 2. Listener del ESTADO DEL JUEGO (tablero, turnos, fase, etc.)
    // -------------------------------------------------------------------
    const gameStateRef = roomRef.child('gameState');

    const gameStateListener = gameStateRef.on('value', (snapshot) => {
      const newState = snapshot.val() || {};
      const oldState = this._gameState;

      this._gameState = newState;
      this._currentTurn = newState.currentTurn;
      this._turnOrder = newState.turnOrder || [];

      // Detectar si la partida acaba de empezar
      if (oldState && oldState.phase === 'lobby' && newState.phase === 'playing') {
        this._emit('gameStart', newState);
        console.log('🎮 ¡La partida ha comenzado!');
      }

      // Notificar cambio de estado (siempre)
      this._emit('stateChange', newState);

      // Notificar cambio de turno específicamente (útil para la UI)
      if (oldState && oldState.currentTurn !== newState.currentTurn) {
        console.log(`🔄 Turno de: ${this._getPlayerName(newState.currentTurn)}`);
      }
    });
    this._activeListeners.push({ ref: gameStateRef, event: 'value', handler: gameStateListener });

    // -------------------------------------------------------------------
    // 3. Listener de MENSAJES (acciones y chat entre jugadores)
    // -------------------------------------------------------------------
    const messagesRef = roomRef.child('messages');

    // Solo escuchar mensajes NUEVOS (a partir del último timestamp conocido)
    const messagesListener = messagesRef
      .orderByChild('timestamp')
      .startAt(Date.now())
      .on('child_added', (snapshot) => {
        const msg = snapshot.val();
        msg.id = snapshot.key;
        
        // No procesar nuestros propios mensajes (ya los tenemos localmente)
        if (msg.playerId === this.playerId) return;

        this._messages.push(msg);
        this._emit('message', msg);
      });
    this._activeListeners.push({ ref: messagesRef, event: 'child_added', handler: messagesListener });

    // -------------------------------------------------------------------
    // 4. Listener del STATUS de la sala (waiting / playing / finished)
    // -------------------------------------------------------------------
    const statusRef = roomRef.child('status');

    const statusListener = statusRef.on('value', (snapshot) => {
      const status = snapshot.val();
      console.log(`📊 Estado de la sala: ${status}`);
    });
    this._activeListeners.push({ ref: statusRef, event: 'value', handler: statusListener });

    console.log(`🔊 Listeners activados para la sala "${this.roomCode}"`);
  }

  // =========================================================================
  // API DEL TABLERO (board)
  // =========================================================================

  /**
   * Objeto para gestionar el tablero del juego.
   * Uso: game.board.set(datos) / game.board.get()
   */
  board = {
    /**
     * Actualiza el tablero completo en Firebase.
     * Todos los jugadores recibirán el nuevo tablero instantáneamente.
     * 
     * @param {*} boardData - Los datos del tablero (puede ser array 2D, objeto, lo que necesites)
     * 
     * Ejemplo:
     *   game.board.set([
     *     [0, 0, 1, 0],
     *     [0, 2, 0, 0],
     *     ...
     *   ]);
     */
    set: async (boardData) => {
      if (!this._checkRoom()) return;
      await this.db.ref(`rooms/${this.roomCode}/gameState/board`).set(boardData);
    },

    /**
     * Obtiene el tablero actual desde la copia local.
     * La copia local se actualiza automáticamente desde Firebase.
     * 
     * @returns {*} El tablero actual
     */
    get: () => {
      return this._gameState ? this._gameState.board : null;
    },

    /**
     * Actualiza una parte específica del tablero sin reescribirlo todo.
     * Útil para cambiar una sola casilla.
     * 
     * @param {Object} updates - Objeto con las actualizaciones parciales
     * 
     * Ejemplo:
     *   game.board.update({ "fila3/col5": "X", "fila1/col1": "O" });
     */
    update: async (updates) => {
      if (!this._checkRoom()) return;
      const prefixed = {};
      Object.keys(updates).forEach(key => {
        prefixed[`rooms/${this.roomCode}/gameState/board/${key}`] = updates[key];
      });
      await this.db.ref().update(prefixed);
    }
  };

  // =========================================================================
  // API DE TURNOS (turn)
  // =========================================================================

  turn = {
    /**
     * Establece de quién es el turno actual.
     * @param {string} playerId - ID del jugador
     */
    set: async (playerId) => {
      if (!this._checkRoom()) return;
      await this.db.ref(`rooms/${this.roomCode}/gameState/currentTurn`).set(playerId);
    },

    /**
     * Devuelve el ID del jugador que tiene el turno actual.
     * @returns {string|null}
     */
    current: () => {
      return this._currentTurn;
    },

    /**
     * Avanza el turno al siguiente jugador en turnOrder.
     * Si es el último, vuelve al primero.
     */
    next: async () => {
      if (!this._checkRoom()) return;
      if (!this._turnOrder || this._turnOrder.length === 0) {
        console.warn('⚠️ turnOrder está vacío. Usa game.turn.setOrder() primero.');
        return;
      }

      const currentIndex = this._turnOrder.indexOf(this._currentTurn);
      const nextIndex = (currentIndex + 1) % this._turnOrder.length;
      const nextPlayer = this._turnOrder[nextIndex];

      await this.db.ref(`rooms/${this.roomCode}/gameState`).update({
        currentTurn: nextPlayer,
        turnIndex: nextIndex
      });

      console.log(`🔄 Turno avanzado a: ${this._getPlayerName(nextPlayer)}`);
    },

    /**
     * Establece el orden de turnos completo.
     * @param {string[]} playerIds - Array con los IDs en orden
     * 
     * Ejemplo:
     *   game.turn.setOrder(["player1_id", "player2_id", "player3_id"]);
     */
    setOrder: async (playerIds) => {
      if (!this._checkRoom()) return;
      await this.db.ref(`rooms/${this.roomCode}/gameState/turnOrder`).set(playerIds);
    },

    /**
     * Devuelve el orden de turnos actual.
     * @returns {string[]}
     */
    getOrder: () => {
      return [...this._turnOrder];
    },

    /**
     * Comprueba si es el turno de este jugador.
     * @returns {boolean}
     */
    isMyTurn: () => {
      return this._currentTurn === this.playerId;
    }
  };

  // =========================================================================
  // API DE VARIABLES PERSONALIZADAS (vars)
  // =========================================================================

  vars = {
    /**
     * Establece una variable personalizada en el estado compartido.
     * Se sincroniza automáticamente con todos los jugadores.
     * 
     * @param {string} key - Nombre de la variable
     * @param {*} value - Valor (número, string, booleano, etc.)
     * 
     * Ejemplo:
     *   game.vars.set("puntuacion_jugador1", 100);
     *   game.vars.set("ronda_actual", 3);
     */
    set: async (key, value) => {
      if (!this._checkRoom()) return;
      await this.db.ref(`rooms/${this.roomCode}/gameState/custom/${key}`).set(value);
    },

    /**
     * Lee una variable personalizada desde la copia local.
     * @param {string} key - Nombre de la variable
     * @param {*} [defaultValue=null] - Valor por defecto si no existe
     * @returns {*}
     */
    get: (key, defaultValue = null) => {
      if (!this._gameState || !this._gameState.custom) return defaultValue;
      return this._gameState.custom.hasOwnProperty(key) 
        ? this._gameState.custom[key] 
        : defaultValue;
    },

    /**
     * Devuelve todas las variables personalizadas.
     * @returns {Object}
     */
    getAll: () => {
      return this._gameState ? (this._gameState.custom || {}) : {};
    },

    /**
     * Elimina una variable personalizada.
     * @param {string} key
     */
    remove: async (key) => {
      if (!this._checkRoom()) return;
      await this.db.ref(`rooms/${this.roomCode}/gameState/custom/${key}`).remove();
    },

    /**
     * Incrementa una variable numérica.
     * @param {string} key - Nombre de la variable
     * @param {number} [amount=1] - Cantidad a incrementar
     */
    increment: async (key, amount = 1) => {
      const current = this.vars.get(key, 0);
      await this.vars.set(key, current + amount);
    }
  };

  // =========================================================================
  // API DE OBJETOS PERSONALIZADOS (objects)
  // =========================================================================

  objects = {
    /**
     * Establece un objeto personalizado en el estado compartido.
     * Útil para mazos de cartas, listas de items, configuraciones, etc.
     * 
     * @param {string} key - Nombre del objeto
     * @param {*} value - El objeto (array, objeto, lo que necesites)
     * 
     * Ejemplo:
     *   game.objects.set("mazo", [
     *     { valor: 1, palo: "oros" },
     *     { valor: 5, palo: "copas" }
     *   ]);
     */
    set: async (key, value) => {
      if (!this._checkRoom()) return;
      await this.db.ref(`rooms/${this.roomCode}/gameState/objects/${key}`).set(value);
    },

    /**
     * Lee un objeto personalizado desde la copia local.
     * @param {string} key - Nombre del objeto
     * @param {*} [defaultValue=null] - Valor por defecto
     * @returns {*}
     */
    get: (key, defaultValue = null) => {
      if (!this._gameState || !this._gameState.objects) return defaultValue;
      return this._gameState.objects.hasOwnProperty(key)
        ? this._gameState.objects[key]
        : defaultValue;
    },

    /**
     * Devuelve todos los objetos personalizados.
     * @returns {Object}
     */
    getAll: () => {
      return this._gameState ? (this._gameState.objects || {}) : {};
    },

    /**
     * Elimina un objeto personalizado.
     * @param {string} key
     */
    remove: async (key) => {
      if (!this._checkRoom()) return;
      await this.db.ref(`rooms/${this.roomCode}/gameState/objects/${key}`).remove();
    }
  };

  // =========================================================================
  // API DE MENSAJES Y ACCIONES
  // =========================================================================

  /**
   * Envía un mensaje o acción a todos los jugadores de la sala.
   * 
   * @param {string} text - Contenido del mensaje
   * @param {string} [type="chat"] - Tipo: "chat", "action", "system"
   * @returns {Promise<string>} ID del mensaje enviado
   * 
   * Ejemplo:
   *   game.sendMessage("He movido mi ficha a (3,5)", "accion");
   */
  async sendMessage(text, type = 'chat') {
    if (!this._checkRoom()) return;

    const messagesRef = this.db.ref(`rooms/${this.roomCode}/messages`);
    const newMessageRef = messagesRef.push();

    const message = {
      playerId: this.playerId,
      playerName: this.playerName,
      text: text,
      type: type,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    await newMessageRef.set(message);
    return newMessageRef.key;
  }

  // =========================================================================
  // API DE CONTROL DE PARTIDA
  // =========================================================================

  /**
   * Inicia la partida. Solo el host puede iniciarla.
   * Cambia el estado de "waiting" a "playing" y establece el estado inicial.
   * 
   * @param {Object} [initialState={}] - Estado inicial del juego (tablero, variables, etc.)
   * 
   * Ejemplo:
   *   await game.startGame({
   *     board: [[0,0,0],[0,0,0],[0,0,0]],
   *     turnOrder: ["player1", "player2"]
   *   });
   */
  async startGame(initialState = {}) {
    if (!this._checkRoom()) return;
    if (!this.isHost) {
      throw new Error('Solo el anfitrión puede iniciar la partida.');
    }

    const currentPlayers = Object.keys(this._players);
    if (currentPlayers.length < 2) {
      throw new Error('Se necesitan al menos 2 jugadores para empezar.');
    }

    const gameStateUpdate = {
      phase: 'playing',
      currentTurn: initialState.currentTurn || currentPlayers[0],
      turnOrder: initialState.turnOrder || currentPlayers,
      turnIndex: 0,
      winner: null
    };

    // Si se proporciona tablero inicial
    if (initialState.board) {
      gameStateUpdate.board = initialState.board;
    }

    // Variables personalizadas iniciales
    if (initialState.custom) {
      gameStateUpdate.custom = initialState.custom;
    }

    // Objetos personalizados iniciales
    if (initialState.objects) {
      gameStateUpdate.objects = initialState.objects;
    }

    await this.db.ref(`rooms/${this.roomCode}`).update({
      status: 'playing',
      ['gameState']: this.db.ref(`rooms/${this.roomCode}/gameState`).update ?
        null : null // Necesitamos usar update en gameState
    });

    // Actualizar el gameState
    await this.db.ref(`rooms/${this.roomCode}/gameState`).update(gameStateUpdate);

    console.log('🎮 ¡Partida iniciada!');
  }

  /**
   * Reinicia la partida sin crear una nueva sala.
   * Los jugadores permanecen en la sala.
   * Solo el host puede reiniciar.
   * 
   * @param {Object} [newInitialState={}] - Nuevo estado inicial
   */
  async resetGame(newInitialState = {}) {
    if (!this._checkRoom()) return;
    if (!this.isHost) {
      throw new Error('Solo el anfitrión puede reiniciar la partida.');
    }

    const currentPlayers = Object.keys(this._players);

    const resetState = {
      phase: 'playing',
      board: newInitialState.board || null,
      currentTurn: newInitialState.currentTurn || currentPlayers[0],
      turnOrder: newInitialState.turnOrder || currentPlayers,
      turnIndex: 0,
      winner: null,
      custom: newInitialState.custom || {},
      objects: newInitialState.objects || {}
    };

    await this.db.ref(`rooms/${this.roomCode}`).update({
      status: 'playing',
      gameState: resetState,
      messages: {} // Limpiar mensajes antiguos
    });

    console.log('🔄 Partida reiniciada');
  }

  /**
   * Declara un ganador y termina la partida.
   * @param {string} playerId - ID del jugador ganador
   */
  async setWinner(playerId) {
    if (!this._checkRoom()) return;
    await this.db.ref(`rooms/${this.roomCode}`).update({
      status: 'finished',
      'gameState/phase': 'finished',
      'gameState/winner': playerId
    });
    console.log(`🏆 Ganador: ${this._getPlayerName(playerId)}`);
  }

  /**
   * Establece la fase del juego (útil para juegos con múltiples fases).
   * @param {string} phase - Nombre de la fase
   */
  async setPhase(phase) {
    if (!this._checkRoom()) return;
    await this.db.ref(`rooms/${this.roomCode}/gameState/phase`).set(phase);
  }

  // =========================================================================
  // MÉTODOS AUXILIARES
  // =========================================================================

  /**
   * Verifica que el jugador está en una sala.
   * @returns {boolean}
   */
  _checkRoom() {
    if (!this.roomCode) {
      console.error('❌ No estás en ninguna sala. Crea o únete a una sala primero.');
      return false;
    }
    if (!this.playerId) {
      console.error('❌ No tienes un ID de jugador válido.');
      return false;
    }
    return true;
  }

  /**
   * Obtiene el nombre de un jugador por su ID.
   * @param {string} playerId
   * @returns {string}
   */
  _getPlayerName(playerId) {
    if (!playerId) return 'Nadie';
    if (this._players[playerId]) return this._players[playerId].name;
    return playerId;
  }

  /**
   * Limpia todo el estado local y los listeners.
   */
  _cleanup() {
    // Desactivar todos los listeners de Firebase
    this._activeListeners.forEach(({ ref, event, handler }) => {
      ref.off(event, handler);
    });
    this._activeListeners = [];

    // Limpiar estado
    this.roomCode = null;
    this.playerId = null;
    this.playerName = null;
    this.isHost = false;
    this._gameState = null;
    this._players = {};
    this._messages = [];
    this._currentTurn = null;
    this._turnOrder = [];

    // Limpiar sessionStorage
    sessionStorage.removeItem('game_room_code');
  }

  // =========================================================================
  // PROPIEDADES DE SOLO LECTURA
  // =========================================================================

  /** Devuelve la lista de jugadores actual */
  get players() {
    return { ...this._players };
  }

  /** Devuelve el número de jugadores en la sala */
  get playerCount() {
    return Object.keys(this._players).length;
  }

  /** Devuelve el estado completo del juego (copia local) */
  get gameState() {
    return this._gameState ? { ...this._gameState } : null;
  }

  /** Devuelve la fase actual */
  get phase() {
    return this._gameState ? this._gameState.phase : 'lobby';
  }

  /** Devuelve los mensajes (copia local) */
  get messages() {
    return [...this._messages];
  }
}

// =========================================================================
// EXPORTACIÓN GLOBAL
// =========================================================================

// La clase está disponible globalmente para que game-logic.js pueda usarla
console.log('✅ GameInfrastructure cargada correctamente');
console.log('📖 API disponible: game.createRoom(), game.joinRoom(), game.board, game.turn, game.vars, game.objects, game.on()');
