/**
 * ============================================================
 * LÓGICA DEL JUEGO: "ESCONDITE EN EL TABLERO"  — v3
 * ============================================================
 * 
 * VISIÓN (SIMÉTRICA, con una diferencia):
 *   - Ambos roles ven en 8 direcciones. Muros bloquean visión.
 *   - Muros se descubren al estar en LOS y se recuerdan.
 *   - DIFERENCIA: los REYES siempre ven a la REINA (incluso fuera de LOS).
 *   - La reina solo detecta reyes en su LOS.
 *   - Los reyes solo detectan otros reyes en su LOS.
 * 
 * MOVIMIENTOS DE REINA:
 *   2 jug → 15, 3 jug → 20, 4 jug → 25, ...
 * 
 * PUNTUACIÓN:
 *   Gana reina → +2 pts. Ganan reyes → +1 pt cada rey vivo.
 *   Se acumula entre rondas.
 * ============================================================
 */

class JuegoEscondite {

  constructor(game) {
    this.game = game;
    this.TAMANO_TABLERO = 8;
    this.CASILLAS_BLOQUEADAS = 10;
    this.MOVIMIENTOS_POR_JUGADORES = { 2:15, 3:20, 4:25 };

    this.posicionReina = null;
    this.posicionesReyes = {};
    this.casillasBloqueadas = [];
    this._bloqueadasDescubiertas = new Set();
    this.miRol = null;
    this.idReina = null;
    this.reyesCapturados = [];
    this.eliminado = false;
    this.movimientosReina = 0;
    this.maxMovimientosReina = 15;
    this.ronda = 1;
    this.puntuaciones = {};

    this._callbacks = { boardChange:[], turnChange:[], myTurn:[], reyCapturado:[], gameOver:[], roundStart:[], scoreChange:[] };
    this._configurarListeners();
  }

  on(e, cb) { if (this._callbacks[e]) this._callbacks[e].push(cb); }
  _emit(e, d) { (this._callbacks[e]||[]).forEach(cb => { try{cb(d)}catch(err){console.error(err)} }); }

  _configurarListeners() {
    this.game.on('stateChange', gs => this._procesarEstado(gs));
    this.game.on('gameStart', gs => { this._procesarEstado(gs); });
  }

  _procesarEstado(gameState) {
    if (!gameState || gameState.phase !== 'playing') return;
    const board = gameState.objects?.board || null;
    if (board) {
      this.posicionReina = board.queen || null;
      this.posicionesReyes = board.kings || {};
      this.casillasBloqueadas = board.blockedTiles || [];
      if (board.discoveredBlocks && this.game.playerId) {
        const mis = board.discoveredBlocks[this.game.playerId];
        if (mis) this._bloqueadasDescubiertas = new Set(mis);
      }
    }
    if (!this.miRol && this.idReina) {
      this.miRol = this.game.playerId === this.idReina ? 'reina' : 
        (this.posicionesReyes[this.game.playerId] ? 'rey' : null);
    }
    this.reyesCapturados = this.game.vars.get('reyesCapturados', []);
    if (this.miRol === 'rey' && this.reyesCapturados.includes(this.game.playerId)) this.eliminado = true;
    this.movimientosReina = this.game.vars.get('movimientosReina', 0);
    this.maxMovimientosReina = this.game.vars.get('maxMovimientosReina', 15);
    this.ronda = this.game.vars.get('ronda', 1);
    this.puntuaciones = this.game.vars.get('puntuaciones', {});
    this.idReina = this.game.vars.get('idReina', null);
    this._emit('boardChange', {});
    this._emit('turnChange', this.game._currentTurn);
    if (this.game.turn.isMyTurn() && !this.eliminado) this._emit('myTurn');
  }

  // ============= INICIALIZACIÓN =============

  async inicializarJuego() {
    if (!this.game.isHost) throw new Error('Solo el anfitrión.');
    const jugadores = Object.keys(this.game._players);
    if (jugadores.length < 2) throw new Error('Mínimo 2 jugadores.');
    const idReina = jugadores[0], idsReyes = jugadores.slice(1);
    const maxMovs = this.MOVIMIENTOS_POR_JUGADORES[jugadores.length] || 15;
    const bloqueadas = this._generarBloqueadas();
    const posReina = { row: 7, col: 7 };
    const posReyes = this._colocarReyes(idsReyes, posReina, bloqueadas);
    const discoveredBlocks = {};
    [idReina, ...idsReyes].forEach(pid => {
      const pos = pid === idReina ? posReina : posReyes[pid];
      discoveredBlocks[pid] = this._murosEnLOS(pos, bloqueadas);
    });
    const board = { size: 8, queen: posReina, kings: posReyes, blockedTiles: bloqueadas, discoveredBlocks };
    const puntuaciones = this.game.vars.get('puntuaciones', {});
    jugadores.forEach(p => { if (!(p in puntuaciones)) puntuaciones[p] = 0; });
    await this.game.objects.set('board', board);
    await this.game.vars.set('idReina', idReina);
    await this.game.vars.set('movimientosReina', 0);
    await this.game.vars.set('maxMovimientosReina', maxMovs);
    await this.game.vars.set('reyesCapturados', []);
    await this.game.vars.set('ronda', this.ronda || 1);
    await this.game.vars.set('puntuaciones', puntuaciones);
    await this.game.startGame({ board, turnOrder: [idReina, ...idsReyes], currentTurn: idReina,
      objects: { board }, custom: { idReina, movimientosReina:0, maxMovimientosReina:maxMovs, reyesCapturados:[], ronda:this.ronda||1, puntuaciones } });
    this.posicionReina = posReina; this.posicionesReyes = posReyes; this.casillasBloqueadas = bloqueadas;
    this.idReina = idReina; this.miRol = this.game.playerId === idReina ? 'reina' : 'rey';
    this.movimientosReina = 0; this.maxMovimientosReina = maxMovs;
    if (discoveredBlocks[this.game.playerId]) this._bloqueadasDescubiertas = new Set(discoveredBlocks[this.game.playerId]);
    console.log(`✅ Ronda ${this.ronda} — Reina: ${maxMovs} movs, ${idsReyes.length} reyes`);
    return board;
  }

  async nuevaRonda() {
    if (!this.game.isHost) throw new Error('Solo el anfitrión.');
    const pts = this.game.vars.get('puntuaciones', {});
    this.ronda = (this.game.vars.get('ronda', 1)) + 1;
    await this.game.vars.set('puntuaciones', pts);
    await this.game.vars.set('ronda', this.ronda);
    this._bloqueadasDescubiertas = new Set();
    this.miRol = null; this.reyesCapturados = []; this.eliminado = false;
    await this.inicializarJuego();
    this._emit('roundStart', this.ronda);
  }

  // ============= GENERACIÓN =============

  _generarBloqueadas() {
    const b = [], o = new Set(); o.add(`7,7`);
    while (b.length < this.CASILLAS_BLOQUEADAS) {
      const r = Math.floor(Math.random()*8), c = Math.floor(Math.random()*8);
      if (!o.has(`${r},${c}`)) { b.push({row:r,col:c}); o.add(`${r},${c}`); }
    }
    return b;
  }

  _colocarReyes(ids, reina, bloq) {
    const pos = {}, o = new Set(); o.add(`${reina.row},${reina.col}`); bloq.forEach(b=>o.add(`${b.row},${b.col}`));
    const valids = [];
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      if (o.has(`${r},${c}`)) continue;
      if (!this._estaEnLOS(reina,{row:r,col:c},bloq)) valids.push({row:r,col:c});
    }
    if (valids.length < ids.length) {
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
        const k=`${r},${c}`; if (!o.has(k)&&!valids.some(p=>p.row===r&&p.col===c)) valids.push({row:r,col:c});
      }
    }
    this._barajar(valids);
    ids.forEach((id,i)=>{ if(i<valids.length){ pos[id]=valids[i]; o.add(`${valids[i].row},${valids[i].col}`); } });
    return pos;
  }

  // ============= VISIÓN =============

  _estaEnLOS(origen, obj, bloq) {
    const dr=obj.row-origen.row, dc=obj.col-origen.col;
    if (dr===0&&dc===0) return true;
    if (!(dr===0||dc===0||Math.abs(dr)===Math.abs(dc))) return false;
    const pr=dr===0?0:(dr>0?1:-1), pc=dc===0?0:(dc>0?1:-1);
    let r=origen.row+pr, c=origen.col+pc;
    while(r!==obj.row||c!==obj.col) {
      if(r<0||r>=8||c<0||c>=8) return false;
      if(bloq.some(b=>b.row===r&&b.col===c)) return false;
      r+=pr; c+=pc;
    }
    return true;
  }

  _calcularLOS(origen) {
    if (!origen) return [];
    const v = new Set(); v.add(`${origen.row},${origen.col}`);
    const m = new Set(this.casillasBloqueadas.map(b=>`${b.row},${b.col}`));
    for (const [dr,dc] of [[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]]) {
      let r=origen.row+dr, c=origen.col+dc;
      while(r>=0&&r<8&&c>=0&&c<8) { const k=`${r},${c}`; v.add(k); if(m.has(k)) break; r+=dr; c+=dc; }
    }
    return Array.from(v).map(k=>{ const [r,c]=k.split(',').map(Number); return {row:r,col:c}; });
  }

  _murosEnLOS(origen, todos) {
    const los = this._calcularLOS(origen);
    const s = new Set(los.map(v=>`${v.row},${v.col}`));
    return todos.filter(m=>s.has(`${m.row},${m.col}`)).map(m=>`${m.row},${m.col}`);
  }

  // ============= TABLERO VISIBLE =============

  obtenerTableroVisible() {
    const board = { size:8, queen:null, kings:{}, blockedTiles:[], visibleTiles:[] };
    let miPos = this.miRol==='reina' ? this.posicionReina : this.posicionesReyes[this.game.playerId];
    if (!miPos) return board;
    const los = this._calcularLOS(miPos);
    board.visibleTiles = los;
    const sLos = new Set(los.map(v=>`${v.row},${v.col}`));
    // Muros: descubiertos O en LOS actual
    board.blockedTiles = this.casillasBloqueadas.filter(m=>{
      const k=`${m.row},${m.col}`; return this._bloqueadasDescubiertas.has(k)||sLos.has(k);
    });
    // Actualizar descubrimientos
    this.casillasBloqueadas.forEach(m=>{ const k=`${m.row},${m.col}`; if(sLos.has(k)) this._bloqueadasDescubiertas.add(k); });
    // Reyes y reina
    if (this.miRol==='reina') {
      Object.entries(this.posicionesReyes).forEach(([pid,pos])=>{ if(sLos.has(`${pos.row},${pos.col}`)) board.kings[pid]={...pos}; });
      board.queen = this.posicionReina ? {...this.posicionReina} : null;
    } else {
      Object.entries(this.posicionesReyes).forEach(([pid,pos])=>{
        if(pid===this.game.playerId||sLos.has(`${pos.row},${pos.col}`)) board.kings[pid]={...pos};
      });
      board.queen = this.posicionReina ? {...this.posicionReina} : null; // SIEMPRE visible
    }
    return board;
  }

  // ============= VALIDACIÓN =============

  validarMovimientoReina(fr,fc,tr,tc) {
    if (!this.posicionReina||this.posicionReina.row!==fr||this.posicionReina.col!==fc) return {valido:false,razon:'Posición incorrecta.'};
    if (tr<0||tr>=8||tc<0||tc>=8) return {valido:false,razon:'Fuera del tablero.'};
    if (fr===tr&&fc===tc) return {valido:false,razon:'Misma casilla.'};
    const dr=tr-fr, dc=tc-fc;
    if (!(dr===0||dc===0||Math.abs(dr)===Math.abs(dc))) return {valido:false,razon:'Solo línea recta o diagonal.'};
    const pr=dr===0?0:(dr>0?1:-1), pc=dc===0?0:(dc>0?1:-1);
    let r=fr+pr, c=fc+pc;
    while(r!==tr||c!==tc) {
      if (this.casillasBloqueadas.some(b=>b.row===r&&b.col===c)) return {valido:false,razon:'No saltas muros.'};
      const rey=Object.entries(this.posicionesReyes).find(([pid,pos])=>!this.reyesCapturados.includes(pid)&&pos.row===r&&pos.col===c);
      if (rey) return {valido:false,razon:'No saltas sobre reyes.'};
      r+=pr; c+=pc;
    }
    if (this.casillasBloqueadas.some(b=>b.row===tr&&b.col===tc)) return {valido:false,razon:'Casilla bloqueada.'};
    const captura=Object.entries(this.posicionesReyes).find(([pid,pos])=>!this.reyesCapturados.includes(pid)&&pos.row===tr&&pos.col===tc);
    return captura?{valido:true,captura:captura[0]}:{valido:true};
  }

  validarMovimientoRey(pid,fr,fc,tr,tc) {
    const mp=this.posicionesReyes[pid];
    if (!mp||mp.row!==fr||mp.col!==fc) return {valido:false,razon:'No es tu rey.'};
    if (this.reyesCapturados.includes(pid)) return {valido:false,razon:'Capturado.'};
    if (tr<0||tr>=8||tc<0||tc>=8) return {valido:false,razon:'Fuera.'};
    if (fr===tr&&fc===tc) return {valido:false,razon:'Misma casilla.'};
    if (Math.abs(tr-fr)>1||Math.abs(tc-fc)>1) return {valido:false,razon:'Máximo 1 casilla.'};
    if (this.casillasBloqueadas.some(b=>b.row===tr&&b.col===tc)) {
      const k=`${tr},${tc}`; if(!this._bloqueadasDescubiertas.has(k)){this._bloqueadasDescubiertas.add(k);this._guardarDescubrimientos();}
      return {valido:false,razon:'¡Muro! Casilla bloqueada.'};
    }
    if (this.posicionReina&&this.posicionReina.row===tr&&this.posicionReina.col===tc) return {valido:false,razon:'Ahí está la reina.'};
    const otro=Object.entries(this.posicionesReyes).find(([o,pos])=>o!==pid&&!this.reyesCapturados.includes(o)&&pos.row===tr&&pos.col===tc);
    if (otro) return {valido:false,razon:'Ocupada por otro rey.'};
    return {valido:true};
  }

  // ============= EJECUCIÓN =============

  async moverReina(toRow, toCol) {
    if (this.miRol!=='reina') throw new Error('Solo la reina.');
    if (!this.game.turn.isMyTurn()) throw new Error('No es tu turno.');
    const res = this.validarMovimientoReina(this.posicionReina.row, this.posicionReina.col, toRow, toCol);
    if (!res.valido) return res;
    const nuevosMovs = this.movimientosReina + 1;
    await this.game.vars.set('movimientosReina', nuevosMovs);
    const nuevaPos = {row:toRow, col:toCol};
    const nuevosReyes = {...this.posicionesReyes};
    if (res.captura) {
      delete nuevosReyes[res.captura];
      await this.game.vars.set('reyesCapturados', [...this.reyesCapturados, res.captura]);
    }
    await this._actualizarBoard(nuevaPos, nuevosReyes);
    if (res.captura) {
      await this.game.sendMessage(`¡Reina captura al rey de ${this.game._getPlayerName(res.captura)}!`,'accion');
      this._emit('reyCapturado', res.captura);
    } else {
      await this.game.sendMessage(`Reina se ha movido. (${nuevosMovs}/${this.maxMovimientosReina} movs)`,'accion');
    }
    // ¿Gana la reina?
    const vivos = Object.keys(nuevosReyes).filter(p=>!this.reyesCapturados.includes(p)&&p!==res.captura);
    if (vivos.length === 0) {
      await this._otorgarPuntos('reina');
      await this.game.setWinner(this.game.playerId);
      this._emit('gameOver', {winner:'reina', razon:'Todos los reyes capturados'});
    } else if (nuevosMovs >= this.maxMovimientosReina) {
      await this._otorgarPuntos('reyes', vivos);
      await this.game.db.ref(`rooms/${this.game.roomCode}`).update({status:'finished','gameState/phase':'finished','gameState/winner':'reyes'});
      this._emit('gameOver', {winner:'reyes', razon:`Reina gastó ${nuevosMovs}/${this.maxMovimientosReina} movimientos`});
    } else {
      await this._avanzarTurno();
    }
    return res;
  }

  async moverRey(toRow, toCol) {
    if (this.miRol!=='rey') throw new Error('Solo un rey.');
    if (!this.game.turn.isMyTurn()) throw new Error('No es tu turno.');
    if (this.eliminado) throw new Error('Capturado.');
    const mp = this.posicionesReyes[this.game.playerId];
    if (!mp) throw new Error('Sin posición.');
    const res = this.validarMovimientoRey(this.game.playerId, mp.row, mp.col, toRow, toCol);
    if (!res.valido) return res;
    const nuevosReyes = {...this.posicionesReyes};
    nuevosReyes[this.game.playerId] = {row:toRow, col:toCol};
    // Descubrir muros adyacentes a nueva posición
    this._descubrirAdyacentes(toRow, toCol);
    await this._actualizarBoard(this.posicionReina, nuevosReyes);
    await this.game.sendMessage(`Rey de ${this.game.playerName} se ha movido.`,'accion');
    await this._avanzarTurno();
    return res;
  }

  async _actualizarBoard(reinaPos, reyesPos) {
    const boardAnt = this.game.objects.get('board') || {};
    const discoveredBlocks = boardAnt.discoveredBlocks || {};
    discoveredBlocks[this.game.playerId] = Array.from(this._bloqueadasDescubiertas);
    const board = { size:8, queen:reinaPos, kings:reyesPos, blockedTiles:this.casillasBloqueadas, discoveredBlocks };
    await this.game.objects.set('board', board);
  }

  async _guardarDescubrimientos() {
    try {
      const ba = this.game.objects.get('board') || {};
      if (!ba.discoveredBlocks) ba.discoveredBlocks = {};
      ba.discoveredBlocks[this.game.playerId] = Array.from(this._bloqueadasDescubiertas);
      await this.game.objects.set('board', ba);
    } catch(e) { console.error('Error guardando descubrimientos:', e); }
  }

  _descubrirAdyacentes(row, col) {
    for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
      if (dr===0&&dc===0) continue;
      const r=row+dr, c=col+dc;
      if (r>=0&&r<8&&c>=0&&c<8) {
        const k=`${r},${c}`;
        if (this.casillasBloqueadas.some(b=>b.row===r&&b.col===c) && !this._bloqueadasDescubiertas.has(k)) {
          this._bloqueadasDescubiertas.add(k);
        }
      }
    }
  }

  async _avanzarTurno() {
    await this.game.turn.next();
  }

  // ============= PUNTUACIÓN =============

  async _otorgarPuntos(ganador, reyesVivos = []) {
    const pts = {...(this.game.vars.get('puntuaciones', {}))};
    if (ganador === 'reina') {
      // +2 puntos para la reina
      pts[this.idReina] = (pts[this.idReina] || 0) + 2;
    } else {
      // +1 punto para cada rey vivo
      reyesVivos.forEach(pid => { pts[pid] = (pts[pid] || 0) + 1; });
    }
    await this.game.vars.set('puntuaciones', pts);
    this.puntuaciones = pts;
    this._emit('scoreChange', pts);
    console.log('📊 Puntuaciones actualizadas:', pts);
  }

  // ============= UTILIDADES =============

  _barajar(a) { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} }
  aNotacion(r,c) { return `${'abcdefgh'[c]}${8-r}`; }
  desdeNotacion(n) { return {row:8-parseInt(n[1]),col:'abcdefgh'.indexOf(n[0].toLowerCase())}; }
}

console.log('✅ JuegoEscondite v3 cargado');
