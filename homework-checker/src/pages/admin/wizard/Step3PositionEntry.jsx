import { useState } from 'react'
import { Chess, validateFen as chessValidateFen } from 'chess.js'
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import ChessBoard from '../../../components/chess/ChessBoard'
import Input from '../../../components/ui/Input'
import styles from './Steps.module.css'

function PositionCard({ index, position, update }) {
  const [expanded, setExpanded] = useState(index === 0)
  const [fenError, setFenError] = useState('')

  const validateFen = (fen) => {
    let cleanFen = (fen || '').trim()
    if (
      (cleanFen.startsWith("'") && cleanFen.endsWith("'")) ||
      (cleanFen.startsWith('"') && cleanFen.endsWith('"'))
    ) {
      cleanFen = cleanFen.slice(1, -1).trim()
    }
    update('fen', cleanFen)
    try {
      if (!cleanFen) {
        setFenError('FEN string cannot be empty')
        return
      }
      const val = chessValidateFen(cleanFen)
      if (!val.ok) {
        setFenError(val.error || 'Invalid FEN string')
        return
      }
      const g = new Chess()
      g.load(cleanFen)
      setFenError('')
    } catch (e) {
      setFenError(e.message || 'Invalid FEN string')
    }
  }

  const isComplete = position.fen && position.correctMove

  return (
    <div className={[styles.posCard, isComplete ? styles.posComplete : ''].join(' ')}>
      {/* Card header */}
      <button className={styles.posHeader} type="button" onClick={() => setExpanded((e) => !e)}>
        <div className={styles.posHeaderLeft}>
          <span className={[styles.posNum, isComplete ? styles.posNumDone : ''].join(' ')}>
            {isComplete ? <CheckCircle size={14} /> : index + 1}
          </span>
          <span className={styles.posTitle}>Position {index + 1}</span>
          {position.correctMove && (
            <span className={styles.posMove}>✓ {position.correctMove}</span>
          )}
        </div>
        <div className={styles.posHeaderRight}>
          <span className={styles.posPoints}>{position.points} pts</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className={styles.posBody}>
          <div className={styles.posGrid}>
            {/* Board preview */}
            <div className={styles.boardCol}>
              {/* Always keep the board mounted so updates are smooth.
                  ChessBoard internally ignores invalid FENs, holding the
                  last valid position while the user is still typing. */}
              {position.fen ? (
                <ChessBoard
                  id={`board-${index}`}
                  fen={position.fen}
                  size={240}
                  interactive={true}
                  onMove={({ fen }) => validateFen(fen)}
                />
              ) : (
                <div className={styles.boardPlaceholder}>Enter a FEN to preview the position</div>
              )}
            </div>

            {/* Fields */}
            <div className={styles.fieldsCol}>
              <div>
                <label className={styles.label}>FEN Position <span className={styles.req}>*</span></label>
                <input
                  className={[styles.fenInput, fenError ? styles.fenErr : ''].join(' ')}
                  placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  value={position.fen}
                  onChange={(e) => validateFen(e.target.value)}
                />
                {fenError && <p className={styles.errTxt}>{fenError}</p>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className={styles.ptsBtn}
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => validateFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')}
                  >
                    🚀 Starting Position
                  </button>
                  <button
                    type="button"
                    className={styles.ptsBtn}
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => validateFen('8/8/8/8/8/8/8/8 w - - 0 1')}
                  >
                    🧹 Empty Board
                  </button>
                </div>
                <p className={styles.hint}>Standard FEN notation for the starting position</p>
              </div>

              <Input
                label="Correct Move"
                placeholder="e.g. Qh5#, Rxf7+, e4"
                value={position.correctMove}
                onChange={(e) => update('correctMove', e.target.value)}
                required
                hint="Algebraic notation (SAN format)"
              />

              <div>
                <label className={styles.label}>Explanation / Hint</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Why is this the correct move? What pattern does it demonstrate?"
                  value={position.explanation}
                  onChange={(e) => update('explanation', e.target.value)}
                  rows={3}
                />
              </div>

              <div className={styles.pointsRow}>
                <label className={styles.label}>Points</label>
                <div className={styles.pointsBtns}>
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n} type="button"
                      className={[styles.ptsBtn, position.points === n ? styles.ptsBtnActive : ''].join(' ')}
                      onClick={() => update('points', n)}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number" min={1} max={100}
                    className={styles.ptsInput}
                    value={position.points}
                    onChange={(e) => update('points', parseInt(e.target.value) || 10)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Step3PositionEntry({ positions, updatePosition }) {
  const completed = positions.filter((p) => p.fen && p.correctMove).length
  return (
    <div className={styles.step}>
      <div className={styles.posStepHeader}>
        <div>
          <h2 className={styles.stepTitle}>Enter Positions</h2>
          <p className={styles.stepDesc}>Configure each chess position with FEN, correct move and explanation.</p>
        </div>
        <div className={styles.posProgress}>
          <span className={styles.posProgressNum}>{completed}/{positions.length}</span>
          <span className={styles.posProgressLbl}>completed</span>
        </div>
      </div>

      <div className={styles.posCards}>
        {positions.map((pos, i) => (
          <PositionCard
            key={i}
            index={i}
            position={pos}
            update={(field, value) => updatePosition(i, field, value)}
          />
        ))}
      </div>
    </div>
  )
}
