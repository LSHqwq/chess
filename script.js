class Gomoku {
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
        this.lastMove = null;
        this.winLine = null;
        
        // DOM元素
        this.canvas = document.getElementById('board');
        this.ctx = this.canvas.getContext('2d');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.currentPlayerText = document.getElementById('current-player-text');
        this.moveCountSpan = document.getElementById('move-count');
        this.gameTimeSpan = document.getElementById('game-time');
        this.gameStatusDiv = document.getElementById('game-status');
        this.winModal = document.getElementById('win-modal');
        this.winnerDisplay = document.getElementById('winner-display');
        this.winDescription = document.getElementById('win-description');
        this.blackCard = document.getElementById('black-player-card');
        this.whiteCard = document.getElementById('white-player-card');
        
        this.init();
        this.bindEvents();
        this.startTimer();
    }
    
    init() {
        this.pieces = Array(this.boardSize).fill(null).map(() => 
            Array(this.boardSize).fill(null)
        );
        this.history = [];
        this.currentPlayer = 'black';
        this.gameOver = false;
        this.moveCount = 0;
        this.lastMove = null;
        this.winLine = null;
        this.gameStartTime = Date.now();
        
        this.updateUI();
        this.drawBoard();
    }
    
    bindEvents() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));
        this.canvas.addEventListener('mouseleave', () => this.drawBoard());
        
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('modal-restart-btn').addEventListener('click', () => {
            this.hideWinModal();
            this.restart();
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            } else if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.restart();
            }
        });
    }
    
    updateUI() {
        // 当前回合
        this.turnIndicator.className = 'turn-display ' + 
            (this.currentPlayer === 'black' ? 'black-turn' : 'white-turn');
        this.currentPlayerText.textContent = 
            this.currentPlayer === 'black' ? '黑棋走子' : '白棋走子';
        
        // 玩家卡片高亮
        this.blackCard.classList.toggle('active-player', this.currentPlayer === 'black');
        this.whiteCard.classList.toggle('active-player', this.currentPlayer === 'white');
        
        // 步数
        this.moveCountSpan.textContent = this.moveCount;
        
        // 状态
        if (!this.gameOver) {
            this.gameStatusDiv.textContent = '🎯 游戏进行中';
            this.gameStatusDiv.className = 'status-display';
        }
    }
    
    startTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (!this.gameOver) {
                this.updateTimer();
            }
        }, 1000);
    }
    
    updateTimer() {
        const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        this.gameTimeSpan.textContent = `${minutes}:${seconds}`;
    }
    
    drawBoard(hoverX = -1, hoverY = -1) {
        const ctx = this.ctx;
        const size = this.boardSize;
        const cellSize = this.cellSize;
        const padding = this.padding;
        
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 棋盘背景
        const boardGradient = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        boardGradient.addColorStop(0, '#dcb35c');
        boardGradient.addColorStop(1, '#c9a03a');
        ctx.fillStyle = boardGradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 棋盘纹理（格子明暗交替）
        ctx.fillStyle = 'rgba(139, 105, 20, 0.04)';
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if ((i + j) % 2 === 0) {
                    ctx.fillRect(
                        padding + i * cellSize - cellSize/2,
                        padding + j * cellSize - cellSize/2,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
        
        // 网格线
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
        
        // 外边框加粗
        ctx.strokeStyle = '#3a2a0a';
        ctx.lineWidth = 3;
        ctx.strokeRect(padding, padding, (size - 1) * cellSize, (size - 1) * cellSize);
        
        // 星位
        const starPoints = [
            [3, 3], [3, 7], [3, 11],
            [7, 3], [7, 7], [7, 11],
            [11, 3], [11, 7], [11, 11]
        ];
        
        starPoints.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(padding + x * cellSize, padding + y * cellSize, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#3a2a0a';
            ctx.fill();
        });
        
        // 棋子
        this.pieces.forEach((row, y) => {
            row.forEach((piece, x) => {
                if (piece) {
                    this.drawPiece(x, y, piece, false);
                }
            });
        });
        
        // 最后落子标记
        if (this.lastMove && !this.gameOver) {
            const { x, y } = this.lastMove;
            ctx.beginPath();
            ctx.arc(padding + x * cellSize, padding + y * cellSize, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#e53e3e';
            ctx.fill();
        }
        
        // 获胜连线
        if (this.gameOver && this.winLine) {
            ctx.strokeStyle = '#e53e3e';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 4]);
            
            const first = this.winLine[0];
            const last = this.winLine[this.winLine.length - 1];
            
            ctx.beginPath();
            ctx.moveTo(padding + first.x * cellSize, padding + first.y * cellSize);
            ctx.lineTo(padding + last.x * cellSize, padding + last.y * cellSize);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // 悬停预览
        if (!this.gameOver && hoverX >= 0 && hoverX < size && hoverY >= 0 && hoverY < size && !this.pieces[hoverY][hoverX]) {
            this.drawPiece(hoverX, hoverY, this.currentPlayer, true);
        }
    }
    
    drawPiece(x, y, color, isPreview = false) {
        const ctx = this.ctx;
        const cx = this.padding + x * this.cellSize;
        const cy = this.padding + y * this.cellSize;
        const radius = this.cellSize / 2 - 2;
        
        ctx.save();
        
        if (isPreview) {
            ctx.globalAlpha = 0.4;
        }
        
        // 阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // 棋子
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
        
        // 边框
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // 高光
        if (!isPreview) {
            ctx.beginPath();
            ctx.arc(cx - 3, cy - 3, radius * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = color === 'black' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)';
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    handleClick(e) {
        if (this.gameOver) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        const x = Math.round((mouseX - this.padding) / this.cellSize);
        const y = Math.round((mouseY - this.padding) / this.cellSize);
        
        if (x < 0 || x >= this.boardSize || y < 0 || y >= this.boardSize) return;
        if (this.pieces[y][x]) return;
        
        this.placePiece(x, y);
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
            this.drawBoard(-1, -1);
        }
    }
    
    placePiece(x, y) {
        this.pieces[y][x] = this.currentPlayer;
        this.history.push({ x, y, player: this.currentPlayer });
        this.lastMove = { x, y };
        this.moveCount++;
        
        if (this.checkWin(x, y)) {
            this.gameOver = true;
            this.updateTimer();
            const winner = this.currentPlayer;
            this.gameStatusDiv.textContent = `🏆 ${winner === 'black' ? '黑棋' : '白棋'}获胜！`;
            this.gameStatusDiv.className = 'status-display win';
            this.showWinModal(winner);
        } else {
            this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        }
        
        this.updateUI();
        this.drawBoard();
    }
    
    checkWin(x, y) {
        const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
        
        for (const [dx, dy] of directions) {
            const line = [{x, y}];
            
            for (let i = 1; i < 5; i++) {
                const nx = x + dx * i;
                const ny = y + dy * i;
                if (nx >= 0 && nx < this.boardSize && ny >= 0 && ny < this.boardSize && this.pieces[ny][nx] === this.currentPlayer) {
                    line.push({x: nx, y: ny});
                } else break;
            }
            
            for (let i = 1; i < 5; i++) {
                const nx = x - dx * i;
                const ny = y - dy * i;
                if (nx >= 0 && nx < this.boardSize && ny >= 0 && ny < this.boardSize && this.pieces[ny][nx] === this.currentPlayer) {
                    line.unshift({x: nx, y: ny});
                } else break;
            }
            
            if (line.length >= 5) {
                this.winLine = line;
                return true;
            }
        }
        
        return false;
    }
    
    showWinModal(winner) {
        const winnerText = winner === 'black' ? '⚫ 黑棋' : '⚪ 白棋';
        this.winnerDisplay.textContent = winnerText;
        this.winDescription.textContent = `经过 ${this.moveCount} 步后获胜！`;
        this.winModal.style.display = 'flex';
        this.createConfetti();
    }
    
    hideWinModal() {
        this.winModal.style.display = 'none';
    }
    
    createConfetti() {
        const colors = ['#667eea', '#764ba2', '#f56565', '#48bb78', '#ed8936', '#f6e05e'];
        for (let i = 0; i < 60; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: ${6 + Math.random() * 8}px;
                height: ${6 + Math.random() * 8}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -20px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                animation: confettiFall ${1.5 + Math.random() * 2}s linear ${Math.random() * 0.8}s;
                pointer-events: none;
                z-index: 1001;
            `;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 3500);
        }
    }
    
    undo() {
        if (this.gameOver || this.history.length === 0) return;
        
        const lastMove = this.history.pop();
        this.pieces[lastMove.y][lastMove.x] = null;
        this.currentPlayer = lastMove.player;
        this.moveCount--;
        this.lastMove = this.history.length > 0 ? this.history[this.history.length - 1] : null;
        this.winLine = null;
        
        this.updateUI();
        this.drawBoard();
    }
    
    restart() {
        clearInterval(this.timerInterval);
        this.hideWinModal();
        this.init();
        this.startTimer();
    }
}

// 撒花动画
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
    @keyframes confettiFall {
        to {
            top: 105%;
            transform: rotate(720deg);
        }
    }
`;
document.head.appendChild(confettiStyle);

// 启动游戏
window.addEventListener('DOMContentLoaded', () => {
    new Gomoku();
});