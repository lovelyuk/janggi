document.addEventListener('DOMContentLoaded', () => {
  const BOARD_ROWS = 10;
  const BOARD_COLS = 9;
  const CHECKMATE_SCORE = 100000;
  const AI_DEPTH = 2;

  const boardElement = document.getElementById('board');
  const statusElement = document.getElementById('status');
  const turnElement = document.getElementById('turn');
  const newGameButton = document.getElementById('newGame');

  const colorNames = {
    red: '홍',
    blue: '청',
  };

  const pieceSymbols = {
    red: {
      G: '帥',
      A: '仕',
      E: '相',
      H: '傌',
      R: '車',
      C: '炮',
      S: '兵',
    },
    blue: {
      G: '將',
      A: '士',
      E: '象',
      H: '馬',
      R: '車',
      C: '包',
      S: '卒',
    },
  };

  const pieceNames = {
    G: '장군',
    A: '사',
    E: '상',
    H: '마',
    R: '차',
    C: '포',
    S: '병/졸',
  };

  const pieceValues = {
    G: 10000,
    R: 900,
    C: 450,
    H: 400,
    E: 350,
    A: 300,
    S: 120,
  };

  let board = [];
  let currentTurn = 'red';
  let selectedCell = null;
  let legalMoves = [];
  let lastMove = null;
  let gameOver = false;

  function makePiece(color, type) {
    return { color, type };
  }

  function createInitialBoard() {
    const newBoard = Array.from({ length: BOARD_ROWS }, () =>
      Array.from({ length: BOARD_COLS }, () => null),
    );

    const backRank = ['R', 'H', 'E', 'A', 'G', 'A', 'E', 'H', 'R'];
    backRank.forEach((type, col) => {
      newBoard[0][col] = makePiece('blue', type);
      newBoard[9][col] = makePiece('red', type);
    });

    newBoard[2][1] = makePiece('blue', 'C');
    newBoard[2][7] = makePiece('blue', 'C');
    newBoard[7][1] = makePiece('red', 'C');
    newBoard[7][7] = makePiece('red', 'C');

    for (let col = 0; col < BOARD_COLS; col += 2) {
      newBoard[3][col] = makePiece('blue', 'S');
      newBoard[6][col] = makePiece('red', 'S');
    }

    return newBoard;
  }

  function withinBounds(row, col) {
    return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
  }

  function isInsidePalace(row, col, color) {
    if (color === 'red') {
      return row >= 7 && row <= 9 && col >= 3 && col <= 5;
    }
    return row >= 0 && row <= 2 && col >= 3 && col <= 5;
  }

  function isPalaceCell(row, col) {
    return (
      (row >= 7 && row <= 9 && col >= 3 && col <= 5) ||
      (row >= 0 && row <= 2 && col >= 3 && col <= 5)
    );
  }

  const palaceDiagonals = {
    red: [
      [7, 3, 8, 4],
      [8, 4, 9, 5],
      [7, 5, 8, 4],
      [8, 4, 9, 3],
    ],
    blue: [
      [0, 3, 1, 4],
      [1, 4, 2, 5],
      [0, 5, 1, 4],
      [1, 4, 2, 3],
    ],
  };

  function isValidPalaceDiagonal(fromRow, fromCol, toRow, toCol, color) {
    const pairs = palaceDiagonals[color];
    return pairs.some(([r1, c1, r2, c2]) => {
      return (
        (r1 === fromRow && c1 === fromCol && r2 === toRow && c2 === toCol) ||
        (r2 === fromRow && c2 === fromCol && r1 === toRow && c1 === toCol)
      );
    });
  }

  function isRiverRow(row) {
    return row === 4 || row === 5;
  }

  function hasCrossedRiver(row, color) {
    return color === 'red' ? row <= 4 : row >= 5;
  }

  function canElephantOccupy(row, color) {
    return color === 'red' ? row >= 5 : row <= 4;
  }

  function cloneBoard(sourceBoard) {
    return sourceBoard.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  function findGeneral(targetBoard, color) {
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const piece = targetBoard[row][col];
        if (piece && piece.type === 'G' && piece.color === color) {
          return { row, col };
        }
      }
    }
    return null;
  }

  function getOpponent(color) {
    return color === 'red' ? 'blue' : 'red';
  }

  function applyMove(sourceBoard, fromRow, fromCol, toRow, toCol) {
    const newBoard = cloneBoard(sourceBoard);
    const piece = newBoard[fromRow][fromCol];
    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = null;
    return newBoard;
  }

  function getBasicMoves(targetBoard, row, col, piece) {
    const moves = [];
    if (!piece) {
      return moves;
    }

    if (piece.type === 'G' || piece.type === 'A') {
      const orthSteps = [
        { dr: 1, dc: 0 },
        { dr: -1, dc: 0 },
        { dr: 0, dc: 1 },
        { dr: 0, dc: -1 },
      ];
      const diagonalSteps = [
        { dr: 1, dc: 1 },
        { dr: 1, dc: -1 },
        { dr: -1, dc: 1 },
        { dr: -1, dc: -1 },
      ];
      orthSteps.forEach(({ dr, dc }) => {
        const nr = row + dr;
        const nc = col + dc;
        if (!withinBounds(nr, nc) || !isInsidePalace(nr, nc, piece.color)) {
          return;
        }
        const target = targetBoard[nr][nc];
        if (!target || target.color !== piece.color) {
          moves.push({ row: nr, col: nc });
        }
      });
      diagonalSteps.forEach(({ dr, dc }) => {
        const nr = row + dr;
        const nc = col + dc;
        if (!withinBounds(nr, nc) || !isInsidePalace(nr, nc, piece.color)) {
          return;
        }
        if (!isValidPalaceDiagonal(row, col, nr, nc, piece.color)) {
          return;
        }
        const target = targetBoard[nr][nc];
        if (!target || target.color !== piece.color) {
          moves.push({ row: nr, col: nc });
        }
      });
    } else if (piece.type === 'S') {
      const forward = piece.color === 'red' ? -1 : 1;
      const nr = row + forward;
      if (withinBounds(nr, col)) {
        const target = targetBoard[nr][col];
        if (!target || target.color !== piece.color) {
          moves.push({ row: nr, col });
        }
      }
      if (hasCrossedRiver(row, piece.color)) {
        [-1, 1].forEach((dc) => {
          const nc = col + dc;
          if (!withinBounds(row, nc)) {
            return;
          }
          const target = targetBoard[row][nc];
          if (!target || target.color !== piece.color) {
            moves.push({ row, col: nc });
          }
        });
      }
    } else if (piece.type === 'H') {
      const horseMoves = [
        { dr: -2, dc: -1, block: { dr: -1, dc: 0 } },
        { dr: -2, dc: 1, block: { dr: -1, dc: 0 } },
        { dr: 2, dc: -1, block: { dr: 1, dc: 0 } },
        { dr: 2, dc: 1, block: { dr: 1, dc: 0 } },
        { dr: -1, dc: -2, block: { dr: 0, dc: -1 } },
        { dr: -1, dc: 2, block: { dr: 0, dc: 1 } },
        { dr: 1, dc: -2, block: { dr: 0, dc: -1 } },
        { dr: 1, dc: 2, block: { dr: 0, dc: 1 } },
      ];
      horseMoves.forEach(({ dr, dc, block }) => {
        const blockRow = row + block.dr;
        const blockCol = col + block.dc;
        if (!withinBounds(blockRow, blockCol)) {
          return;
        }
        if (targetBoard[blockRow][blockCol]) {
          return;
        }
        const nr = row + dr;
        const nc = col + dc;
        if (!withinBounds(nr, nc)) {
          return;
        }
        const target = targetBoard[nr][nc];
        if (!target || target.color !== piece.color) {
          moves.push({ row: nr, col: nc });
        }
      });
    } else if (piece.type === 'E') {
      const elephantMoves = [
        {
          dr: -3,
          dc: -2,
          blocks: [
            { dr: -1, dc: 0 },
            { dr: -2, dc: -1 },
          ],
        },
        {
          dr: -3,
          dc: 2,
          blocks: [
            { dr: -1, dc: 0 },
            { dr: -2, dc: 1 },
          ],
        },
        {
          dr: 3,
          dc: -2,
          blocks: [
            { dr: 1, dc: 0 },
            { dr: 2, dc: -1 },
          ],
        },
        {
          dr: 3,
          dc: 2,
          blocks: [
            { dr: 1, dc: 0 },
            { dr: 2, dc: 1 },
          ],
        },
        {
          dr: -2,
          dc: -3,
          blocks: [
            { dr: 0, dc: -1 },
            { dr: -1, dc: -2 },
          ],
        },
        {
          dr: -2,
          dc: 3,
          blocks: [
            { dr: 0, dc: 1 },
            { dr: -1, dc: 2 },
          ],
        },
        {
          dr: 2,
          dc: -3,
          blocks: [
            { dr: 0, dc: -1 },
            { dr: 1, dc: -2 },
          ],
        },
        {
          dr: 2,
          dc: 3,
          blocks: [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 2 },
          ],
        },
      ];
      elephantMoves.forEach(({ dr, dc, blocks }) => {
        const nr = row + dr;
        const nc = col + dc;
        if (!withinBounds(nr, nc)) {
          return;
        }
        if (!canElephantOccupy(nr, piece.color)) {
          return;
        }
        for (const block of blocks) {
          const blockRow = row + block.dr;
          const blockCol = col + block.dc;
          if (!withinBounds(blockRow, blockCol)) {
            return;
          }
          if (targetBoard[blockRow][blockCol]) {
            return;
          }
        }
        const target = targetBoard[nr][nc];
        if (!target || target.color !== piece.color) {
          moves.push({ row: nr, col: nc });
        }
      });
    } else if (piece.type === 'R') {
      const directions = [
        { dr: 1, dc: 0 },
        { dr: -1, dc: 0 },
        { dr: 0, dc: 1 },
        { dr: 0, dc: -1 },
      ];
      directions.forEach(({ dr, dc }) => {
        let nr = row + dr;
        let nc = col + dc;
        while (withinBounds(nr, nc)) {
          const target = targetBoard[nr][nc];
          if (!target) {
            moves.push({ row: nr, col: nc });
          } else {
            if (target.color !== piece.color) {
              moves.push({ row: nr, col: nc });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      });
    } else if (piece.type === 'C') {
      const directions = [
        { dr: 1, dc: 0 },
        { dr: -1, dc: 0 },
        { dr: 0, dc: 1 },
        { dr: 0, dc: -1 },
      ];
      directions.forEach(({ dr, dc }) => {
        let nr = row + dr;
        let nc = col + dc;
        let screenFound = false;
        while (withinBounds(nr, nc)) {
          const target = targetBoard[nr][nc];
          if (!screenFound) {
            if (!target) {
              moves.push({ row: nr, col: nc });
            } else if (target.type !== 'C') {
              screenFound = true;
            } else {
              break;
            }
          } else {
            if (target) {
              if (target.color !== piece.color && target.type !== 'C') {
                moves.push({ row: nr, col: nc });
              }
              break;
            }
          }
          nr += dr;
          nc += dc;
        }
      });
    }

    return moves;
  }

  function isSquareAttacked(targetBoard, row, col, attackerColor) {
    for (let r = 0; r < BOARD_ROWS; r += 1) {
      for (let c = 0; c < BOARD_COLS; c += 1) {
        const piece = targetBoard[r][c];
        if (!piece || piece.color !== attackerColor) {
          continue;
        }
        if (piece.type === 'G') {
          if (c === col) {
            if (r === row) {
              continue;
            }
            const targetPiece = targetBoard[row][col];
            if (!targetPiece || targetPiece.type !== 'G') {
              // 비행 장군 규칙은 상대 장군이 있는 경우에만 적용
              continue;
            }
            const step = row > r ? 1 : -1;
            let betweenClear = true;
            for (let rr = r + step; rr !== row; rr += step) {
              if (targetBoard[rr][c]) {
                betweenClear = false;
                break;
              }
            }
            if (betweenClear) {
              return true;
            }
          }
        }
        const moves = getBasicMoves(targetBoard, r, c, piece);
        if (moves.some((move) => move.row === row && move.col === col)) {
          return true;
        }
      }
    }
    return false;
  }

  function isInCheck(targetBoard, color) {
    const generalPos = findGeneral(targetBoard, color);
    if (!generalPos) {
      return true;
    }
    return isSquareAttacked(targetBoard, generalPos.row, generalPos.col, getOpponent(color));
  }

  function getLegalMoves(targetBoard, row, col) {
    const piece = targetBoard[row][col];
    if (!piece) {
      return [];
    }
    const pseudoMoves = getBasicMoves(targetBoard, row, col, piece);
    const legal = [];
    pseudoMoves.forEach((move) => {
      const newBoard = applyMove(targetBoard, row, col, move.row, move.col);
      if (!isInCheck(newBoard, piece.color)) {
        legal.push(move);
      }
    });
    return legal;
  }

  function getAllLegalMoves(targetBoard, color) {
    const moves = [];
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const piece = targetBoard[row][col];
        if (!piece || piece.color !== color) {
          continue;
        }
        const pieceMoves = getLegalMoves(targetBoard, row, col);
        pieceMoves.forEach((move) => {
          moves.push({
            from: { row, col },
            to: { row: move.row, col: move.col },
            captured: targetBoard[move.row][move.col],
          });
        });
      }
    }
    return moves;
  }

  function evaluateBoard(targetBoard) {
    let score = 0;
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const piece = targetBoard[row][col];
        if (!piece) {
          continue;
        }
        const value = pieceValues[piece.type] || 0;
        score += piece.color === 'red' ? value : -value;
      }
    }
    return score;
  }

  function minimax(targetBoard, depth, isMaximizing, currentColor, alpha, beta) {
    const redGeneral = findGeneral(targetBoard, 'red');
    const blueGeneral = findGeneral(targetBoard, 'blue');
    if (!redGeneral) {
      return -CHECKMATE_SCORE;
    }
    if (!blueGeneral) {
      return CHECKMATE_SCORE;
    }

    if (depth === 0) {
      return evaluateBoard(targetBoard);
    }

    const moves = getAllLegalMoves(targetBoard, currentColor);
    if (moves.length === 0) {
      if (isInCheck(targetBoard, currentColor)) {
        return currentColor === 'red' ? -CHECKMATE_SCORE + depth : CHECKMATE_SCORE - depth;
      }
      return 0;
    }

    if (isMaximizing) {
      let bestValue = -Infinity;
      for (const move of moves) {
        const childBoard = applyMove(
          targetBoard,
          move.from.row,
          move.from.col,
          move.to.row,
          move.to.col,
        );
        const value = minimax(childBoard, depth - 1, false, 'blue', alpha, beta);
        bestValue = Math.max(bestValue, value);
        alpha = Math.max(alpha, bestValue);
        if (alpha >= beta) {
          break;
        }
      }
      return bestValue;
    }

    let bestValue = Infinity;
    for (const move of moves) {
      const childBoard = applyMove(
        targetBoard,
        move.from.row,
        move.from.col,
        move.to.row,
        move.to.col,
      );
      const value = minimax(childBoard, depth - 1, true, 'red', alpha, beta);
      bestValue = Math.min(bestValue, value);
      beta = Math.min(beta, bestValue);
      if (alpha >= beta) {
        break;
      }
    }
    return bestValue;
  }

  function findBestMove(targetBoard, depth) {
    const moves = getAllLegalMoves(targetBoard, 'blue');
    if (moves.length === 0) {
      return null;
    }
    let bestScore = Infinity;
    let bestMoves = [];
    for (const move of moves) {
      if (move.captured && move.captured.type === 'G') {
        return move;
      }
      const childBoard = applyMove(
        targetBoard,
        move.from.row,
        move.from.col,
        move.to.row,
        move.to.col,
      );
      const score = minimax(childBoard, depth - 1, true, 'red', -Infinity, Infinity);
      if (score < bestScore - 0.001) {
        bestScore = score;
        bestMoves = [move];
      } else if (Math.abs(score - bestScore) < 0.001) {
        bestMoves.push(move);
      }
    }
    if (!bestMoves.length) {
      return moves[0];
    }
    const randomIndex = Math.floor(Math.random() * bestMoves.length);
    return bestMoves[randomIndex];
  }

  function performMove(targetBoard, fromRow, fromCol, toRow, toCol) {
    const movingPiece = targetBoard[fromRow][fromCol];
    const capturedPiece = targetBoard[toRow][toCol];
    targetBoard[toRow][toCol] = movingPiece;
    targetBoard[fromRow][fromCol] = null;
    return capturedPiece;
  }

  function endGame(winner, message) {
    gameOver = true;
    currentTurn = null;
    setStatus(message);
    updateTurnIndicator();
  }

  function checkForGameEnd(color) {
    const opponent = getOpponent(color);
    const opponentGeneral = findGeneral(board, opponent);
    if (!opponentGeneral) {
      endGame(color, `${colorNames[color]} 승리! 상대 장군을 잡았습니다.`);
      return true;
    }

    const opponentMoves = getAllLegalMoves(board, opponent);
    if (opponentMoves.length === 0) {
      if (isInCheck(board, opponent)) {
        endGame(color, `${colorNames[color]} 승리! ${colorNames[opponent]}이(가) 장군멍군 당했습니다.`);
      } else {
        endGame(null, '무승부입니다. 더 이상 둘 수 있는 수가 없습니다.');
      }
      return true;
    }
    return false;
  }

  function renderBoard() {
    boardElement.innerHTML = '';
    const redGeneral = findGeneral(board, 'red');
    const blueGeneral = findGeneral(board, 'blue');
    const redInCheck = redGeneral ? isSquareAttacked(board, redGeneral.row, redGeneral.col, 'blue') : false;
    const blueInCheck = blueGeneral
      ? isSquareAttacked(board, blueGeneral.row, blueGeneral.col, 'red')
      : false;

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        if ((row + col) % 2 === 1) {
          cell.classList.add('dark');
        }
        if (isPalaceCell(row, col)) {
          cell.classList.add('palace');
        }
        if (isRiverRow(row)) {
          cell.classList.add('river');
        }
        if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
          cell.classList.add('selected');
        }
        if (
          lastMove &&
          lastMove.from.row === row &&
          lastMove.from.col === col
        ) {
          cell.classList.add('last-from');
        }
        if (
          lastMove &&
          lastMove.to.row === row &&
          lastMove.to.col === col
        ) {
          cell.classList.add('last-to');
        }
        if (legalMoves.some((move) => move.row === row && move.col === col)) {
          cell.classList.add('legal');
        }

        const piece = board[row][col];
        if (piece) {
          const pieceElement = document.createElement('div');
          pieceElement.classList.add('piece', piece.color);
          pieceElement.textContent = pieceSymbols[piece.color][piece.type];
          pieceElement.title = `${colorNames[piece.color]} ${pieceNames[piece.type]}`;
          cell.appendChild(pieceElement);
          if (piece.type === 'G') {
            if (piece.color === 'red' && redInCheck) {
              cell.classList.add('in-check');
            }
            if (piece.color === 'blue' && blueInCheck) {
              cell.classList.add('in-check');
            }
          }
        }

        cell.setAttribute('role', 'gridcell');
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.addEventListener('click', () => handleCellClick(row, col));

        boardElement.appendChild(cell);
      }
    }
  }

  function setStatus(message) {
    statusElement.textContent = message;
  }

  function updateTurnIndicator() {
    if (!currentTurn) {
      turnElement.textContent = '게임 종료';
      return;
    }
    if (currentTurn === 'red') {
      turnElement.textContent = '홍 (플레이어)';
    } else {
      turnElement.textContent = '청 (AI)';
    }
  }

  function setStatusForTurn(color) {
    if (gameOver) {
      return;
    }
    if (color === 'red') {
      if (isInCheck(board, 'red')) {
        setStatus('홍 장군! 탈출할 수 있는 수를 찾아보세요.');
      } else {
        setStatus('홍(플레이어)의 차례입니다. 이동할 말을 선택하세요.');
      }
    } else if (color === 'blue') {
      if (isInCheck(board, 'blue')) {
        setStatus('청 장군! AI가 수를 계산 중입니다.');
      } else {
        setStatus('청(AI)이 생각 중입니다...');
      }
    }
  }

  function handleCellClick(row, col) {
    if (gameOver || currentTurn !== 'red') {
      return;
    }

    const piece = board[row][col];
    const isSelected = selectedCell && selectedCell.row === row && selectedCell.col === col;
    const isLegalTarget = legalMoves.some((move) => move.row === row && move.col === col);

    if (isSelected) {
      selectedCell = null;
      legalMoves = [];
      renderBoard();
      return;
    }

    if (isLegalTarget && selectedCell) {
      executePlayerMove(selectedCell.row, selectedCell.col, row, col);
      return;
    }

    if (piece && piece.color === 'red') {
      selectedCell = { row, col };
      legalMoves = getLegalMoves(board, row, col);
    } else {
      selectedCell = null;
      legalMoves = [];
    }
    renderBoard();
  }

  function executePlayerMove(fromRow, fromCol, toRow, toCol) {
    const legal = getLegalMoves(board, fromRow, fromCol);
    if (!legal.some((move) => move.row === toRow && move.col === toCol)) {
      return;
    }

    const captured = performMove(board, fromRow, fromCol, toRow, toCol);
    lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
    selectedCell = null;
    legalMoves = [];
    renderBoard();

    if (captured && captured.type === 'G') {
      endGame('red', '홍 승리! 상대 장군을 잡았습니다.');
      return;
    }

    if (checkForGameEnd('red')) {
      return;
    }

    currentTurn = 'blue';
    updateTurnIndicator();
    setStatusForTurn('blue');
    setTimeout(() => {
      aiMove();
    }, 250);
  }

  function aiMove() {
    if (gameOver || currentTurn !== 'blue') {
      return;
    }
    const bestMove = findBestMove(board, AI_DEPTH);
    if (!bestMove) {
      endGame('red', '홍 승리! 청이 둘 수 있는 수가 없습니다.');
      return;
    }

    const captured = performMove(
      board,
      bestMove.from.row,
      bestMove.from.col,
      bestMove.to.row,
      bestMove.to.col,
    );
    lastMove = {
      from: { row: bestMove.from.row, col: bestMove.from.col },
      to: { row: bestMove.to.row, col: bestMove.to.col },
    };
    renderBoard();

    if (captured && captured.type === 'G') {
      endGame('blue', '청(AI) 승리! 홍의 장군이 잡혔습니다.');
      return;
    }

    if (checkForGameEnd('blue')) {
      return;
    }

    currentTurn = 'red';
    updateTurnIndicator();
    setStatusForTurn('red');
  }

  function startNewGame() {
    board = createInitialBoard();
    currentTurn = 'red';
    selectedCell = null;
    legalMoves = [];
    lastMove = null;
    gameOver = false;
    renderBoard();
    updateTurnIndicator();
    setStatusForTurn('red');
  }

  newGameButton.addEventListener('click', () => {
    startNewGame();
  });

  startNewGame();
});
