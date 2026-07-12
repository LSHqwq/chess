// ========== 配置 ==========
const API_BASE = 'https://gomoku-backend-production.up.railway.app';
let authToken = localStorage.getItem('token') || '';
let currentUser = null;
let currentRoom = null;
let game = null;

// ========== DOM 元素 ==========
const authModal = document.getElementById('auth-modal');
const lobby = document.getElementById('lobby');
const gameRoom = document.getElementById('game-room');
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
const blackName = document.getElementById('black-name');
const whiteName = document.getElementById('white-name');
const gameHint = document.getElementById('game-hint');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const winModal = document.getElementById('win-modal');
const winnerDisplay = document.getElementById('winner-display');
const winDescription = document.getElementById('win-description');
const modalRestartBtn = document.getElementById('modal-restart-btn');

// ========== API 封装 ==========
async function api(path, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    
    if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();
    
    if (!res.ok) {
        throw new Error(data.error || '请求失败');
    }
    
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
    const username = authUsername.value.trim();
    const password = authPassword.value;
    
    if (!username || !password) {
        authError.textContent = '请填写完整';
        return;
    }
    
    try {
        const path = isRegister ? '/api/register' : '/api/login';
        const data = await api(path, 'POST', { username, password });
        
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('token', authToken);
        
        authModal.style.display = 'none';
        showLobby();
    } catch (err) {
        authError.textContent = err.message;
    }
});

logoutBtn.addEventListener('click', () => {
    authToken = '';
    currentUser = null;
    localStorage.removeItem('token');
    showAuthModal();
});

// ========== 大厅 ==========
function showAuthModal() {
    authModal.style.display = 'flex';
    lobby.style.display = 'none';
    gameRoom.style.display = 'none';
}

function showLobby() {
    authModal.style.display = 'none';
    lobby.style.display = 'flex';
    gameRoom.style.display = 'none';
    displayUsername.textContent = `👤 ${currentUser.username}`;
    logoutBtn.style.display = 'block';
}

createRoomBtn.addEventListener('click', async () => {
    try {
        const data = await api('/api/rooms', 'POST');
        currentRoom = data;
        showGameRoom();
        startPolling();
    } catch (err) {
        lobbyError.textContent = err.message;
    }
});

joinRoomBtn.addEventListener('click', async () => {
    const code = joinRoomInput.value.trim().toUpperCase();
    if (!code) {
        lobbyError.textContent = '请输入房间号';
        return;
    }
    
    try {
        const data = await api(`/api/rooms/${code}/join`, 'POST');
        currentRoom = data;
        showGameRoom();
        startPolling();
    } catch (err) {
        lobbyError.textContent = err.message;
    }
});

// ========== 游戏界面 ==========
let pollingInterval = null;

function showGameRoom() {
    lobby.style.display = 'none';
    gameRoom.style.display = 'flex';
    roomCodeDisplay.textContent = `房间: ${currentRoom.room_code}`;
    
    if (!game) {
        game = new GomokuOnline();
    }
    game.reset(currentRoom);
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        if (!currentRoom) return;
        
        try {
            const data = await api(`/api/rooms/${currentRoom.room_code}`);
            
            // 更新玩家信息
            if (data.black_player) blackName.textContent = data.black_player;
            if (data.white_player) whiteName.textContent = data.white_player;
            
            // 对手加入了
            if (data.status === 'playing' && currentRoom.status === 'waiting') {
                currentRoom.status = 'playing';
                gameHint.textContent = '游戏开始！';
            }
            
            // 游戏结束
            if (data.status === 'finished') {
                gameHint.textContent = '游戏结束';
                if (game) {
                    game.syncBoard(data.board_state);
                    game.gameOver = true;
                    const winner = data.black_player && data.winner_id ? 
                        (data.winner_id === game.myColor === 'black' ? data.black_player : data.white_player) : '';
                    game.showWin(winner || '对方');
                }
            }
            
            currentRoom = { ...currentRoom, ...data };
        } catch (err) {
            // 忽略轮询错误
        }
    }, 1000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

leaveRoomBtn.addEventListener('click', () => {
    stopPolling();
    currentRoom = null;
    if (game) game.reset();
    showLobby();
});

modalRestartBtn.addEventListener('click', async () => {
    try {
        await api(`/api/rooms/${currentRoom.room_code}/restart`, 'POST');
        winModal.style.display = 'none';
        if (game) game.reset(currentRoom);
        gameHint.textContent = '新游戏开始！';
    } catch (err) {
        // 处理错误
    }
});

// ========== 五子棋游戏类（在线版） ==========
class GomokuOnline {
    constructor() {
        this.boardSize = 15;
        this.cellSize = 40;
        this.padding = 20;
        this.pieces = [];
        this.history = [];
        this.currentPlayer = 'black';
        this.gameOver = false;
        this.moveCount = 0;
        this.gameStartTime = Date.now();
        this.timerInterval = null;
        this.winLine = null;
        this.myColor = null;
        this.roomCode = '';
        
        this.canvas = document.getElementById('board');
        this.ctx = this.canvas.getContext('2d');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.currentPlayerText = document.getElementById('current-player-text');
        this.moveCountSpan = document.getElementById('move-count');
        this.gameTimeSpan = document.getElementById('game-time');
        this.gameStatusDiv = document.getElementById('game-status');
        this.blackCard = document.getElementById('black-player-card');
        this.whiteCard = document.getElementById('white-player-card');
        
        this.bindEvents();
        this.drawBoard();
    }
    
    reset(roomData) {
        this.pieces = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
        this.history = [];
        this.currentPlayer = 'black';
        this.gameOver = false;
        this.moveCount = 0;
        this.winLine = null;
        this.gameStartTime = Date.now();
        
        if (roomData) {
            this.roomCode = roomData.room_code;
            this.myColor = roomData.black_player === currentUser.username ? 'black' : 'white';
        }
        
        this.updateUI();
        this.drawBoard();
        this.startTimer();
    }
    
    syncBoard(boardState) {
        this.pieces = boardState;
        this.drawBoard();
    }
    
    bindEvents() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));
        this.canvas.addEventListener('mouseleave', () => this.drawBoard());
        
        document.getElementById('restart-btn').addEventListener('click', async () => {
            if (currentRoom) {
                try {
                    await api(`/api/rooms/${currentRoom.room_code}/restart`, 'POST');
                    this.reset(currentRoom);
                } catch (err) {}
            }
        });
    }
    
    startTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (!this.gameOver) {
                const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const seconds = (elapsed % 60).toString().padStart(2, '0');
                this.gameTimeSpan.textContent = `${minutes}:${seconds}`;
            }
        }, 1000);
    }
    
    updateUI() {
        this.turnIndicator.className = 'turn-display ' + 
            (this.currentPlayer === 'black' ? 'black-turn' : 'white-turn');
        this.currentPlayerText.textContent = 
            this.currentPlayer === 'black' ? '黑棋走子' : '白棋走子';
        
        this.blackCard.classList.toggle('active-player', this.currentPlayer === 'black');
        this.whiteCard.classList.toggle('active-player', this.currentPlayer === 'white');
        this.moveCountSpan.textContent = this.moveCount;
        this.gameStatusDiv.textContent = '🎯 游戏进行中';
        this.gameStatusDiv.className = 'status-display';
    }
    
    drawBoard(hoverX = -1, hoverY = -1) {
        const ctx = this.ctx;
        const size = this.boardSize;
        const cellSize = this.cellSize;
        const padding = this.padding;
        
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const boardGradient = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        boardGradient.addColorStop(0, '#dcb35c');
        boardGradient.addColorStop(1, '#c9a03a');
        ctx.fillStyle = boardGradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.strokeStyle = '#5a4a2a';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < size; i++) {
            ctx.beginPath();
            ctx.moveTo(padding + i * cellSize, padding);
            ctx.lineTo(padding + i * cellSize, padding + (size - 1) * cellSize);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(padding, padding + i * cellSize);
            ctx.lineTo(padding + (size - 1) * cellSize, padding + i * cellSize);
            ctx.stroke();
        }
        
        ctx.strokeStyle = '#3a2a0a';
        ctx.lineWidth = 3;
        ctx.strokeRect(padding, padding, (size - 1) * cellSize, (size - 1) * cellSize);
        
        const starPoints = [[3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]];
        starPoints.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(padding + x * cellSize, padding + y * cellSize, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#3a2a0a';
            ctx.fill();
        });
        
        this.pieces.forEach((row, y) => {
            row.forEach((piece, x) => {
                if (piece) this.drawPiece(x, y, piece, false);
            });
        });
        
        if (!this.gameOver && hoverX >= 0 && hoverX < size && hoverY >= 0 && hoverY < size && !this.pieces[hoverY][hoverX]) {
            if (this.myColor === this.currentPlayer) {
                this.drawPiece(hoverX, hoverY, this.currentPlayer, true);
            }
        }
    }
    
    drawPiece(x, y, color, isPreview = false) {
        const ctx = this.ctx;
        const cx = this.padding + x * this.cellSize;
        const cy = this.padding + y * this.cellSize;
        const radius = this.cellSize / 2 - 2;
        
        ctx.save();
        if (isPreview) ctx.globalAlpha = 0.4;
        
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        
        const gradient = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, radius);
        if (color === 'black') {
            gradient.addColorStop(0, '#555');
            gradient.addColorStop(0.7, '#111');
            gradient.addColorStop(1, '#000');
        } else {
            gradient.addColorStop(0, '#fff');
            gradient.addColorStop(0.7, '#eee');
            gradient.addColorStop(1, '#ccc');
        }
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
    }
    
    handleClick(e) {
        if (this.gameOver) return;
        if (this.myColor !== this.currentPlayer) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        const x = Math.round((mouseX - this.padding) / this.cellSize);
        const y = Math.round((mouseY - this.padding) / this.cellSize);
        
        if (x < 0 || x >= this.boardSize || y < 0 || y >= this.boardSize) return;
        if (this.pieces[y][x]) return;
        
        this.makeMove(x, y);
    }
    
    handleHover(e) {
        if (this.gameOver) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        const x = Math.round((mouseX - this.padding) / this.cellSize);
        const y = Math.round((mouseY - this.padding) / this.cellSize);
        
        if (x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize && !this.pieces[y][x]) {
            this.drawBoard(x, y);
        } else {
            this.drawBoard();
        }
    }
    
    async makeMove(x, y) {
        try {
            const data = await api(`/api/rooms/${this.roomCode}/move`, 'POST', { x, y });
            
            this.pieces = data.board_state;
            this.moveCount++;
            
            if (data.game_over) {
                this.gameOver = true;
                this.gameStatusDiv.textContent = `🏆 ${data.winner} 获胜！`;
                this.gameStatusDiv.className = 'status-display win';
                this.showWin(data.winner);
            } else {
                this.currentPlayer = data.current_turn;
                this.updateUI();
            }
            
            this.drawBoard();
        } catch (err) {
            // 落子失败
        }
    }
    
    showWin(winner) {
        winnerDisplay.textContent = winner === currentUser.username ? '🎉 你赢了！' : `💪 ${winner} 获胜`;
        winDescription.textContent = `经过 ${this.moveCount} 步`;
        winModal.style.display = 'flex';
    }
}

// ========== 初始化 ==========
window.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        api('/api/me').then(user => {
            currentUser = user;
            showLobby();
        }).catch(() => {
            localStorage.removeItem('token');
            authToken = '';
            showAuthModal();
        });
    } else {
        showAuthModal();
    }
});