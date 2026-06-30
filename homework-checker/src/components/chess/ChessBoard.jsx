import { useState, useCallback, useEffect, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { Maximize2, X } from 'lucide-react'
import styles from './ChessBoard.module.css'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function safeLoad(fen) {
  try { const g = new Chess(); g.load(fen || START_FEN); return g }
  catch { return new Chess() }
}

/**
 * Ideal fullscreen board size:
 * - Uses the SMALLER of (90% viewport width) and (80% viewport height)
 * - Viewport height minus ~80px for the hint bar and close button
 * - Hard cap 660px so it's never absurdly huge on 4K
 * - Minimum 280px so it's always usable on tiny phones
 */
function calcFsSize() {
  const usableW = Math.floor(window.innerWidth  * 0.90)
  const usableH = Math.floor((window.innerHeight - 80) * 0.90)
  return Math.max(280, Math.min(660, usableW, usableH))
}

export default function ChessBoard({
  fen             = START_FEN,
  onMove,
  onSelect,
  onDragUpdate,
  onDragCancel,
  interactive     = false,
  size            = 460,        // pixel size of the board square
  showCoordinates = true,
  orientation     = 'white',
  lastMove        = null,
  remoteSelected  = null,
  remoteDragFrom  = null,
  remoteDragOver  = null,
  id              = 'chess-board',
  allowFullscreen = true,
}) {
  const [game, setGame]             = useState(() => safeLoad(fen))
  const [moveFrom, setMoveFrom]     = useState(null)
  const [optSquares, setOptSquares] = useState({})
  const [localDrag, setLocalDrag]   = useState(null)
  const [arrows, setArrows]         = useState([])
  const [drawArrow, setDrawArrow]   = useState(null)
  const [drawEnd, setDrawEnd]       = useState(null)
  const [isFS, setIsFS]             = useState(false)
  const [fsSize, setFsSize]         = useState(calcFsSize)
  const [boardWidth, setBoardWidth] = useState(size)
  const containerRef                = useRef(null)
  const prevFen     = useRef(fen)
  const throttle    = useRef(null)

  // ── Auto-resize to fit parent container width ──────────────────────────────
  useEffect(() => {
    const parent = containerRef.current?.parentElement
    if (!parent) return

    const updateWidth = () => {
      const parentWidth = parent.getBoundingClientRect().width
      // Account for thick border: 8px left + 8px right = 16px. Add 4px margin room.
      const borderSize = 20
      const available = parentWidth - borderSize
      const targetWidth = Math.max(200, Math.min(size, available))
      setBoardWidth(targetWidth)
    }

    updateWidth()

    const observer = new ResizeObserver(() => {
      updateWidth()
    })
    observer.observe(parent)

    window.addEventListener('resize', updateWidth)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [size])

  // ── Sync FEN from parent ───────────────────────────────────────────────────
  useEffect(() => {
    if (fen === prevFen.current) return
    prevFen.current = fen
    setGame(safeLoad(fen))
    setMoveFrom(null); setOptSquares({}); setLocalDrag(null)
    setArrows([]); setDrawArrow(null); setDrawEnd(null)
  }, [fen])

  // ── Fullscreen size — recalc on open and on resize ─────────────────────────
  useEffect(() => {
    if (!isFS) return
    setFsSize(calcFsSize())
    const onResize = () => setFsSize(calcFsSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isFS])

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && isFS) setIsFS(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isFS])

  // ── Lock body scroll in fullscreen ────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isFS ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isFS])

  // ── Legal move dots ────────────────────────────────────────────────────────
  const showDots = useCallback((sq) => {
    const moves = game.moves({ square: sq, verbose: true })
    if (!moves.length) return false
    const opts = {}
    moves.forEach((m) => {
      opts[m.to] = {
        background: game.get(m.to)
          ? 'radial-gradient(circle,rgba(239,68,68,0.6) 66%,transparent 68%)'
          : 'radial-gradient(circle,rgba(79,142,247,0.55) 34%,transparent 36%)',
        borderRadius: '50%',
      }
    })
    opts[sq] = { background: 'rgba(79,142,247,0.35)', borderRadius: '4px' }
    setOptSquares(opts)
    return true
  }, [game])

  // ── Click-to-move ─────────────────────────────────────────────────────────
  const onSquareClick = useCallback(({ square }) => {
    if (!interactive) return
    if (!moveFrom) {
      if (showDots(square)) { setMoveFrom(square); onSelect?.(square) }
      return
    }
    const copy = new Chess(game.fen())
    let result = null
    try { result = copy.move({ from: moveFrom, to: square, promotion: 'q' }) } catch {}
    if (!result) {
      if (showDots(square)) { setMoveFrom(square); onSelect?.(square) }
      else { setMoveFrom(null); setOptSquares({}); onSelect?.(null) }
      return
    }
    setGame(copy); setMoveFrom(null); setOptSquares({})
    onMove?.({ from: moveFrom, to: square, san: result.san, fen: copy.fen() })
  }, [interactive, moveFrom, game, showDots, onMove, onSelect])

  // ── Drag ──────────────────────────────────────────────────────────────────
  const onPieceDragBegin = useCallback(({ sourceSquare }) => {
    if (!interactive) return false
    setLocalDrag(sourceSquare); setMoveFrom(null); setOptSquares({})
    showDots(sourceSquare); onSelect?.(sourceSquare)
    return true
  }, [interactive, showDots, onSelect])

  const onMouseOverSquare = useCallback((data) => {
    const sq = data?.square || data
    if (drawArrow) { setDrawEnd(sq); return }
    if (!interactive || !localDrag) return
    if (throttle.current) return
    throttle.current = setTimeout(() => { throttle.current = null }, 16)
    onDragUpdate?.({ from: localDrag, square: sq })
  }, [interactive, localDrag, onDragUpdate, drawArrow])

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }) => {
    if (!interactive || sourceSquare === targetSquare) return false
    const copy = new Chess(game.fen())
    let result = null
    try { result = copy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' }) } catch {}
    if (!result) { setLocalDrag(null); setOptSquares({}); onDragCancel?.(); return false }
    setGame(copy); setLocalDrag(null); setMoveFrom(null); setOptSquares({})
    onMove?.({ from: sourceSquare, to: targetSquare, san: result.san, fen: copy.fen() })
    return true
  }, [interactive, game, onMove, onDragCancel])

  const onPieceDragEnd = useCallback(() => {
    if (!interactive) return
    setLocalDrag(null); setOptSquares({}); onDragCancel?.()
  }, [interactive, onDragCancel])

  // ── Arrow drawing ─────────────────────────────────────────────────────────
  const onSquareMouseDown = useCallback((data, e) => {
    if (e?.button === 2 || (!e?.ctrlKey && !e?.altKey)) return
    e.stopPropagation()
    const col = e.ctrlKey ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)'
    setDrawArrow({ startSquare: data.square, color: col })
    setDrawEnd(data.square)
  }, [])

  const onSquareMouseUp = useCallback((data, e) => {
    if (!drawArrow) return
    e?.stopPropagation?.()
    const end = data.square
    setArrows(prev => {
      if (drawArrow.startSquare === end)
        return prev.filter(a => a.startSquare !== end && a.endSquare !== end)
      const exists = prev.some(a => a.startSquare === drawArrow.startSquare && a.endSquare === end)
      return exists
        ? prev.filter(a => !(a.startSquare === drawArrow.startSquare && a.endSquare === end))
        : [...prev, { startSquare: drawArrow.startSquare, endSquare: end, color: drawArrow.color }]
    })
    setDrawArrow(null); setDrawEnd(null)
  }, [drawArrow])

  // ── Square highlight styles ────────────────────────────────────────────────
  const sqStyles = {}
  if (lastMove?.from) sqStyles[lastMove.from] = { backgroundColor: 'rgba(245,158,11,0.42)' }
  if (lastMove?.to)   sqStyles[lastMove.to]   = { backgroundColor: 'rgba(245,158,11,0.60)', boxShadow: 'inset 0 0 0 3px rgba(245,158,11,0.85)' }
  Object.assign(sqStyles, optSquares)
  if (localDrag)     sqStyles[localDrag]     = { backgroundColor: 'rgba(79,142,247,0.42)', boxShadow: 'inset 0 0 0 3px rgba(79,142,247,0.95)' }
  if (remoteSelected) sqStyles[remoteSelected] = { backgroundColor: 'rgba(168,85,247,0.42)', boxShadow: 'inset 0 0 0 3px rgba(168,85,247,0.9)' }
  if (remoteDragFrom) sqStyles[remoteDragFrom] = { backgroundColor: 'rgba(168,85,247,0.28)', boxShadow: 'inset 0 0 0 3px rgba(168,85,247,0.65)' }
  if (remoteDragOver && remoteDragOver !== remoteDragFrom)
    sqStyles[remoteDragOver] = { backgroundColor: 'rgba(168,85,247,0.62)', boxShadow: 'inset 0 0 0 3px rgba(168,85,247,1)', borderRadius: '4px' }

  const allArrows = [...arrows]
  if (drawArrow && drawEnd && drawArrow.startSquare !== drawEnd)
    allArrows.push({ startSquare: drawArrow.startSquare, endSquare: drawEnd, color: drawArrow.color })

  // ── Build react-chessboard options ────────────────────────────────────────
  const makeOpts = (boardWidth) => ({
    id,
    position:          fen,
    boardOrientation:  orientation,
    allowDragging:     interactive,
    showNotation:      showCoordinates,
    squareStyles:      sqStyles,
    onSquareClick,
    onPieceDrop,
    onPieceDragBegin,
    onPieceDragEnd,
    onMouseOverSquare,
    onSquareMouseDown,
    onSquareMouseUp,
    arrows: allArrows,
    onArrowsChange: ({ arrows: a }) => setArrows(a),
    clearArrowsOnClick: false,
    animationDuration:  110,
    boardWidth,
    // ── Visual styling (React Chessboard native props) ──────────────────
    boardStyle: {
      borderRadius: '6px',
      // Thick brown border around the board
      border: '8px solid #8B4513',
      boxShadow: '0 0 0 2px rgba(139,69,19,0.5), 0 10px 40px rgba(0,0,0,0.6)',
    },
    // High-contrast square colours
    darkSquareStyle:  { backgroundColor: '#2d4a7a' },
    lightSquareStyle: { backgroundColor: '#e8eef7' },
    // ── Coordinate labels: Lichess Style (Alternating contrast colors) ──
    darkSquareNotationStyle: {
      color: '#e8eef7', // Light square color (cream/white) on dark squares
    },
    lightSquareNotationStyle: {
      color: '#2d4a7a', // Dark square color (dark blue) on light squares
    },
    alphaNotationStyle: {
      fontFamily: '"Inter", system-ui, sans-serif',
      fontWeight: '900',
      fontSize:   '15px',       // highly readable
      position:   'absolute',
      bottom:     '2px',
      right:      '4px',
      userSelect: 'none',
    },
    numericNotationStyle: {
      fontFamily: '"Inter", system-ui, sans-serif',
      fontWeight: '900',
      fontSize:   '15px',       // highly readable
      position:   'absolute',
      top:        '2px',
      left:       '4px',
      userSelect: 'none',
    },
  })

  // ── Normal render ─────────────────────────────────────────────────────────
  return (
    <>
      <div className={styles.boardOuterContainer} style={{ visibility: isFS ? 'hidden' : 'visible' }}>
        <div 
          ref={containerRef} 
          className={styles.wrapper} 
          style={{ 
            width: boardWidth, 
            height: boardWidth,
            pointerEvents: isFS ? 'none' : 'auto'
          }}
        >
          <Chessboard key={`${id}-normal`} options={makeOpts(boardWidth)} />
        </div>

        {allowFullscreen && (
          <button
            className={styles.fsBtnExternal}
            onClick={() => setIsFS(true)}
            title="Fullscreen"
            aria-label="Enter fullscreen"
          >
            <Maximize2 size={13} /> Fullscreen
          </button>
        )}
      </div>

      {isFS && (
        <div className={styles.fsOverlay} onClick={() => setIsFS(false)}>
          <div className={styles.fsInner} onClick={(e) => e.stopPropagation()}>
            {/* ✕ close button */}
            <button className={styles.fsClose} onClick={() => setIsFS(false)} aria-label="Exit fullscreen">
              <X size={18} />
            </button>

            {/* Board — sized to fit viewport correctly */}
            <div className={styles.fsBoardWrap} style={{ width: fsSize, height: fsSize }}>
              <Chessboard key={`${id}-fs`} options={makeOpts(fsSize)} />
            </div>

            {/* Hint */}
            <p className={styles.fsHint}>
              Click outside&nbsp; or press <kbd>Esc</kbd> to exit
            </p>
          </div>
        </div>
      )}
    </>
  )
}
