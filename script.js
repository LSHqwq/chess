const API_BASE = 'https://gjxq.lshserver.dpdns.org';  // 改为 3001 端口
const WS_BASE = 'wss://gjxq.lshserver.dpdns.org/ws';  // 改为 3001 端口
let authToken = localStorage.getItem('chess_token') || '';
let currentUser = null;
let currentRoom = null;
let game = null;
let ws = null;
let drawModalShown = false;

// ========== 页内弹窗函数 ==========
function showModal(options) {
    const { title, message, buttons = [{ text: '确定', onClick: () => {} }], autoClose = 0 } = options;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:2000;';
    
    const dialog = document.createElement('div');
    dialog.style.cssText = 'background:#16213e;border-radius:16px;padding:30px;text-align:center;min-width:300px;max-width:90%;border:1px solid rgba(255,255,255,0.1);';
    dialog.innerHTML = `
        ${title ? `<h3 style="color:#e2e8f0;margin-bottom:8px;font-size:18px;">${title}</h3>` : ''}
        <p style="color:#a0aec0;font-size:14px;margin-bottom:20px;line-height:1.5;">${message}</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;"></div>
    `;
    
    const btnContainer = dialog.querySelector('div');
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.style.cssText = `padding:10px 20px;border:none;border-radius:8px;background:${btn.bg || '#667eea'};color:white;cursor:pointer;font-size:14px;font-weight:500;`;
        button.addEventListener('click', () => {
            overlay.remove();
            if (btn.onClick) btn.onClick();
        });
        btnContainer.appendChild(button);
    });
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    if (autoClose > 0) {
        setTimeout(() => overlay.remove(), autoClose);
    }
}

function showToast(message) {
    showModal({ message, autoClose: 2000 });
}

// ========== DOM 元素 ==========
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
const userStats = document.getElementById('user-stats');
const logoutBtn = document.getElementById('logout-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomInput = document.getElementById('join-room-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const lobbyError = document.getElementById('lobby-error');
const roomCodeDisplay = document.getElementById('room-code-display');
const whiteNameEl = document.getElementById('white-name');
const blackNameEl = document.getElementById('black-name');
const gameHint = document.getElementById('game-hint');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const restartBtn = document.getElementById('restart-btn');
const drawBtn = document.getElementById('draw-btn');
const winModal = document.getElementById('win-modal');
const resultIcon = document.getElementById('result-icon');
const resultTitle = document.getElementById('result-title');
const winnerDisplay = document.getElementById('winner-display');
const winDescription = document.getElementById('win-description');
const modalRestartBtn = document.getElementById('modal-restart-btn');
const checkModal = document.getElementById('check-modal');
const checkMessage = document.getElementById('check-message');
const checkModalBtn = document.getElementById('check-modal-btn');
const gameTimeEl = document.getElementById('game-time');
const moveCountEl = document.getElementById('move-count');
const gameStatusDiv = document.getElementById('game-status');
const turnIndicator = document.getElementById('turn-indicator');
const currentPlayerText = document.getElementById('current-player-text');
const whiteCard = document.getElementById('white-player-card');
const blackCard = document.getElementById('black-player-card');
const refreshRoomsBtn = document.getElementById('refresh-rooms-btn');
const roomList = document.getElementById('room-list');
const aiPlayBtn = document.getElementById('ai-play-btn');
const movesList = document.getElementById('moves-list');

// ========== API ==========
async function api(path, method = 'GET', body = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (authToken) options.headers['Authorization'] = `Bearer ${authToken}`;
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
}

// ========== WebSocket ==========
function connectWebSocket(roomCode) {
    disconnectWebSocket();
    
    ws = new WebSocket(`${WS_BASE}?room=${roomCode}&token=${authToken}`);
    
    ws.onopen = () => {
        console.log('WebSocket 已连接');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWSMessage(data);
        } catch (err) {
            console.error('WS消息解析失败:', err);
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket 已断开');
    };
    
    ws.onerror = (err) => {
        console.error('WebSocket 错误:', err);
    };
}

function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
}

function handleWSMessage(data) {
    if (!game) return;
    
    switch (data.type) {
        case 'player_joined':
            if (currentRoom && currentRoom.status === 'waiting') {
                currentRoom.status = 'playing';
                game.myColor = 'white';
                game.onGameStart();
                updatePlayerNames();
            }
            break;
            
        case 'move':
            game.syncFromServer(data);
            break;
            
        case 'restart':
            winModal.style.display = 'none';
            checkModal.style.display = 'none';
            game.reset(currentRoom);
            game.onGameStart();
            break;
            
        case 'draw_offer':
            if (!drawModalShown && !game.gameOver) {
                drawModalShown = true;
                showDrawOffer(data.from, currentRoom.room_code);
            }
            break;
            
        case 'draw_agreed':
            game.gameOver = true;
            game.stopTimer();
            gameStatusDiv.textContent = '和棋';
            gameStatusDiv.className = 'status-display win';
            gameHint.textContent = '和棋';
            resultIcon.textContent = '🤝';
            resultTitle.textContent = '和棋';
            winnerDisplay.textContent = '双方同意和棋';
            winDescription.textContent = `经过 ${game.moveCount} 步`;
            winModal.style.display = 'flex';
            game.drawBoard();
            drawModalShown = false;
            break;
            
        case 'draw_rejected':
            drawModalShown = false;
            gameHint.textContent = '对方拒绝了求和';
            break;
            
        case 'player_left':
            showModal({ 
                title: '对方离开', 
                message: '对方离开了房间', 
                buttons: [{ 
                    text: '返回大厅', 
                    bg: '#667eea', 
                    onClick: () => { 
                        disconnectWebSocket(); 
                        currentRoom = null; 
                        if (game) { game.isAI = false; game.cleanup(); } 
                        showLobby(); 
                    } 
                }] 
            });
            break;
            
        case 'timeout':
            showModal({ 
                title: '超时', 
                message: '房间因长时间无活动已关闭', 
                buttons: [{ 
                    text: '返回大厅', 
                    bg: '#667eea', 
                    onClick: () => { 
                        disconnectWebSocket(); 
                        currentRoom = null; 
                        if (game) { game.isAI = false; game.cleanup(); } 
                        showLobby(); 
                    } 
                }] 
            });
            break;
    }
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
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('chess_token', authToken);
        authModal.style.display = 'none';
        showLobby();
    } catch (err) {
        authError.textContent = err.message;
    }
});

logoutBtn.addEventListener('click', () => {
    authToken = '';
    currentUser = null;
    localStorage.removeItem('chess_token');
    disconnectWebSocket();
    showAuthModal();
});

// ========== 大厅 ==========
function showAuthModal() {
    authModal.style.display = 'flex';
    lobby.style.display = 'none';
    gameRoomEl.style.display = 'none';
}

function showLobby() {
    authModal.style.display = 'none';
    lobby.style.display = 'flex';
    gameRoomEl.style.display = 'none';
    displayUsername.textContent = currentUser ? currentUser.username : '未登录';
    if (currentUser) {
        userStats.textContent = `🏆 ${currentUser.wins || 0}胜 ${currentUser.losses || 0}负 ${currentUser.draws || 0}平`;
    }
    logoutBtn.style.display = currentUser ? 'block' : 'none';
    lobbyError.textContent = '';
    joinRoomInput.value = '';
    if (game) { game.isAI = false; game.cleanup(); }
    loadRoomList();
}

async function loadRoomList() {
    try {
        const rooms = await api('/api/rooms');
        if (rooms.length === 0) {
            roomList.innerHTML = '<p class="room-empty">暂无可用房间</p>';
            return;
        }
        roomList.innerHTML = rooms.map(room => `
            <div class="room-item" onclick="quickJoin('${room.room_code}')">
                <div class="room-item-info">
                    <span class="room-item-code">${room.room_code}</span>
                    <span class="room-item-host">${room.host_name}</span>
                </div>
                <span class="room-item-join">加入 →</span>
            </div>
        `).join('');
    } catch (err) {
        roomList.innerHTML = '<p class="room-empty">加载失败</p>';
    }
}

async function quickJoin(code) {
    joinRoomInput.value = code;
    try {
        const data = await api(`/api/rooms/${code}/join`, 'POST');
        currentRoom = {
            room_code: data.room_code,
            status: 'playing',
            white_player: data.white_player,
            black_player: data.black_player
        };
        showGameRoom();
        game.isAI = false;
        game.myColor = 'white';
        game.onGameStart();
        connectWebSocket(currentRoom.room_code);
    } catch (err) {
        lobbyError.textContent = err.message;
        loadRoomList();
    }
}

refreshRoomsBtn.addEventListener('click', loadRoomList);

aiPlayBtn.addEventListener('click', () => {
    currentRoom = {
        room_code: 'AI',
        status: 'playing',
        white_player: currentUser ? currentUser.username : '玩家',
        black_player: '电脑'
    };
    showGameRoom();
    game.isAI = true;
    game.myColor = 'white';
    game.onGameStart();
});

createRoomBtn.addEventListener('click', async () => {
    try {
        const data = await api('/api/rooms', 'POST');
        currentRoom = {
            room_code: data.room_code,
            status: 'waiting',
            white_player: currentUser ? currentUser.username : '未知',
            black_player: null
        };
        showGameRoom();
        game.isAI = false;
        game.myColor = 'white';
        connectWebSocket(currentRoom.room_code);
    } catch (err) {
        lobbyError.textContent = err.message;
    }
});

joinRoomBtn.addEventListener('click', async () => {
    const code = joinRoomInput.value.trim().toUpperCase();
    if (!code) { lobbyError.textContent = '请输入房间号'; return; }
    try {
        const data = await api(`/api/rooms/${code}/join`, 'POST');
        currentRoom = {
            room_code: data.room_code,
            status: 'playing',
            white_player: data.white_player,
            black_player: data.black_player
        };
        showGameRoom();
        game.isAI = false;
        game.myColor = 'white';
        game.onGameStart();
        connectWebSocket(currentRoom.room_code);
    } catch (err) {
        lobbyError.textContent = err.message;
    }
});

// ========== 求和弹窗 ==========
function showDrawOffer(offerName, roomCode) {
    showModal({
        title: '求和请求',
        message: `${offerName} 请求和棋，是否同意？`,
        buttons: [
            {
                text: '同意',
                bg: '#48bb78',
                onClick: async () => {
                    drawModalShown = false;
                    try {
                        await api(`/api/rooms/${roomCode}/draw_respond`, 'POST', { accept: true });
                    } catch (err) {}
                }
            },
            {
                text: '拒绝',
                bg: '#f56565',
                onClick: async () => {
                    drawModalShown = false;
                    try {
                        await api(`/api/rooms/${roomCode}/draw_respond`, 'POST', { accept: false });
                    } catch (err) {}
                }
            }
        ],
        autoClose: 30000
    });
}

// ========== 游戏界面 ==========
function showGameRoom() {
    lobby.style.display = 'none';
    gameRoomEl.style.display = 'flex';
    roomCodeDisplay.textContent = currentRoom.room_code === 'AI' ? '人机对战' : '房间: ' + currentRoom.room_code;
    updatePlayerNames();
    if (!game) game = new ChessGame();
    game.reset(currentRoom);
    if (drawBtn) drawBtn.style.display = currentRoom.room_code === 'AI' ? 'none' : 'flex';
}

function updatePlayerNames() {
    whiteNameEl.textContent = currentRoom?.white_player || '等待中';
    blackNameEl.textContent = currentRoom?.black_player || '等待中';
}

leaveRoomBtn.addEventListener('click', async () => {
    if (currentRoom && !game.isAI) {
        try {
            await api(`/api/rooms/${currentRoom.room_code}/leave`, 'POST');
        } catch (err) {}
    }
    disconnectWebSocket();
    currentRoom = null;
    if (game) { game.isAI = false; game.cleanup(); }
    showLobby();
});

restartBtn.addEventListener('click', async () => {
    if (!currentRoom) return;
    if (game.isAI) {
        game.reset(currentRoom);
        game.onGameStart();
        return;
    }
    try {
        await api(`/api/rooms/${currentRoom.room_code}/restart`, 'POST');
    } catch (err) {
        showToast('重启失败');
    }
});

modalRestartBtn.addEventListener('click', async () => {
    winModal.style.display = 'none';
    checkModal.style.display = 'none';
    if (!currentRoom) return;
    if (game.isAI) {
        game.reset(currentRoom);
        game.onGameStart();
        return;
    }
    try {
        await api(`/api/rooms/${currentRoom.room_code}/restart`, 'POST');
    } catch (err) {
        showToast('重启失败');
    }
});

checkModalBtn.addEventListener('click', () => {
    checkModal.style.display = 'none';
});

drawBtn.addEventListener('click', async () => {
    if (!currentRoom || game.isAI || game.gameOver) return;
    try {
        await api(`/api/rooms/${currentRoom.room_code}/draw_offer`, 'POST');
        gameHint.textContent = '已发送求和请求，等待对方回应...';
    } catch (err) {
        showToast(err.message);
    }
});

// ========== 棋子动画类 ==========
class PieceAnimation {
    constructor(fromX, fromY, toX, toY, piece, color) {
        this.fromX = fromX;
        this.fromY = fromY;
        this.toX = toX;
        this.toY = toY;
        this.piece = piece;
        this.color = color;
        this.progress = 0;
        this.duration = 350;
        this.startTime = Date.now();
        this.active = true;
    }
    
    update() {
        const elapsed = Date.now() - this.startTime;
        this.progress = Math.min(elapsed / this.duration, 1);
        // 缓动函数 - easeOutCubic
        this.progress = 1 - Math.pow(1 - this.progress, 3);
        if (this.progress >= 1) {
            this.active = false;
        }
    }
    
    getCurrentPosition() {
        const x = this.fromX + (this.toX - this.fromX) * this.progress;
        const y = this.fromY + (this.toY - this.fromY) * this.progress;
        const scale = 1 + 0.1 * Math.sin(this.progress * Math.PI);
        return { x, y, scale };
    }
}

// ========== 国际象棋游戏类 ==========
class ChessGame {
    constructor() {
        this.board = this.initBoard();
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.gameOver = false;
        this.gameStarted = false;
        this.gameStartTime = null;
        this.timerInterval = null;
        this.myColor = 'white';
        this.isAI = false;
        this.lastMove = null;
        this.animations = [];
        this.moveCount = 0;
        this.inCheck = false;
        this.pieceSymbols = {
            'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
            'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
        };
        this.canvas = document.getElementById('board');
        this.ctx = this.canvas.getContext('2d');
        this.cellSize = 600 / 8;
        this.animationId = null;
        
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.drawBoard();
    }

    initBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        const backRanks = {
            'white': ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
            'black': ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
        };
        for (let col = 0; col < 8; col++) {
            board[1][col] = { type: 'P', color: 'white' };
            board[0][col] = { type: backRanks.white[col], color: 'white' };
            board[6][col] = { type: 'p', color: 'black' };
            board[7][col] = { type: backRanks.black[col], color: 'black' };
        }
        return board;
    }

    reset(roomData) {
        this.stopTimer();
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.board = this.initBoard();
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.gameOver = false;
        this.gameStarted = false;
        this.gameStartTime = null;
        this.lastMove = null;
        this.animations = [];
        this.moveCount = 0;
        this.inCheck = false;
        movesList.innerHTML = '';
        moveCountEl.textContent = '0';
        gameTimeEl.textContent = '00:00';
        gameStatusDiv.textContent = '';
        gameStatusDiv.className = 'status-display';
        gameHint.textContent = '';
        gameHint.className = 'hint-text';
        winModal.style.display = 'none';
        checkModal.style.display = 'none';
        turnIndicator.className = 'turn-display white-turn';
        currentPlayerText.textContent = '白棋走子';
        whiteCard.classList.remove('in-check');
        blackCard.classList.remove('in-check');
        whiteCard.classList.add('active-player');
        blackCard.classList.remove('active-player');
        
        if (roomData && roomData.status === 'waiting') {
            gameHint.textContent = '等待对手加入...';
            gameStatusDiv.textContent = '等待中';
        }
        this.drawBoard();
    }

    onGameStart() {
        if (this.gameStarted) return;
        this.gameStarted = true;
        this.gameStartTime = Date.now();
        this.startTimer();
        gameStatusDiv.textContent = '游戏进行中';
        gameStatusDiv.className = 'status-display';
        this.updateTurnUI();
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

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    cleanup() {
        this.stopTimer();
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    getPieceSymbol(piece) {
        if (!piece) return '';
        return this.pieceSymbols[piece.type] || '';
    }

    // ========== 走法生成 ==========
    getLegalMoves(fromRow, fromCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return [];
        
        const moves = [];
        const color = piece.color;
        const type = piece.type.toUpperCase();
        
        const addMove = (toRow, toCol) => {
            if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
            const target = this.board[toRow][toCol];
            if (target && target.color === color) return false;
            moves.push({ fromRow, fromCol, toRow, toCol });
            return !target;
        };
        
        const addSlidingMoves = (dirs) => {
            for (const [dr, dc] of dirs) {
                let r = fromRow + dr, c = fromCol + dc;
                while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                    if (!addMove(r, c)) break;
                    r += dr;
                    c += dc;
                }
            }
        };
        
        switch (type) {
            case 'P': {
                const dir = color === 'white' ? 1 : -1;
                const startRow = color === 'white' ? 1 : 6;
                // 前进一步
                if (fromRow + dir >= 0 && fromRow + dir < 8 && !this.board[fromRow + dir][fromCol]) {
                    moves.push({ fromRow, fromCol, toRow: fromRow + dir, toCol: fromCol });
                    // 前进两步
                    if (fromRow === startRow && !this.board[fromRow + 2 * dir][fromCol]) {
                        moves.push({ fromRow, fromCol, toRow: fromRow + 2 * dir, toCol: fromCol });
                    }
                }
                // 吃子
                for (const dc of [-1, 1]) {
                    const toRow = fromRow + dir, toCol = fromCol + dc;
                    if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
                        const target = this.board[toRow][toCol];
                        if (target && target.color !== color) {
                            moves.push({ fromRow, fromCol, toRow, toCol });
                        }
                    }
                }
                break;
            }
            case 'R':
                addSlidingMoves([[1,0],[-1,0],[0,1],[0,-1]]);
                break;
            case 'B':
                addSlidingMoves([[1,1],[1,-1],[-1,1],[-1,-1]]);
                break;
            case 'Q':
                addSlidingMoves([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
                break;
            case 'N': {
                const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
                for (const [dr, dc] of knightMoves) {
                    const toRow = fromRow + dr, toCol = fromCol + dc;
                    if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
                        const target = this.board[toRow][toCol];
                        if (!target || target.color !== color) {
                            moves.push({ fromRow, fromCol, toRow, toCol });
                        }
                    }
                }
                break;
            }
            case 'K': {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const toRow = fromRow + dr, toCol = fromCol + dc;
                        if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
                            const target = this.board[toRow][toCol];
                            if (!target || target.color !== color) {
                                moves.push({ fromRow, fromCol, toRow, toCol });
                            }
                        }
                    }
                }
                break;
            }
        }
        return moves;
    }

    // ========== 将军检测 ==========
    findKing(color) {
        const kingType = color === 'white' ? 'K' : 'k';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.type === kingType && p.color === color) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    isInCheck(color) {
        const king = this.findKing(color);
        if (!king) return true;
        
        const opponent = color === 'white' ? 'black' : 'white';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.color === opponent) {
                    const moves = this.getLegalMoves(r, c);
                    for (const move of moves) {
                        if (move.toRow === king.row && move.toCol === king.col) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    isCheckmate(color) {
        if (!this.isInCheck(color)) return false;
        return this.hasLegalMoves(color);
    }

    isStalemate(color) {
        if (this.isInCheck(color)) return false;
        return this.hasLegalMoves(color);
    }

    hasLegalMoves(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.color === color) {
                    const moves = this.getLegalMoves(r, c);
                    for (const move of moves) {
                        // 模拟走法检查是否解除将军
                        const captured = this.board[move.toRow][move.toCol];
                        this.board[move.toRow][move.toCol] = this.board[move.fromRow][move.fromCol];
                        this.board[move.fromRow][move.fromCol] = null;
                        const inCheck = this.isInCheck(color);
                        this.board[move.fromRow][move.fromCol] = this.board[move.toRow][move.toCol];
                        this.board[move.toRow][move.toCol] = captured;
                        if (!inCheck) return false;
                    }
                }
            }
        }
        return true;
    }

    // ========== 执行走法 ==========
    makeMove(move, animate = true) {
        const { fromRow, fromCol, toRow, toCol } = move;
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow][toCol];
        
        // 创建动画
        if (animate) {
            const fromX = fromCol * this.cellSize + this.cellSize / 2;
            const fromY = fromRow * this.cellSize + this.cellSize / 2;
            const toX = toCol * this.cellSize + this.cellSize / 2;
            const toY = toRow * this.cellSize + this.cellSize / 2;
            this.animations.push(new PieceAnimation(fromX, fromY, toX, toY, piece, piece.color));
            
            // 如果有吃子，添加闪烁效果
            if (captured) {
                // 在吃子位置添加一个消失动画
            }
        }
        
        this.moveHistory.push({
            fromRow, fromCol, toRow, toCol,
            piece: piece,
            captured: captured
        });
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        this.lastMove = { fromRow, fromCol, toRow, toCol };
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
        this.moveCount = this.moveHistory.length;
        moveCountEl.textContent = this.moveCount;
        
        // 更新走法记录
        this.updateMoveHistory();
        this.updateTurnUI();
        
        // 检测将军
        const inCheck = this.isInCheck(this.currentTurn);
        this.inCheck = inCheck;
        
        if (inCheck) {
            // 检测是否将死
            if (this.isCheckmate(this.currentTurn)) {
                // 将死！
                this.gameOver = true;
                this.stopTimer();
                const winner = this.currentTurn === 'white' ? '黑方' : '白方';
                gameStatusDiv.textContent = '将死！';
                gameStatusDiv.className = 'status-display win';
                gameHint.textContent = `${winner}胜！`;
                resultIcon.textContent = '👑';
                resultTitle.textContent = '将死！';
                winnerDisplay.textContent = `${winner}获胜！`;
                winDescription.textContent = `经过 ${this.moveCount} 步`;
                winModal.style.display = 'flex';
                this.drawBoard();
                return;
            }
            
            // 显示将军提示
            this.showCheckAlert(this.currentTurn);
        } else {
            // 检测逼和
            if (this.isStalemate(this.currentTurn)) {
                this.gameOver = true;
                this.stopTimer();
                gameStatusDiv.textContent = '逼和';
                gameStatusDiv.className = 'status-display win';
                gameHint.textContent = '和棋';
                resultIcon.textContent = '🤝';
                resultTitle.textContent = '逼和';
                winnerDisplay.textContent = '棋盘已满，无法走棋';
                winDescription.textContent = `经过 ${this.moveCount} 步`;
                winModal.style.display = 'flex';
                this.drawBoard();
                return;
            }
        }
        
        // 检测吃子动画
        this.drawBoard();
    }

    showCheckAlert(color) {
        const playerName = color === 'white' ? '白方' : '黑方';
        checkMessage.textContent = `${playerName}的王被将军了！必须立刻解围！`;
        checkModal.style.display = 'flex';
        gameStatusDiv.textContent = '将军！';
        gameStatusDiv.className = 'status-display check';
        gameHint.textContent = `${playerName}被将军！`;
        gameHint.className = 'hint-text check';
        
        // 高亮显示王的格子
        const king = this.findKing(color);
        if (king) {
            // 在王的格子上显示红色高亮
            this.drawBoard();
            const ctx = this.ctx;
            const x = king.col * this.cellSize;
            const y = king.row * this.cellSize;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(x, y, this.cellSize, this.cellSize);
            // 重新绘制棋子
            const piece = this.board[king.row][king.col];
            if (piece) {
                const cx = x + this.cellSize / 2;
                const cy = y + this.cellSize / 2;
                ctx.font = 'bold 44px "Segoe UI", "Arial Unicode MS", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(255,0,0,0.5)';
                ctx.shadowBlur = 20;
                ctx.fillStyle = piece.color === 'white' ? '#ffffff' : '#1a1a1a';
                ctx.fillText(this.getPieceSymbol(piece), cx, cy);
                ctx.shadowBlur = 0;
            }
        }
    }

    updateMoveHistory() {
        const listEl = movesList;
        listEl.innerHTML = '';
        this.moveHistory.forEach((move, index) => {
            const moveNum = Math.floor(index / 2) + 1;
            const item = document.createElement('span');
            item.className = 'move-item';
            const from = String.fromCharCode(97 + move.fromCol) + (8 - move.fromRow);
            const to = String.fromCharCode(97 + move.toCol) + (8 - move.toRow);
            const pieceSymbol = this.getPieceSymbol(move.piece);
            const capture = move.captured ? 'x' : '-';
            const prefix = index % 2 === 0 ? `${moveNum}.` : '';
            item.textContent = `${prefix} ${pieceSymbol}${from}${capture}${to}`;
            listEl.appendChild(item);
        });
        listEl.scrollTop = listEl.scrollHeight;
    }

    updateTurnUI() {
        const isWhiteTurn = this.currentTurn === 'white';
        turnIndicator.className = 'turn-display ' + (isWhiteTurn ? 'white-turn' : 'black-turn');
        if (this.inCheck) {
            turnIndicator.className += ' check';
        }
        currentPlayerText.textContent = isWhiteTurn ? '白棋走子' : '黑棋走子';
        
        whiteCard.classList.toggle('active-player', isWhiteTurn);
        blackCard.classList.toggle('active-player', !isWhiteTurn);
        
        whiteCard.classList.toggle('in-check', this.inCheck && this.currentTurn === 'white');
        blackCard.classList.toggle('in-check', this.inCheck && this.currentTurn === 'black');
        
        if (this.gameStarted && !this.gameOver) {
            const isMyTurn = this.myColor === this.currentTurn;
            if (this.inCheck) {
                gameHint.textContent = isMyTurn ? '⚠️ 你的王被将军了！必须解围！' : '对方王被将军！';
                gameHint.className = 'hint-text check';
            } else {
                gameHint.textContent = isMyTurn ? '轮到你了！' : '等待对方走棋...';
                gameHint.className = 'hint-text';
            }
        }
    }

    // ========== 绘制棋盘 ==========
    drawBoard() {
        const ctx = this.ctx;
        const size = 600;
        const cell = this.cellSize;
        
        ctx.clearRect(0, 0, size, size);
        
        // 绘制棋盘
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const isLight = (row + col) % 2 === 0;
                ctx.fillStyle = isLight ? '#f0d9b5' : '#b58863';
                ctx.fillRect(col * cell, row * cell, cell, cell);
                
                // 标记最后一步
                if (this.lastMove) {
                    if ((row === this.lastMove.fromRow && col === this.lastMove.fromCol) ||
                        (row === this.lastMove.toRow && col === this.lastMove.toCol)) {
                        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                        ctx.fillRect(col * cell, row * cell, cell, cell);
                    }
                }
            }
        }
        
        // 高亮选中的棋子
        if (this.selectedSquare) {
            const { row, col } = this.selectedSquare;
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(col * cell, row * cell, cell, cell);
        }
        
        // 显示合法走法
        if (this.selectedSquare) {
            const { row, col } = this.selectedSquare;
            const moves = this.getLegalMoves(row, col);
            for (const move of moves) {
                // 检查走法是否合法（不导致被将军）
                const captured = this.board[move.toRow][move.toCol];
                this.board[move.toRow][move.toCol] = this.board[move.fromRow][move.fromCol];
                this.board[move.fromRow][move.fromCol] = null;
                const inCheck = this.isInCheck(this.myColor);
                this.board[move.fromRow][move.fromCol] = this.board[move.toRow][move.toCol];
                this.board[move.toRow][move.toCol] = captured;
                if (inCheck) continue;
                
                const x = move.toCol * cell + cell / 2;
                const y = move.toRow * cell + cell / 2;
                ctx.beginPath();
                if (this.board[move.toRow][move.toCol]) {
                    ctx.arc(x, y, cell / 2 - 4, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                } else {
                    ctx.arc(x, y, 10, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.fill();
                }
            }
        }
        
        // 绘制棋子
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    const x = col * cell + cell / 2;
                    const y = row * cell + cell / 2;
                    
                    // 如果这个棋子正在被将军且是王，添加红色闪烁
                    const isKing = piece.type === 'K' || piece.type === 'k';
                    const isInCheckNow = this.inCheck && isKing && piece.color === this.currentTurn;
                    
                    ctx.font = 'bold 44px "Segoe UI", "Arial Unicode MS", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    if (isInCheckNow) {
                        ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
                        ctx.shadowBlur = 30;
                    } else {
                        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                        ctx.shadowBlur = 10;
                    }
                    
                    ctx.fillStyle = piece.color === 'white' ? '#ffffff' : '#1a1a1a';
                    ctx.fillText(this.getPieceSymbol(piece), x, y);
                    
                    // 白色棋子加描边
                    if (piece.color === 'white') {
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                        ctx.lineWidth = 1;
                        ctx.strokeText(this.getPieceSymbol(piece), x, y);
                    }
                    ctx.shadowBlur = 0;
                }
            }
        }
        
        // 绘制动画棋子（在最上层）
        for (const anim of this.animations) {
            const pos = anim.getCurrentPosition();
            const x = pos.x;
            const y = pos.y;
            const scale = pos.scale || 1;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            ctx.font = 'bold 44px "Segoe UI", "Arial Unicode MS", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 20;
            ctx.fillStyle = anim.color === 'white' ? '#ffffff' : '#1a1a1a';
            ctx.fillText(this.getPieceSymbol(anim.piece), 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
        
        // 如果将军提示打开，绘制红色高亮
        if (checkModal.style.display !== 'none') {
            const king = this.findKing(this.currentTurn);
            if (king) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                ctx.fillRect(king.col * cell, king.row * cell, cell, cell);
            }
        }
        
        // 动画循环
        let hasActiveAnimation = false;
        for (const anim of this.animations) {
            if (anim.active) {
                hasActiveAnimation = true;
                anim.update();
            }
        }
        // 移除已完成的动画
        this.animations = this.animations.filter(a => a.active);
        
        if (hasActiveAnimation) {
            this.animationId = requestAnimationFrame(() => this.drawBoard());
        } else {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }
    }

    // ========== 点击处理 ==========
    handleClick(e) {
        if (this.gameOver || !this.gameStarted || this.myColor !== this.currentTurn) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const size = 600;
        const scale = size / rect.width;
        const x = (e.clientX - rect.left) * scale;
        const y = (e.clientY - rect.top) * scale;
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        if (row < 0 || row > 7 || col < 0 || col > 7) return;
        
        const piece = this.board[row][col];
        
        if (this.selectedSquare) {
            const fromRow = this.selectedSquare.row;
            const fromCol = this.selectedSquare.col;
            
            if (fromRow === row && fromCol === col) {
                this.selectedSquare = null;
                this.drawBoard();
                return;
            }
            
            const moves = this.getLegalMoves(fromRow, fromCol);
            const move = moves.find(m => m.toRow === row && m.toCol === col);
            if (move) {
                // 检查走法是否合法（不导致被将军）
                const captured = this.board[move.toRow][move.toCol];
                this.board[move.toRow][move.toCol] = this.board[move.fromRow][move.fromCol];
                this.board[move.fromRow][move.fromCol] = null;
                const inCheck = this.isInCheck(this.myColor);
                this.board[move.fromRow][move.fromCol] = this.board[move.toRow][move.toCol];
                this.board[move.toRow][move.toCol] = captured;
                if (inCheck) {
                    showToast('⚠️ 你的王会被将军！不能这样走！');
                    return;
                }
                this.executeMove(move);
                this.selectedSquare = null;
                return;
            }
            
            if (piece && piece.color === this.myColor) {
                this.selectedSquare = { row, col };
                this.drawBoard();
                return;
            }
            
            this.selectedSquare = null;
            this.drawBoard();
            return;
        }
        
        if (piece && piece.color === this.myColor) {
            this.selectedSquare = { row, col };
            this.drawBoard();
        }
    }

    async executeMove(move) {
        if (this.isAI) {
            this.makeMove(move);
            if (!this.gameOver) {
                setTimeout(() => this.aiMove(), 400);
            }
            return;
        }
        
        try {
            const data = await api(`/api/rooms/${currentRoom.room_code}/move`, 'POST', {
                fromRow: move.fromRow,
                fromCol: move.fromCol,
                toRow: move.toRow,
                toCol: move.toCol
            });
            this.syncFromServer(data);
        } catch (err) {
            showToast(err.message);
            this.drawBoard();
        }
    }

    syncFromServer(data) {
        this.board = data.board_state;
        this.currentTurn = data.current_turn;
        this.moveHistory = data.move_history || [];
        this.moveCount = this.moveHistory.length;
        moveCountEl.textContent = this.moveCount;
        
        if (this.moveHistory.length > 0) {
            const last = this.moveHistory[this.moveHistory.length - 1];
            this.lastMove = { fromRow: last.fromRow, fromCol: last.fromCol, toRow: last.toRow, toCol: last.toCol };
        }
        
        this.updateMoveHistory();
        
        if (data.game_over) {
            this.gameOver = true;
            this.stopTimer();
            gameStatusDiv.textContent = '游戏结束';
            gameStatusDiv.className = 'status-display win';
            gameHint.textContent = '游戏结束';
            
            if (data.draw) {
                resultIcon.textContent = '🤝';
                resultTitle.textContent = '和棋';
                winnerDisplay.textContent = '和棋';
                winDescription.textContent = `经过 ${this.moveCount} 步`;
            } else {
                const winner = data.winner || '';
                const isMe = currentUser && winner === currentUser.username;
                resultIcon.textContent = isMe ? '👑' : '😢';
                resultTitle.textContent = isMe ? '你赢了！' : '你输了';
                winnerDisplay.textContent = `${winner} 获胜！`;
                winDescription.textContent = `经过 ${this.moveCount} 步`;
            }
            winModal.style.display = 'flex';
        } else {
            this.inCheck = this.isInCheck(this.currentTurn);
            this.updateTurnUI();
        }
        this.drawBoard();
    }

    // ========== AI（简单但完整的走法） ==========
    aiMove() {
        if (this.gameOver || !this.isAI) return;
        
        const allMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === 'black') {
                    const moves = this.getLegalMoves(r, c);
                    for (const move of moves) {
                        // 检查走法是否合法（不导致被将军）
                        const captured = this.board[move.toRow][move.toCol];
                        this.board[move.toRow][move.toCol] = this.board[move.fromRow][move.fromCol];
                        this.board[move.fromRow][move.fromCol] = null;
                        const inCheck = this.isInCheck('black');
                        this.board[move.fromRow][move.fromCol] = this.board[move.toRow][move.toCol];
                        this.board[move.toRow][move.toCol] = captured;
                        if (!inCheck) {
                            allMoves.push(move);
                        }
                    }
                }
            }
        }
        
        if (allMoves.length === 0) {
            // 没有合法走法
            if (this.isInCheck('black')) {
                // 将死
                this.gameOver = true;
                this.stopTimer();
                gameStatusDiv.textContent = '将死！';
                gameStatusDiv.className = 'status-display win';
                gameHint.textContent = '你赢了！';
                resultIcon.textContent = '👑';
                resultTitle.textContent = '你赢了！';
                winnerDisplay.textContent = '白方获胜！';
                winDescription.textContent = `经过 ${this.moveCount} 步`;
                winModal.style.display = 'flex';
                this.drawBoard();
                return;
            } else {
                // 逼和
                this.gameOver = true;
                this.stopTimer();
                gameStatusDiv.textContent = '逼和';
                gameStatusDiv.className = 'status-display win';
                gameHint.textContent = '和棋';
                resultIcon.textContent = '🤝';
                resultTitle.textContent = '和棋';
                winnerDisplay.textContent = '棋盘已满，无法走棋';
                winDescription.textContent = `经过 ${this.moveCount} 步`;
                winModal.style.display = 'flex';
                this.drawBoard();
                return;
            }
        }
        
        // 走法评估
        const pieceValues = {
            'p': 1, 'P': 1,
            'n': 3, 'N': 3,
            'b': 3, 'B': 3,
            'r': 5, 'R': 5,
            'q': 9, 'Q': 9,
            'k': 100, 'K': 100
        };
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of allMoves) {
            let score = 0;
            const target = this.board[move.toRow][move.toCol];
            if (target) {
                score += pieceValues[target.type] || 0;
                // 吃子额外加分
                score += 10;
            }
            // 中心偏好
            const centerDist = Math.abs(move.toCol - 3.5) + Math.abs(move.toRow - 3.5);
            score += (7 - centerDist) * 2;
            // 随机因素（让AI不那么死板）
            score += Math.random() * 2;
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        if (bestMove) {
            this.makeMove(bestMove);
            if (!this.gameOver) {
                this.updateTurnUI();
            }
        }
    }
}

// ========== 初始化 ==========
window.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        api('/api/me')
            .then(u => {
                currentUser = u;
                showLobby();
            })
            .catch(() => {
                localStorage.removeItem('chess_token');
                authToken = '';
                showAuthModal();
            });
    } else {
        showAuthModal();
    }
});

// 将 quickJoin 设为全局以便在 HTML 中使用
window.quickJoin = quickJoin;