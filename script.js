// 游戏核心逻辑
class ChessGame {
    constructor() {
        this.board = this.initBoard();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.gameOver = false;
        this.isKingInCheck = false;
        this.lastMove = null;
        
        this.setupEventListeners();
        this.render();
        this.updateStatus();
    }
    
    initBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // 初始化棋子
        const pieces = {
            white: { 
                back: ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
                pawn: 'P'
            },
            black: {
                back: ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
                pawn: 'p'
            }
        };
        
        // 白方
        for (let col = 0; col < 8; col++) {
            board[1][col] = { type: pieces.white.pawn, color: 'white' };
            board[0][col] = { type: pieces.white.back[col], color: 'white' };
        }
        
        // 黑方
        for (let col = 0; col < 8; col++) {
            board[6][col] = { type: pieces.black.pawn, color: 'black' };
            board[7][col] = { type: pieces.black.back[col], color: 'black' };
        }
        
        return board;
    }
    
    getPieceSymbol(piece) {
        if (!piece) return '';
        const symbols = {
            'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
            'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
        };
        return symbols[piece.type] || '';
    }
    
    render() {
        const boardEl = document.getElementById('chess-board');
        boardEl.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                const isLight = (row + col) % 2 === 0;
                square.className = `square ${isLight ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                // 标记最后一步
                if (this.lastMove) {
                    if ((row === this.lastMove.fromRow && col === this.lastMove.fromCol) ||
                        (row === this.lastMove.toRow && col === this.lastMove.toCol)) {
                        square.classList.add('last-move');
                    }
                }
                
                const piece = this.board[row][col];
                if (piece) {
                    const pieceEl = document.createElement('span');
                    pieceEl.className = 'piece';
                    pieceEl.textContent = this.getPieceSymbol(piece);
                    square.appendChild(pieceEl);
                }
                
                boardEl.appendChild(square);
            }
        }
    }
    
    setupEventListeners() {
        document.getElementById('chess-board').addEventListener('click', (e) => {
            const square = e.target.closest('.square');
            if (!square) return;
            
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            this.handleSquareClick(row, col);
        });
        
        document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
        document.getElementById('btn-resign').addEventListener('click', () => this.resign());
        document.getElementById('btn-draw').addEventListener('click', () => this.offerDraw());
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('modal-btn').addEventListener('click', () => {
            document.getElementById('modal').classList.add('hidden');
        });
    }
    
    handleSquareClick(row, col) {
        if (this.gameOver) return;
        
        const piece = this.board[row][col];
        
        // 如果已经选中了一个棋子
        if (this.selectedSquare) {
            // 如果点击的是同一个格子，取消选中
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                this.clearHighlights();
                this.selectedSquare = null;
                return;
            }
            
            // 尝试移动
            const fromRow = this.selectedSquare.row;
            const fromCol = this.selectedSquare.col;
            const fromPiece = this.board[fromRow][fromCol];
            
            if (this.isValidMove(fromRow, fromCol, row, col)) {
                this.makeMove(fromRow, fromCol, row, col);
                this.clearHighlights();
                this.selectedSquare = null;
                return;
            }
            
            // 如果点击的是自己的另一个棋子，切换选择
            if (piece && piece.color === this.currentPlayer) {
                this.clearHighlights();
                this.selectedSquare = { row, col };
                this.highlightSquare(row, col);
                this.showValidMoves(row, col);
                return;
            }
            
            // 无效移动，取消选择
            this.clearHighlights();
            this.selectedSquare = null;
            return;
        }
        
        // 选择己方棋子
        if (piece && piece.color === this.currentPlayer) {
            this.selectedSquare = { row, col };
            this.highlightSquare(row, col);
            this.showValidMoves(row, col);
        }
    }
    
    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;
        
        const target = this.board[toRow][toCol];
        if (target && target.color === piece.color) return false;
        
        // 简单的走法验证（简化版，实际应该实现完整的走法生成）
        const dx = toCol - fromCol;
        const dy = toRow - fromRow;
        
        switch(piece.type.toUpperCase()) {
            case 'P':
                const dir = piece.color === 'white' ? -1 : 1;
                if (dx === 0 && !target) {
                    if (dy === dir) return true;
                    if (dy === 2 * dir && fromRow === (piece.color === 'white' ? 6 : 1) && 
                        !this.board[fromRow + dir][fromCol]) return true;
                }
                if (Math.abs(dx) === 1 && dy === dir && target) return true;
                return false;
            case 'R':
                if (dx !== 0 && dy !== 0) return false;
                return this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'B':
                if (Math.abs(dx) !== Math.abs(dy)) return false;
                return this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'Q':
                if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
                    return this.isPathClear(fromRow, fromCol, toRow, toCol);
                }
                return false;
            case 'N':
                return (Math.abs(dx) === 2 && Math.abs(dy) === 1) || 
                       (Math.abs(dx) === 1 && Math.abs(dy) === 2);
            case 'K':
                return Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
            default:
                return false;
        }
    }
    
    isPathClear(fromRow, fromCol, toRow, toCol) {
        const dx = Math.sign(toCol - fromCol);
        const dy = Math.sign(toRow - fromRow);
        let row = fromRow + dy;
        let col = fromCol + dx;
        
        while (row !== toRow || col !== toCol) {
            if (this.board[row][col]) return false;
            row += dy;
            col += dx;
        }
        return true;
    }
    
    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow][toCol];
        
        // 记录移动
        this.moveHistory.push({
            fromRow, fromCol, toRow, toCol,
            piece, captured,
            player: this.currentPlayer
        });
        
        // 执行移动
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        this.lastMove = { fromRow, fromCol, toRow, toCol };
        
        // 检查吃子
        if (captured) {
            this.updateStatus(`吃子!`);
        }
        
        // 切换玩家
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        
        // 更新显示
        this.render();
        this.updateStatus();
        this.updateMoveHistory();
        
        // 检查游戏结束
        this.checkGameOver();
    }
    
    highlightSquare(row, col) {
        const squares = document.querySelectorAll('.square');
        const index = row * 8 + col;
        squares[index].classList.add('selected');
    }
    
    showValidMoves(row, col) {
        const squares = document.querySelectorAll('.square');
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.isValidMove(row, col, r, c)) {
                    const index = r * 8 + c;
                    const target = this.board[r][c];
                    squares[index].classList.add(target ? 'valid-capture' : 'valid-move');
                }
            }
        }
    }
    
    clearHighlights() {
        document.querySelectorAll('.square').forEach(sq => {
            sq.classList.remove('selected', 'valid-move', 'valid-capture');
        });
    }
    
    updateStatus(message) {
        const statusEl = document.getElementById('game-status');
        if (this.gameOver) {
            statusEl.textContent = this.gameOverMessage || '游戏结束';
            return;
        }
        
        let status = `${this.currentPlayer === 'white' ? '白棋' : '黑棋'}走棋`;
        if (this.isKingInCheck) {
            status += ' - 将军!';
        }
        if (message) {
            status += ' ' + message;
        }
        statusEl.textContent = status;
    }
    
    updateMoveHistory() {
        const listEl = document.getElementById('moves-list');
        listEl.innerHTML = '';
        
        this.moveHistory.forEach((move, index) => {
            const moveNum = Math.floor(index / 2) + 1;
            const item = document.createElement('span');
            item.className = 'move-item';
            const from = String.fromCharCode(97 + move.fromCol) + (8 - move.fromRow);
            const to = String.fromCharCode(97 + move.toCol) + (8 - move.toRow);
            const pieceSymbol = this.getPieceSymbol(move.piece);
            const capture = move.captured ? 'x' : '-';
            item.textContent = `${moveNum}. ${pieceSymbol}${from}${capture}${to}`;
            listEl.appendChild(item);
        });
    }
    
    checkGameOver() {
        // 简化版检测，仅检测王是否被吃
        let whiteKing = false;
        let blackKing = false;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    if (piece.type === 'K' && piece.color === 'white') whiteKing = true;
                    if (piece.type === 'k' && piece.color === 'black') blackKing = true;
                }
            }
        }
        
        if (!whiteKing) {
            this.gameOver = true;
            this.gameOverMessage = '黑方胜! 白王被吃';
            this.showGameOver('黑方胜!', '白王被吃');
        } else if (!blackKing) {
            this.gameOver = true;
            this.gameOverMessage = '白方胜! 黑王被吃';
            this.showGameOver('白方胜!', '黑王被吃');
        }
    }
    
    showGameOver(title, message) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        document.getElementById('modal').classList.remove('hidden');
        this.updateStatus();
    }
    
    newGame() {
        this.board = this.initBoard();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.gameOver = false;
        this.isKingInCheck = false;
        this.lastMove = null;
        this.gameOverMessage = '';
        
        this.clearHighlights();
        this.render();
        this.updateStatus('新游戏开始!');
        this.updateMoveHistory();
        document.getElementById('modal').classList.add('hidden');
    }
    
    resign() {
        if (this.gameOver) return;
        const winner = this.currentPlayer === 'white' ? '黑方' : '白方';
        this.gameOver = true;
        this.gameOverMessage = `${winner}胜! 对方认输`;
        this.showGameOver(`${winner}胜!`, '对方认输');
    }
    
    offerDraw() {
        if (this.gameOver) return;
        if (confirm('对方同意和棋吗?')) {
            this.gameOver = true;
            this.gameOverMessage = '和棋';
            this.showGameOver('和棋', '双方同意和棋');
        }
    }
    
    undo() {
        if (this.moveHistory.length === 0 || this.gameOver) return;
        
        // 撤回两步（自己和对手各一步）
        for (let i = 0; i < 2 && this.moveHistory.length > 0; i++) {
            const move = this.moveHistory.pop();
            this.board[move.fromRow][move.fromCol] = move.piece;
            this.board[move.toRow][move.toCol] = move.captured;
            this.currentPlayer = move.player;
        }
        
        this.lastMove = this.moveHistory.length > 0 ? 
            this.moveHistory[this.moveHistory.length - 1] : null;
        this.gameOver = false;
        this.gameOverMessage = '';
        
        this.clearHighlights();
        this.selectedSquare = null;
        this.render();
        this.updateStatus('已撤回一步');
        this.updateMoveHistory();
        document.getElementById('modal').classList.add('hidden');
    }
}

// 初始化游戏
const game = new ChessGame();