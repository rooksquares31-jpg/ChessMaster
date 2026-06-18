import React, { useState, useCallback, useEffect } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess, validateFen as chessValidateFen } from 'chess.js'
import styles from './ChessBoard.module.css'

const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Load a FEN string into a new Chess instance. Returns null if invalid. */
function loadFen(fen) {
  try {
    const result = chessValidateFen(fen)
    if (!result.ok) return null
    const g = new Chess()
    g.load(fen)
    return g
  } catch {
    return null
  }
}

export default function ChessBoard({
  fen = DEFAULT_FEN,
  onMove,           // called with { from, to, san, fen }
  interactive = false,
  size = 360,
  showCoordinates = true,
  orientation = 'white',
  highlightSquares = [],  // [{ square, color }]
  lastMove = null,        // { from, to }
  id = 'chess-board',
}) {
  // Always initialize from the fen prop
  const [game, setGame] = useState(() => loadFen(fen) ?? new Chess())
  const [moveFrom, setMoveFrom] = useState(null)
  const [optionSquares, setOptionSquares] = useState({})

  const position = fen

  // ── Sync internal game state whenever the `fen` prop changes ─────────────
  // We do NOT guard with a ref — just always reload on every fen change.
  useEffect(() => {
    const g = loadFen(fen)
    if (g) {
      setGame(g)
      setMoveFrom(null)
      setOptionSquares({})
    }
  }, [fen]) // eslint-disable-line react-hooks/exhaustive-deps

  const getMoveOptions = useCallback((square) => {
    const moves = game.moves({ square, verbose: true })
    if (!moves.length) return false
    const opts = {}
    moves.forEach((m) => {
      opts[m.to] = {
        background: game.get(m.to)
          ? 'radial-gradient(circle, rgba(239,68,68,0.4) 70%, transparent 72%)'
          : 'radial-gradient(circle, rgba(79,142,247,0.35) 40%, transparent 42%)',
        borderRadius: '50%',
      }
    })
    opts[square] = { background: 'rgba(79,142,247,0.25)' }
    setOptionSquares(opts)
    return true
  }, [game])

  const onSquareClickInternal = useCallback((square) => {
    if (!interactive) return

    if (!moveFrom) {
      const hasMoves = getMoveOptions(square)
      if (hasMoves) setMoveFrom(square)
      return
    }

    const move = { from: moveFrom, to: square, promotion: 'q' }
    const gameCopy = new Chess(game.fen())
    const result = gameCopy.move(move)

    if (!result) {
      const hasMoves = getMoveOptions(square)
      setMoveFrom(hasMoves ? square : null)
      if (!hasMoves) setOptionSquares({})
      return
    }

    console.log(`[ChessBoard - ${id}] Click move executed:`, result.san, 'New FEN:', gameCopy.fen())
    setGame(gameCopy)
    setMoveFrom(null)
    setOptionSquares({})
    onMove?.({ from: moveFrom, to: square, san: result.san, fen: gameCopy.fen() })
  }, [interactive, moveFrom, game, getMoveOptions, onMove, id])

  const onPieceDropInternal = useCallback((sourceSquare, targetSquare) => {
    if (!interactive) return false
    try {
      const gameCopy = new Chess(game.fen())
      const result = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
      if (!result) return false
      console.log(`[ChessBoard - ${id}] Drag move executed:`, result.san, 'New FEN:', gameCopy.fen())
      setGame(gameCopy)
      setMoveFrom(null)
      setOptionSquares({})
      onMove?.({ from: sourceSquare, to: targetSquare, san: result.san, fen: gameCopy.fen() })
      return true
    } catch (e) {
      console.error(`[ChessBoard - ${id}] Move error:`, e.message)
      return false
    }
  }, [interactive, game, onMove, id])

  // Custom square styles
  const customSquareStyles = {}
  highlightSquares.forEach(({ square, color }) => {
    customSquareStyles[square] = { backgroundColor: color }
  })
  if (lastMove) {
    customSquareStyles[lastMove.from] = { backgroundColor: 'rgba(245,158,11,0.35)' }
    customSquareStyles[lastMove.to] = { backgroundColor: 'rgba(245,158,11,0.5)' }
  }
  Object.assign(customSquareStyles, optionSquares)

  console.log("React Version:", React.version)
  console.log("Chessboard Props:", { id, position, orientation, size, interactive })
  console.log("Current Position:", fen)

  // Construct options object required by react-chessboard v5.x
  const boardOptions = {
    id,
    position: game.fen(),
    boardOrientation: orientation,
    allowDragging: interactive,
    showNotation: showCoordinates,
    squareStyles: customSquareStyles,
    onSquareClick: ({ square }) => onSquareClickInternal(square),
    onPieceDrop: ({ sourceSquare, targetSquare }) => onPieceDropInternal(sourceSquare, targetSquare),
  }

  return (
    <div className={styles.wrapper} style={{ width: size }}>
      <Chessboard
        key={id}
        options={boardOptions}
      />
    </div>
  )
}
