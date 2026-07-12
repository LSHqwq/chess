// ========== 配置 ==========
const API_BASE = 'https://gomoku-backend-production.up.railway.app';
let authToken = localStorage.getItem('token') || '';
let currentUser = null;
let currentRoom = null;
let game = null;

const authModal = document.getElementById('auth-modal');
const lobby = document.getElementById('lobby');
const gameRoomEl = document.getElementById('game-room');
const authTitle = document.getElementById('auth-title');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchLink = document.getElementById('auth-switch-link');
const authError = document.getElementById('auth-error');
const displayUsername = document.getElementById('display-username');
const logoutBtn = document.getElementById('logout-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomInput = document.getElementById('join-room-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const lobbyError = document.getElementById('lobby-error');
const roomCodeDisplay = document.getElementById('room-code-display');
const blackNameEl = document.getElementById('black-name');
const whiteNameEl = document.getElementById('white-name');
const gameHint = document.getElementById('game-hint');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const restartBtn = document.getElementById('restart-btn');
const winModal = document.getElementById('win-modal');
const winnerDisplay = document.getElementById('winner-display');
const winDescription = document.getElementById('win-description');
const modalRestartBtn = document.getElementById('modal-restart-btn');
const gameTimeEl = document.getElementById('game-time');
const moveCountEl = document.getElementById('move-count');
const gameStatusDiv = document.getElementById('game-status');
const turnIndicator = document.getElementById('turn-indicator');
const currentPlayerText = document.getElementById('current-player-text');
const blackCard = document.getElementById('black-player-card');
const whiteCard = document.getElementById('white-player-card');

async function api(path, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (authToken) options.headers['Authorization'] = `Bearer ${authToken}`;
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
}

// ========== 认证 ==========
let isRegister = false;
authSwitchLink.addEventListener('click', (e) => {
    e.preventDefault();
    isRegister = !isRegister;
    authTitle.textContent = isRegister ? '注册' : '登录';
    authSubmitBtn.textContent = isRegister ? '注册' : '登录';
    authSwitchText.textContent = isRegister ? '已有账号？' : '没有账号？';
    authSwitchLink.textContent = isRegister ? '登录' : '注册';
    authError.textContent = '';
});

authSubmitBtn.addEventListener('click', async () => {
    const u = authUsername.value.trim(), p = authPassword.value;
    if (!u || !p) { authError.textContent = '请填写完整'; return; }
    try {
        const path = isRegister ? '/api/register' : '/api/login';
        const data = await api(path, 'POST', { username: u, password: p });
        authToken = data.token; currentUser = data.user;
        localStorage.setItem('token', authToken);
        authModal.style.display = 'none'; showLobby();
    } catch (err) { authError.textContent = err.message; }
});

logoutBtn.addEventListener('click', () => {
    authToken = ''; currentUser = null;
    localStorage.removeItem('token'); stopSync(); showAuthModal();
});

// ========== 大厅 ==========
function showAuthModal() { authModal.style.display = 'flex'; lobby.style.display = 'none'; gameRoomEl.style.display = 'none'; }
function showLobby() { authModal.style.display = 'none'; lobby.style.display = 'flex'; gameRoomEl.style.display = 'none'; displayUsername.textContent = '👤 ' + currentUser.username; logoutBtn.style.display = 'block'; lobbyError.textContent = ''; joinRoomInput.value = ''; }

createRoomBtn.addEventListener('click', async () => {
    try {
        const data = await api('/api/rooms', 'POST');
        currentRoom = { room_code: data.room_code, status: 'waiting', black_player: currentUser.username, white_player: null };
        showGameRoom(); startSync();
    } catch (err) { lobbyError.textContent = err.message; }
});

joinRoomBtn.addEventListener('click', async () => {
    const code = joinRoomInput.value.trim().toUpperCase();
    if (!code) { lobbyError.textContent = '请输入房间号'; return; }
    try {
        const data = await api(`/api/rooms/${code}/join`, 'POST');
        currentRoom = { room_code: data.room_code, status: 'playing', black_player: data.black_player, white_player: data.white_player };
        showGameRoom();
        game.myColor = 'white'; game.onGameStart(); startSync();
    } catch (err) { lobbyError.textContent = err.message; }
});

// ========== 同步 ==========
let syncTimer = null, syncRunning = false;
function startSync() { stopSync(); syncRunning = true; syncLoop(); }
function stopSync() { syncRunning = false; if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; } }

async function syncLoop() {
    if (!syncRunning) return;
    if (!currentRoom || !currentRoom.room_code) { syncTimer = setTimeout(syncLoop, 2000); return; }
    try {
        const data = await api(`/api/rooms/${currentRoom.room_code}`);
        
        if (data.black_player) blackNameEl.textContent = data.black_player;
        else blackNameEl.textContent = '等待中';
        if (data.white_player) whiteNameEl.textContent = data.white_player;
        else whiteNameEl.textContent = '等待中';
        
        if (data.status === 'playing' && currentRoom.status === 'waiting') {
            currentRoom.status = 'playing';
            currentRoom.black_player = data.black_player;
            currentRoom.white_player = data.white_player;
            game.myColor = 'black';
            game.onGameStart();
        }
        
        if (game && !game.gameOver) {
            const serverBoard = JSON.stringify(data.board_state);
            const localBoard = JSON.stringify(game.pieces);
            
            if (serverBoard !== localBoard) {
                game.syncFromServer(data);
            }
            
            const mhLen = (data.move_history || []).length;
            if (data.status === 'playing' && mhLen === 0 && game.moveCount > 0) {
                game.reset(currentRoom);
                game.onGameStart();
            }
            
            if (data.status === 'finished') {
                game.onGameEnd(data);
            }
        }
        
        if (data.status === 'playing' && game && game.gameOver) {
            game.reset(currentRoom);
            game.onGameStart();
        }
        
        currentRoom.status = data.status;
    } catch (err) {
        if (err.message === '房间不存在') {
            stopSync();
            alert('房间已解散');
            currentRoom = null;
            if (game) game.cleanup();
            showLobby();
            return;
        }
    }
    syncTimer = setTimeout(syncLoop, 1000);
}

// ========== 游戏界面 ==========
function showGameRoom() {
    lobby.style.display = 'none'; gameRoomEl.style.display = 'flex';
    roomCodeDisplay.textContent = '房间: ' + currentRoom.room_code;
    blackNameEl.textContent = currentRoom.black_player || '等待中';
    whiteNameEl.textContent = currentRoom.white_player || '等待中';
    if (!game) game = new GomokuOnline();
    game.reset(currentRoom);
}

leaveRoomBtn.addEventListener('click', async () => {
    if (currentRoom) {
        try { await api(`/api/rooms/${currentRoom.room_code}/leave`, 'POST'); } catch (err) {}
    }
    stopSync();
    currentRoom = null;
    if (game) game.cleanup();
    showLobby();
});

restartBtn.addEventListener('click', async () => {
    if (!currentRoom || game.gameStarted === false) return;
    try {
        await api(`/api/rooms/${currentRoom.room_code}/restart`, 'POST');
        game.reset(currentRoom);
        game.onGameStart();
    } catch (err) {}
});

modalRestartBtn.addEventListener('click', async () => {
    winModal.style.display = 'none';
    if (!currentRoom) return;
    try {
        await api(`/api/rooms/${currentRoom.room_code}/restart`, 'POST');
        game.reset(currentRoom);
        game.onGameStart();
    } catch (err) {}
});

// ========== 游戏类 ==========
class GomokuOnline {
    constructor() {
        this.boardSize = 15; this.cellSize = 40; this.padding = 20;
        this.pieces = Array(15).fill(null).map(() => Array(15).fill(null));
        this.currentTurn = 'black'; this.gameOver = false; this.moveCount = 0;
        this.gameStarted = false; this.gameStartTime = null; this.timerInterval = null;
        this.myColor = null;
        this.canvas = document.getElementById('board');
        this.ctx = this.canvas.getContext('2d');
        this.bindEvents(); this.drawBoard();
    }
    
    reset(roomData) {
        this.stopTimer();
        this.pieces = Array(15).fill(null).map(() => Array(15).fill(null));
        this.currentTurn = 'black'; this.gameOver = false; this.moveCount = 0;
        this.gameStarted = false; this.gameStartTime = null;
        gameTimeEl.textContent = '00:00'; moveCountEl.textContent = '0';
        gameStatusDiv.textContent = ''; gameStatusDiv.className = 'status-display';
        gameHint.textContent = ''; winModal.style.display = 'none';
        turnIndicator.className = 'turn-display black-turn';
        currentPlayerText.textContent = '黑棋走子';
        blackCard.classList.add('active-player'); whiteCard.classList.remove('active-player');
        if (roomData && roomData.status === 'waiting') {
            gameHint.textContent = '等待对手加入...';
            gameStatusDiv.textContent = '⏳ 等待中';
        }
        this.drawBoard();
    }
    
    onGameStart() {
        if (this.gameStarted) return;
        this.gameStarted = true;
        this.gameStartTime = Date.now();
        this.startTimer();
        gameStatusDiv.textContent = '🎯 游戏进行中';
        gameStatusDiv.className = 'status-display';
        if (this.myColor === 'black') {
            gameHint.textContent = '你执黑，请落子';
        } else {
            gameHint.textContent = '你执白，等待黑棋落子';
        }
    }
    
    onGameEnd(data) {
        this.gameOver = true;
        this.stopTimer();
        gameStatusDiv.textContent = '🏆 游戏结束';
        gameStatusDiv.className = 'status-display win';
        gameHint.textContent = '游戏结束';
        const winnerName = data.winner || '';
        const isMe = (winnerName === currentUser.username);
        winnerDisplay.textContent = isMe ? '🎉 你赢了！' : '💪 ' + winnerName + ' 获胜';
        winDescription.textContent = '经过 ' + this.moveCount + ' 步';
        winModal.style.display = 'flex';
        this.drawBoard();
    }
    
    syncFromServer(data) {
        this.pieces = JSON.parse(JSON.stringify(data.board_state));
        this.currentTurn = data.current_turn;
        this.moveCount = (data.move_history || []).length;
        moveCountEl.textContent = this.moveCount;
        this.updateTurnUI();
        if (data.status === 'finished') {
            this.gameOver = true;
            this.stopTimer();
        } else {
            gameHint.textContent = this.myColor === this.currentTurn ? '轮到你了！' : '等待对手落子...';
        }
        this.drawBoard();
    }
    
    updateTurnUI() {
        turnIndicator.className = 'turn-display ' + (this.currentTurn === 'black' ? 'black-turn' : 'white-turn');
        currentPlayerText.textContent = this.currentTurn === 'black' ? '黑棋走子' : '白棋走子';
        blackCard.classList.toggle('active-player', this.currentTurn === 'black');
        whiteCard.classList.toggle('active-player', this.currentTurn === 'white');
    }
    
    bindEvents() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));
        this.canvas.addEventListener('mouseleave', () => this.drawBoard());
    }
    
    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            if (!this.gameOver && this.gameStartTime) {
                const e = Math.floor((Date.now() - this.gameStartTime) / 1000);
                gameTimeEl.textContent = Math.floor(e / 60).toString().padStart(2, '0') + ':' + (e % 60).toString().padStart(2, '0');
            }
        }, 1000);
    }
    
    stopTimer() { if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; } }
    
    drawBoard(hx = -1, hy = -1) {
        const ctx = this.ctx, pad = this.padding, cell = this.cellSize, size = this.boardSize;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const bg = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        bg.addColorStop(0, '#dcb35c'); bg.addColorStop(1, '#c9a03a');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 1;
        for (let i = 0; i < size; i++) {
            ctx.beginPath(); ctx.moveTo(pad + i * cell, pad); ctx.lineTo(pad + i * cell, pad + (size - 1) * cell); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pad, pad + i * cell); ctx.lineTo(pad + (size - 1) * cell, pad + i * cell); ctx.stroke();
        }
        ctx.strokeStyle = '#3a2a0a'; ctx.lineWidth = 3;
        ctx.strokeRect(pad, pad, (size - 1) * cell, (size - 1) * cell);
        [[3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]].forEach(([x, y]) => {
            ctx.beginPath(); ctx.arc(pad + x * cell, pad + y * cell, 4, 0, Math.PI*2); ctx.fillStyle = '#3a2a0a'; ctx.fill();
        });
        this.pieces.forEach((row, y) => row.forEach((p, x) => { if (p) this.drawPiece(x, y, p, false); }));
        if (!this.gameOver && this.gameStarted && this.myColor === this.currentTurn && hx >= 0 && hx < size && hy >= 0 && hy < size && !this.pieces[hy][hx]) {
            this.drawPiece(hx, hy, this.currentTurn, true);
        }
    }
    
    drawPiece(x, y, color, preview) {
        const ctx = this.ctx, cx = this.padding + x * this.cellSize, cy = this.padding + y * this.cellSize, r = this.cellSize / 2 - 2;
        ctx.save(); if (preview) ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
        const g = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, r);
        if (color === 'black') { g.addColorStop(0, '#555'); g.addColorStop(0.7, '#111'); g.addColorStop(1, '#000'); }
        else { g.addColorStop(0, '#fff'); g.addColorStop(0.7, '#eee'); g.addColorStop(1, '#ccc'); }
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
    
    handleClick(e) {
        if (this.gameOver || !this.gameStarted || this.myColor !== this.currentTurn) return;
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width, sy = this.canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
        const x = Math.round((mx - this.padding) / this.cellSize), y = Math.round((my - this.padding) / this.cellSize);
        if (x < 0 || x >= 15 || y < 0 || y >= 15 || this.pieces[y][x]) return;
        this.makeMove(x, y);
    }
    
    handleHover(e) {
        if (this.gameOver || !this.gameStarted || this.myColor !== this.currentTurn) return;
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width, sy = this.canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
        const x = Math.round((mx - this.padding) / this.cellSize), y = Math.round((my - this.padding) / this.cellSize);
        if (x >= 0 && x < 15 && y >= 0 && y < 15 && !this.pieces[y][x]) this.drawBoard(x, y);
        else this.drawBoard();
    }
    
    async makeMove(x, y) {
        try {
            const data = await api(`/api/rooms/${currentRoom.room_code}/move`, 'POST', { x, y });
            this.pieces = JSON.parse(JSON.stringify(data.board_state));
            this.moveCount = (data.move_history || []).length;
            moveCountEl.textContent = this.moveCount;
            if (data.game_over) {
                this.gameOver = true; this.stopTimer();
                gameStatusDiv.textContent = '🏆 游戏结束';
                gameStatusDiv.className = 'status-display win';
                gameHint.textContent = '游戏结束';
                const isMe = (data.winner === currentUser.username);
                winnerDisplay.textContent = isMe ? '🎉 你赢了！' : '💪 ' + data.winner + ' 获胜';
                winDescription.textContent = '经过 ' + this.moveCount + ' 步';
                winModal.style.display = 'flex';
            } else {
                this.currentTurn = data.current_turn;
                gameHint.textContent = '等待对手落子...';
            }
            this.updateTurnUI(); this.drawBoard();
        } catch (err) {}
    }
    
    cleanup() { this.stopTimer(); }
}

window.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        api('/api/me').then(u => { currentUser = u; showLobby(); })
        .catch(() => { localStorage.removeItem('token'); authToken = ''; showAuthModal(); });
    } else showAuthModal();
});