// ==================== 配置 ====================
const BOARD_SIZE = 15;
const CELL_SIZE = 36;
const PADDING = 30;

// 【重要】改成你的 Railway 后端域名（不要带末尾斜杠）
const API_URL = 'https://chees-backend.up.railway.app/health';

// ==================== DOM 引用 ====================
const canvas = document.getElementById('boardCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('gameStatus');
const turnIndicator = document.getElementById('turnIndicator');
const restartBtn = document.getElementById('restartBtn');
const undoBtn = document.getElementById('undoBtn');
const historyList = document.getElementById('historyList');

// ==================== 游戏状态 ====================
let board = [];
let currentPlayer = 1;      // 1=玩家(黑), 2=AI(白)
let gameOver = false;
let moveHistory = [];
let lastMove = null;
let isAIThinking = false;

// ==================== 棋盘初始化 ====================
function initBoard() {
    board = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        board.push(new Array(BOARD_SIZE).fill(0));
    }
}

function initGame() {
    initBoard();
    currentPlayer = 1;
    gameOver = false;
    moveHistory = [];
    lastMove = null;
    isAIThinking = false;
    undoBtn.disabled = true;
    historyList.innerHTML = '<div style="color:#aaa;font-size:13px;">暂无落子记录</div>';
    statusEl.textContent = '你的回合 · 黑子先行';
    turnIndicator.textContent = '●';
    turnIndicator.style.color = '#1a1a1a';
    // 移除弹窗
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    drawBoard();
}

// ==================== 绘制棋盘 ====================
function drawBoard() {
    const size = BOARD_SIZE * CELL_SIZE + PADDING * 2;
    canvas.width = size;
    canvas.height = size;

    // 背景
    ctx.fillStyle = '#deb887';
    ctx.fillRect(0, 0, size, size);

    // 网格线
    ctx.strokeStyle = '#5a3e1b';
    ctx.lineWidth = 1;
    for (let i = 0; i < BOARD_SIZE; i++) {
        const pos = PADDING + i * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(PADDING, pos);
        ctx.lineTo(PADDING + (BOARD_SIZE - 1) * CELL_SIZE, pos);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos, PADDING);
        ctx.lineTo(pos, PADDING + (BOARD_SIZE - 1) * CELL_SIZE);
        ctx.stroke();
    }

    // 星位
    const stars = [[7, 7], [3, 3], [11, 3], [3, 11], [11, 11]];
    ctx.fillStyle = '#5a3e1b';
    stars.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(PADDING + x * CELL_SIZE, PADDING + y * CELL_SIZE, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // 绘制所有棋子
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] !== 0) {
                drawPiece(col, row, board[row][col]);
            }
        }
    }

    // 标记最后一步
    if (lastMove) {
        const [x, y] = lastMove;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(PADDING + x * CELL_SIZE, PADDING + y * CELL_SIZE, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(PADDING + x * CELL_SIZE, PADDING + y * CELL_SIZE, 5, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawPiece(col, row, player) {
    const x = PADDING + col * CELL_SIZE;
    const y = PADDING + row * CELL_SIZE;
    const radius = CELL_SIZE / 2 - 3;

    const gradient = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, radius);
    if (player === 1) {
        gradient.addColorStop(0, '#333');
        gradient.addColorStop(1, '#000');
    } else {
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, '#ccc');
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = player === 1 ? '#000' : '#aaa';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// ==================== 游戏逻辑 ====================
function checkWin(row, col, player) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let [dx, dy] of directions) {
        let count = 1;
        for (let step = 1; step < 5; step++) {
            const nr = row + dx * step, nc = col + dy * step;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
            if (board[nr][nc] !== player) break;
            count++;
        }
        for (let step = 1; step < 5; step++) {
            const nr = row - dx * step, nc = col - dy * step;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
            if (board[nr][nc] !== player) break;
            count++;
        }
        if (count >= 5) return true;
    }
    return false;
}

function isBoardFull() {
    for (let row of board) {
        if (row.includes(0)) return false;
    }
    return true;
}

function makeMove(col, row, player) {
    if (board[row][col] !== 0) return false;
    board[row][col] = player;
    moveHistory.push({ col, row, player });
    lastMove = [col, row];
    drawBoard();
    updateHistory();
    undoBtn.disabled = false;

    if (checkWin(row, col, player)) {
        gameOver = true;
        const name = player === 1 ? '你' : 'AI';
        statusEl.textContent = `${name} 赢了！🎉`;
        showWinner(name);
        return true;
    }
    if (isBoardFull()) {
        gameOver = true;
        statusEl.textContent = '平局！';
        showDraw();
        return true;
    }
    return true;
}

function updateHistory() {
    if (moveHistory.length === 0) {
        historyList.innerHTML = '<div style="color:#aaa;font-size:13px;">暂无落子记录</div>';
        return;
    }
    const html = moveHistory.map((m, i) => {
        const label = m.player === 1 ? '黑' : '白';
        const cls = m.player === 1 ? 'black-step' : 'white-step';
        const colLabel = String.fromCharCode(65 + m.col);
        return `<div class="history-item ${cls}">
            <span class="step-num">#${i+1}</span>
            <span class="step-move">${label} (${colLabel}${m.row+1})</span>
        </div>`;
    }).reverse().join('');
    historyList.innerHTML = html;
}

// ==================== AI 调用 ====================
async function callAI() {
    if (isAIThinking || gameOver) return;
    isAIThinking = true;
    statusEl.textContent = 'AI 思考中 ... 🤔';
    turnIndicator.textContent = '⏳';

    try {
        const resp = await fetch(`${API_URL}/api/ai-move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board, player: 2 })
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        if (data.success) {
            makeMove(data.x, data.y, 2);
            if (!gameOver) {
                currentPlayer = 1;
                statusEl.textContent = '你的回合 · 黑子';
                turnIndicator.textContent = '●';
                turnIndicator.style.color = '#1a1a1a';
            }
        } else {
            statusEl.textContent = 'AI 出错: ' + (data.message || '未知错误');
        }
    } catch (e) {
        console.error('AI 调用失败:', e);
        statusEl.textContent = '网络错误，请检查后端是否运行';
    }
    isAIThinking = false;
}

// ==================== 玩家点击 ====================
function handleCanvasClick(e) {
    if (gameOver || isAIThinking || currentPlayer !== 1) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const col = Math.round((cx - PADDING) / CELL_SIZE);
    const row = Math.round((cy - PADDING) / CELL_SIZE);
    if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return;
    if (board[row][col] !== 0) return;

    makeMove(col, row, 1);
    if (!gameOver) {
        currentPlayer = 2;
        statusEl.textContent = 'AI 思考中 ...';
        turnIndicator.textContent = '⏳';
        callAI();
    }
}

// ==================== 弹窗 ====================
function showWinner(name) {
    const div = document.createElement('div');
    div.className = 'modal-overlay active';
    div.innerHTML = `
        <div class="modal">
            <span class="winner-emoji">${name === '你' ? '🎉' : '🤖'}</span>
            <h2>${name} 获胜！</h2>
            <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove(); initGame();">再来一局</button>
        </div>
    `;
    document.body.appendChild(div);
}

function showDraw() {
    const div = document.createElement('div');
    div.className = 'modal-overlay active';
    div.innerHTML = `
        <div class="modal">
            <span class="winner-emoji">🤝</span>
            <h2>平局！</h2>
            <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove(); initGame();">再来一局</button>
        </div>
    `;
    document.body.appendChild(div);
}

// ==================== 事件绑定 ====================
canvas.addEventListener('click', handleCanvasClick);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleCanvasClick(e); });

restartBtn.addEventListener('click', initGame);

undoBtn.addEventListener('click', () => {
    if (moveHistory.length < 2 || isAIThinking) return;
    for (let i = 0; i < 2; i++) {
        const last = moveHistory.pop();
        board[last.row][last.col] = 0;
    }
    lastMove = moveHistory.length > 0
        ? [moveHistory[moveHistory.length - 1].col, moveHistory[moveHistory.length - 1].row]
        : null;
    currentPlayer = 1;
    gameOver = false;
    drawBoard();
    updateHistory();
    statusEl.textContent = '你的回合 · 黑子';
    turnIndicator.textContent = '●';
    turnIndicator.style.color = '#1a1a1a';
    if (moveHistory.length === 0) undoBtn.disabled = true;
});

// ==================== 启动游戏 ====================
initGame();
window.addEventListener('resize', drawBoard);