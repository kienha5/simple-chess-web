const boardEl = document.getElementById('board');
const resetBtn = document.getElementById('reset');

const CELL = 200;
const SPRITE_X = { king: -44, queen: 192, rook: 430, bishop: 665, knight: 902, pawn: 1140 };
const SPRITE_Y = { black: 120, white: 320 };
const SNAP_MS = 150; 

let board;          
let drag = null;    

/* ---------- State ---------- */

function initBoard() {
  board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  back.forEach((type, c) => {
    board[0][c] = { type, color: 'black' };
    board[1][c] = { type: 'pawn', color: 'black' };
    board[6][c] = { type: 'pawn', color: 'white' };
    board[7][c] = { type, color: 'white' };
  });
}

/* ---------- Render ---------- */

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.row = r;
      sq.dataset.col = c;

      const piece = board[r][c];
      if (piece) {
        const el = document.createElement('div');
        el.className = 'piece';
        el.style.backgroundPosition =
          `calc(var(--sq) * ${-SPRITE_X[piece.type] / CELL}) ` +
          `calc(var(--sq) * ${-SPRITE_Y[piece.color] / CELL})`;
        el.addEventListener('pointerdown', onPointerDown);
        sq.appendChild(el);
      }
      boardEl.appendChild(sq);
    }
  }
}

function squareEl(r, c) {
  return boardEl.children[r * 8 + c];
}

function showHints(fromR, fromC, piece) {
  squareEl(fromR, fromC).classList.add('origin');
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isValidMove(board, piece, fromR, fromC, r, c)) {
        squareEl(r, c).classList.add('hint');
      }
    }
  }
}

/* ---------- Drag & drop ---------- */

function getSquareFromPoint(x, y) {
  const rect = boardEl.getBoundingClientRect();
  const size = rect.width / 8;
  const c = Math.floor((x - rect.left) / size);
  const r = Math.floor((y - rect.top) / size);
  if (r < 0 || r > 7 || c < 0 || c > 7) return null; // thả ngoài bàn cờ
  return { r, c };
}

function moveDragTo(x, y) {
  drag.el.style.left = (x - drag.size / 2) + 'px';
  drag.el.style.top = (y - drag.size / 2) + 'px';
}

function onPointerDown(e) {
  if (drag || e.button !== 0) return;
  e.preventDefault();

  const el = e.currentTarget;
  const sq = el.parentElement;
  const r = Number(sq.dataset.row);
  const c = Number(sq.dataset.col);
  const piece = board[r][c];

  const size = el.getBoundingClientRect().width;
  drag = { el, piece, fromR: r, fromC: c, size, releasing: false };

  el.setPointerCapture(e.pointerId);
  el.style.width = el.style.height = size + 'px';
  el.classList.add('dragging');
  moveDragTo(e.clientX, e.clientY);
  showHints(r, c, piece);

  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e) {
  if (!drag || drag.releasing) return;
  moveDragTo(e.clientX, e.clientY);
}

function onPointerUp(e) {
  if (!drag || drag.releasing) return;
  drag.releasing = true;

  const { el, piece, fromR, fromC } = drag;
  const target = getSquareFromPoint(e.clientX, e.clientY);
  const ok = !!target && isValidMove(board, piece, fromR, fromC, target.r, target.c);
  const dest = ok ? target : { r: fromR, c: fromC };

  const rect = squareEl(dest.r, dest.c).getBoundingClientRect();
  el.classList.add('snapping');
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';

  setTimeout(() => {
    if (ok) {
      board[target.r][target.c] = piece;
      board[fromR][fromC] = null;
    }
    drag = null;
    render();
  }, SNAP_MS + 20);
}

/* ---------- Rule ---------- */

function isPathClear(board, r1, c1, r2, c2) {
  const stepR = Math.sign(r2 - r1);
  const stepC = Math.sign(c2 - c1);
  let r = r1 + stepR;
  let c = c1 + stepC;
  while (r !== r2 || c !== c2) {
    if (board[r][c]) return false;
    r += stepR;
    c += stepC;
  }
  return true;
}

function isValidMove(board, piece, fromR, fromC, toR, toC) {
  if (toR < 0 || toR > 7 || toC < 0 || toC > 7) return false;
  if (toR === fromR && toC === fromC) return false;
  if (board[toR][toC]) return false; 

  const dr = toR - fromR;
  const dc = toC - fromC;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);

  switch (piece.type) {
    case 'pawn': {
      const dir = piece.color === 'white' ? -1 : 1;
      const startRow = piece.color === 'white' ? 6 : 1;
      if (dc !== 0) return false;
      if (dr === dir) return true;
      if (dr === 2 * dir && fromR === startRow) {
        return !board[fromR + dir][fromC]; 
      }
      return false;
    }
    case 'rook':
      return (dr === 0 || dc === 0) && isPathClear(board, fromR, fromC, toR, toC);
    case 'bishop':
      return adr === adc && isPathClear(board, fromR, fromC, toR, toC);
    case 'queen':
      return (dr === 0 || dc === 0 || adr === adc) &&
             isPathClear(board, fromR, fromC, toR, toC);
    case 'knight':
      return (adr === 1 && adc === 2) || (adr === 2 && adc === 1);
    case 'king':
      return Math.max(adr, adc) === 1;
    default:
      return false;
  }
}

/* ---------- Start ---------- */

resetBtn.addEventListener('click', () => {
  if (drag) return;
  initBoard();
  render();
});

initBoard();
render();
