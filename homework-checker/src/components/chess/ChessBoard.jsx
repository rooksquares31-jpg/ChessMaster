import { useState, useCallback, useEffect, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import styles from './ChessBoard.module.css'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function safeLoad(fen) {
  try {
    const g = new Chess()
    g.load(fen || START_FEN)
    return g
  } catch {
    return new Chess()
  }
}

/**
 * ChessBoard — shared component for live classroom and homework solving.
 *
 * Props:
 *   fen              — current board position (source of truth)
 *   interactive      — whether this user can make moves
 *   onMove(data)     — called when user completes a move { from, to, san, fen }
 *   onSelect(sq)     — called when user clicks a piece (before moving)
 *   onDragUpdate(d)  — called CONTINUOUSLY during drag { from, square }
 *   onDragCancel()   — called when drag ends with no move
 *
 *   lastMove         — { from, to } — highlighted yellow (most recent move)
 *   remoteSelected   — square highlighted as "selected" by the other user
 *   remoteDragFrom   — origin square of the other user's in-progress drag
 *   remoteDragOver   — current hover square of the other user's drag
 */
export default function ChessBoard({
  fen            = START_FEN,
  onMove,
  onSelect,
  onDragUpdate,
  onDragCancel,
  interactive    = false,
  size           = 360,
  showCoordinates = true,
  orientation    = 'white',
  lastMove       = null,
  // Remote cursor state (for viewer boards)
  remoteSelected = null,
  remoteDragFrom = null,
  remoteDragOver = null,
  id             = 'chess-board',
}) {
  const [game, setGame]           = useState(() => safeLoad(fen))
  const [moveFrom, setMoveFrom]   = useState(null)       // locally selected square
  const [optSquares, setOptSquares] = useState({})        // legal move dots
  const [localDragFrom, setLocalDragFrom] = useState(null) // local drag origin
  const [arrows, setArrows] = useState([])                // custom arrows state
  const [drawingArrow, setDrawingArrow] = useState(null)  // { startSquare, color }
  const [drawingArrowEnd, setDrawingArrowEnd] = useState(null)
  const prevFenRef = useRef(fen)
  const dragThrottleRef = useRef(null)

  // ── Sync game when FEN changes from outside ───────────────────────────────
  useEffect(() => {
    if (fen !== prevFenRef.current) {
      prevFenRef.current = fen
      setGame(safeLoad(fen))
      setMoveFrom(null)
      setOptSquares({})
      setLocalDragFrom(null)
      setArrows([])
      setDrawingArrow(null)
    }
  }, [fen])

  // ── Legal move dots on select ─────────────────────────────────────────────
  const showMoveOptions = useCallback((square, g) => {
    const src = g || game
    const moves = src.moves({ square, verbose: true })
    if (!moves.length) return false
    const opts = {}
    moves.forEach((m) => {
      opts[m.to] = {
        background: src.get(m.to)
          ? 'radial-gradient(circle, rgba(239,68,68,0.5) 68%, transparent 70%)'
          : 'radial-gradient(circle, rgba(79,142,247,0.45) 36%, transparent 38%)',
        borderRadius: '50%',
      }
    })
    opts[square] = { background: 'rgba(79,142,247,0.28)', borderRadius: '4px' }
    setOptSquares(opts)
    return true
  }, [game])

  // ── Click-to-move ─────────────────────────────────────────────────────────
  const onSquareClick = useCallback(({ square }) => {
    if (!interactive) return

    // First click: select piece
    if (!moveFrom) {
      if (showMoveOptions(square)) {
        setMoveFrom(square)
        onSelect?.(square)        // emit to socket
      }
      return
    }

    // Second click: attempt move
    const copy   = safeLoad(game.fen())
    let result = null
    try {
      result = copy.move({ from: moveFrom, to: square, promotion: 'q' })
    } catch (e) {
      // Invalid move (e.g. chess.js 1.x throws on invalid)
    }

    if (!result) {
      // Try re-selecting
      if (showMoveOptions(square)) {
        setMoveFrom(square)
        onSelect?.(square)
      } else {
        setMoveFrom(null)
        setOptSquares({})
        onSelect?.(null)
      }
      return
    }

    setGame(copy)
    setMoveFrom(null)
    setOptSquares({})
    onMove?.({ from: moveFrom, to: square, san: result.san, fen: copy.fen() })
  }, [interactive, moveFrom, game, showMoveOptions, onMove, onSelect])

  // ── Drag start ────────────────────────────────────────────────────────────
  const onPieceDragBegin = useCallback(({ sourceSquare }) => {
    if (window.event?.ctrlKey || window.event?.altKey) return false; // Prevent drag if drawing arrow
    if (!interactive) return false;
    setLocalDragFrom(sourceSquare)
    setMoveFrom(null)
    setOptSquares({})
    showMoveOptions(sourceSquare)
    onSelect?.(sourceSquare)
    return true;
  }, [interactive, showMoveOptions, onSelect])

  const onMouseOverSquare = useCallback((data) => {
    const square = data.square || data; // handle object or string just in case
    if (drawingArrow) {
      setDrawingArrowEnd(square)
    }
    if (!interactive || !localDragFrom) return
    if (dragThrottleRef.current) return   // throttle
    dragThrottleRef.current = setTimeout(() => { dragThrottleRef.current = null }, 16)
    onDragUpdate?.({ from: localDragFrom, square })
  }, [interactive, localDragFrom, onDragUpdate, drawingArrow])

  // ── Custom Arrow Drawing (Ctrl/Alt + Left Click) ─────────────────────────
  const onSquareMouseDown = useCallback((data, e) => {
    // Prevent default right-click native menu
    if (e?.button === 2) return;

    if (e?.ctrlKey || e?.altKey) {
      e.stopPropagation();
      const color = e.ctrlKey ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.85)';
      setDrawingArrow({ startSquare: data.square, color });
      setDrawingArrowEnd(data.square);
    }
  }, []);

  const onSquareMouseUp = useCallback((data, e) => {
    if (drawingArrow) {
      e?.stopPropagation?.();
      const end = data.square;
      if (drawingArrow.startSquare === end) {
        // Clicked same square: clear arrows originating here
        setArrows(prev => prev.filter(a => a.startSquare !== end && a.endSquare !== end));
      } else {
        // Complete arrow: add or toggle
        setArrows(prev => {
          const exists = prev.some(a => a.startSquare === drawingArrow.startSquare && a.endSquare === end);
          if (exists) {
            return prev.filter(a => !(a.startSquare === drawingArrow.startSquare && a.endSquare === end));
          } else {
            return [...prev, { startSquare: drawingArrow.startSquare, endSquare: end, color: drawingArrow.color }];
          }
        });
      }
      setDrawingArrow(null);
      setDrawingArrowEnd(null);
    }
  }, [drawingArrow]);

  const onArrowsChange = useCallback(({ arrows }) => {
    setArrows(arrows);
  }, []);

  // ── Drag drop ─────────────────────────────────────────────────────────────
  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }) => {
    if (!interactive) return false
    if (sourceSquare === targetSquare) return false; // Optimization

    const copy   = safeLoad(game.fen())
    let result = null;
    try {
      result = copy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
    } catch (e) {
      // Invalid move
    }

    if (!result) {
      setLocalDragFrom(null)
      setOptSquares({})
      onDragCancel?.()
      return false
    }
    setGame(copy)
    setLocalDragFrom(null)
    setMoveFrom(null)
    setOptSquares({})
    onMove?.({ from: sourceSquare, to: targetSquare, san: result.san, fen: copy.fen() })
    return true
  }, [interactive, game, onMove, onDragCancel])

  // ── Drag ends without a valid drop ────────────────────────────────────────
  const onPieceDragEnd = useCallback(() => {
    if (!interactive) return
    setLocalDragFrom(null)
    setOptSquares({})
    onDragCancel?.()
  }, [interactive, onDragCancel])

  // ── Build square styles ───────────────────────────────────────────────────
  const squareStyles = {}

  // 1. Last move — golden highlight (both admin and student see this)
  if (lastMove?.from) squareStyles[lastMove.from] = {
    backgroundColor: 'rgba(245,158,11,0.38)',
  }
  if (lastMove?.to)   squareStyles[lastMove.to]   = {
    backgroundColor: 'rgba(245,158,11,0.55)',
    boxShadow: 'inset 0 0 0 2px rgba(245,158,11,0.7)',
  }

  // 2. Legal move dots (local interactive user)
  Object.assign(squareStyles, optSquares)

  // 3. Local drag origin (bright while dragging)
  if (localDragFrom) {
    squareStyles[localDragFrom] = {
      backgroundColor: 'rgba(79,142,247,0.35)',
      boxShadow: 'inset 0 0 0 3px rgba(79,142,247,0.8)',
    }
  }

  // 4. Remote selected square (admin's click, shown to students)
  if (remoteSelected && !lastMove) {
    squareStyles[remoteSelected] = {
      backgroundColor: 'rgba(168,85,247,0.35)',
      boxShadow: 'inset 0 0 0 3px rgba(168,85,247,0.75)',
    }
  }

  // 5. Remote drag origin (shown to students while admin is dragging)
  if (remoteDragFrom) {
    squareStyles[remoteDragFrom] = {
      backgroundColor: 'rgba(168,85,247,0.28)',
      boxShadow: 'inset 0 0 0 3px rgba(168,85,247,0.65)',
    }
  }

  // 6. Remote drag hover — shows WHERE the piece is mid-drag (the "screen sharing" effect)
  if (remoteDragOver && remoteDragOver !== remoteDragFrom) {
    squareStyles[remoteDragOver] = {
      backgroundColor: 'rgba(168,85,247,0.55)',
      boxShadow: 'inset 0 0 0 3px rgba(168,85,247,0.9)',
      borderRadius: '4px',
    }
  }

  // 7. Combine manual drawing arrow
  const displayArrows = [...arrows];
  if (drawingArrow && drawingArrowEnd && drawingArrow.startSquare !== drawingArrowEnd) {
    displayArrows.push({
      startSquare: drawingArrow.startSquare,
      endSquare: drawingArrowEnd,
      color: drawingArrow.color
    });
  }

  return (
    <div className={styles.wrapper} style={{ width: size, height: size }}>
      <Chessboard
        key={id}
        options={{
          id,
          position:         fen,       // always use prop — never internal state
          boardOrientation: orientation,
          allowDragging:    interactive,
          showNotation:     showCoordinates,
          squareStyles,
          onSquareClick,
          onPieceDrop,
          onPieceDragBegin,
          onPieceDragEnd,
          onMouseOverSquare,
          onSquareMouseDown,
          onSquareMouseUp,
          arrows: displayArrows,
          onArrowsChange,
          clearArrowsOnClick: false,
          customBoardStyle: {
            borderRadius: '8px',
            boxShadow: '0 6px 32px rgba(0,0,0,0.5)',
          },
          customDarkSquareStyle:  { backgroundColor: '#2d4a7a' },
          customLightSquareStyle: { backgroundColor: '#e8eef7' },
          animationDuration: 120,    // fast animation for live feel
          arrowOptions: {
            color: 'rgba(239, 68, 68, 0.85)',       // Red (Default & Alt)
            secondaryColor: 'rgba(79, 142, 247, 0.85)', // Blue (Shift)
            tertiaryColor: 'rgba(34, 197, 94, 0.85)',  // Green (Ctrl)
            opacity: 0.85,
            activeOpacity: 0.7,
            arrowWidthDenominator: 4.5,
          },
        }}
      />
    </div>
  )
}
