import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Play, Square, RotateCcw, Send, Users, MessageSquare,
  Copy, Mic, MicOff, ArrowLeft, Shield, ShieldOff,
  Crown, GraduationCap, Eye, Pencil, WifiOff, Wifi,
  ChevronLeft, ChevronRight, SkipBack, SkipForward,
  Phone, Maximize2, Minimize2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { connectSocket } from '../../lib/socket'
import { useClassroomStore } from '../../store/classroomStore'
import { useAuthStore } from '../../store/authStore'
import useVoiceChat from '../../hooks/useVoiceChat'
import api from '../../lib/api'
import ChessBoard from '../../components/chess/ChessBoard'
import VoiceBar from '../../components/voice/VoiceBar'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from './LiveClassroom.module.css'
import voiceStyles from '../../components/voice/VoiceBar.module.css'

/* ══════════════════════════════════════════════════════════════
   Participant row
══════════════════════════════════════════════════════════════ */
function ParticipantRow({ p, isAdmin, myId, onToggleBoard, onToggleMute, isSpeaking, isInVoice }) {
  const uid  = (p.userId?._id || p.userId)?.toString()
  const isMe = uid === myId
  const name = p.userId?.firstName
    ? `${p.userId.firstName} ${p.userId.lastName || ''}`.trim()
    : p.userId?.username || 'Unknown'

  return (
    <div className={[styles.pRow, isMe ? styles.pRowMe : ''].join(' ')}>
      <div
        className={`${styles.pAvatar} ${isSpeaking ? voiceStyles.avatarSpeaking : ''}`}
        style={{
          background: p.canControlBoard
            ? 'linear-gradient(135deg,#22c55e,#16a34a)'
            : 'linear-gradient(135deg,#4f8ef7,#a855f7)',
        }}
      >
        {(name[0] || '?').toUpperCase()}
      </div>
      <div className={styles.pInfo}>
        <div className={styles.pName}>
          {name}{isMe && <span className={styles.youTag}>You</span>}
        </div>
        <div className={styles.pBadges}>
          {p.canControlBoard && <Badge variant="green" size="sm"><Shield size={9} /> Board</Badge>}
          {p.isMuted          && <Badge variant="red"   size="sm"><MicOff size={9} /> Muted</Badge>}
          {isInVoice && (
            <span className={voiceStyles.voiceBadge}>
              <Phone size={8} /> Voice{isSpeaking ? ' 🔊' : ''}
            </span>
          )}
        </div>
      </div>
      {isAdmin && !isMe && (
        <div className={styles.pActions}>
          <button
            className={[styles.permBtn, p.canControlBoard ? styles.permActive : ''].join(' ')}
            title={p.canControlBoard ? 'Revoke board control' : 'Grant board control'}
            onClick={() => onToggleBoard(uid, !p.canControlBoard)}
          >
            {p.canControlBoard ? <ShieldOff size={13} /> : <Shield size={13} />}
          </button>
          <button
            className={[styles.permBtn, p.isMuted ? styles.muteActive : ''].join(' ')}
            title={p.isMuted ? 'Unmute' : 'Mute'}
            onClick={() => onToggleMute(uid, !p.isMuted)}
          >
            {p.isMuted ? <Mic size={13} /> : <MicOff size={13} />}
          </button>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Chat panel
══════════════════════════════════════════════════════════════ */
function ChatPanel({ messages, onSend, myId }) {
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const t = text.trim(); if (!t) return
    onSend(t); setText('')
  }

  return (
    <div className={styles.chat}>
      <div className={styles.chatMessages}>
        {messages.length === 0 && (
          <div className={styles.chatEmpty}>No messages yet. Say hello! 👋</div>
        )}
        {messages.map((m, i) => {
          const isMe = m.userId?.toString() === myId
          return (
            <div key={i} className={[styles.chatMsg, isMe ? styles.chatMsgMe : ''].join(' ')}>
              {!isMe && <div className={styles.chatSender}>{m.name}</div>}
              <div className={styles.chatBubble}>{m.message}</div>
              <div className={styles.chatTime}>
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className={styles.chatInputRow}>
        <input
          className={styles.chatBox}
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          maxLength={500}
        />
        <button className={styles.chatSendBtn} onClick={send} disabled={!text.trim()}>
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Live Classroom — main component
══════════════════════════════════════════════════════════════ */
export default function LiveClassroom() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin  = user?.role === 'admin'
  const myId     = user?._id?.toString()
  const socketRef = useRef(null)

  const {
    classroom, initialFen, boardFen, myPermissions, participants,
    chatMessages, sessionStatus, lastMove, moveHistory,
    selectedSquare, dragFrom, dragOver,
    voiceParticipants, speakingUsers,
    setRoomState, updateParticipants, applyMove,
    resetBoard, setFen, updatePermission,
    setSelectedSquare, setDragState, clearDrag,
    addChat, setSessionStatus, reset,
  } = useClassroomStore()

  const [tab,       setTab]      = useState('participants')
  const [fenInput,  setFenInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [currentMoveIndex, setCurrentMoveIndex] = useState(null)
  const [isFocusMode, setIsFocusMode] = useState(!isAdmin)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const moveListRef = useRef(null)

  // Voice chat hook
  const voice = useVoiceChat(socketRef, id, myId)

  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight
    }
  }, [moveHistory.length])

  const { data: classroomData } = useQuery({
    queryKey: ['classroom', id],
    queryFn:  () => api.get(`/classrooms/${id}`).then((r) => r.data.data),
  })

  /* ── Socket lifecycle ──────────────────────────────────────── */
  useEffect(() => {
    const socket = connectSocket()
    socketRef.current = socket

    const onConnect    = () => { setConnected(true); socket.emit('room:join', { classroomId: id }) }
    const onDisconnect = () => setConnected(false)

    const onRoomState      = (d) => {
      setRoomState(d, myId)
      if (d.classroom?.status === 'live' && !isAdmin) {
        setIsFocusMode(true)
      }
    }
    const onParticipants   = ({ participants: list }) => updateParticipants(list, myId)

    // ── Instant board move ─────────────────────────────────────
    const onMove = (d) => { applyMove(d); setCurrentMoveIndex(null); }
    const onReset = (d) => { resetBoard(d.fen); setCurrentMoveIndex(null); }
    const onFen   = (d) => { setFen(d.fen); setCurrentMoveIndex(null); }

    // ── Remote cursor events (admin click/drag → visible on student board) ──
    const onRemoteSelect = ({ square }) => setSelectedSquare(square)
    const onRemoteDrag   = ({ from, square }) => setDragState(from, square)
    const onRemoteDragCancel = () => clearDrag()

    const onPermission = (d) => {
      updatePermission(d, myId)
      if (d.userId?.toString() === myId) {
        if (d.canControlBoard === true)  toast.success('🎮 Board control granted!')
        if (d.canControlBoard === false) toast('👀 Board control revoked — view only')
      }
    }

    const onSessionStart = () => {
      setSessionStatus('live')
      toast.success('🚀 Session started!')
      // Students default to focus mode on session start
      if (!isAdmin) {
        setIsFocusMode(true)
      }
    }
    const onSessionEnd   = () => {
      setSessionStatus('ended')
      toast('Session ended by coach')
      if (voice.isInVoice) voice.leaveVoice()
    }
    const onChat  = (m) => addChat(m)
    const onError = (e) => toast.error(e.message || 'Socket error')

    socket.on('connect',             onConnect)
    socket.on('disconnect',          onDisconnect)
    socket.on('room:state',          onRoomState)
    socket.on('participants:update', onParticipants)
    socket.on('board:move',          onMove)
    socket.on('board:reset',         onReset)
    socket.on('board:fen',           onFen)
    socket.on('board:select',        onRemoteSelect)
    socket.on('board:dragUpdate',    onRemoteDrag)
    socket.on('board:dragCancel',    onRemoteDragCancel)
    socket.on('permission:update',   onPermission)
    socket.on('session:started',     onSessionStart)
    socket.on('session:ended',       onSessionEnd)
    socket.on('chat:message',        onChat)
    socket.on('error',               onError)

    return () => {
      socket.off('connect',             onConnect)
      socket.off('disconnect',          onDisconnect)
      socket.off('room:state',          onRoomState)
      socket.off('participants:update', onParticipants)
      socket.off('board:move',          onMove)
      socket.off('board:reset',         onReset)
      socket.off('board:fen',           onFen)
      socket.off('board:select',        onRemoteSelect)
      socket.off('board:dragUpdate',    onRemoteDrag)
      socket.off('board:dragCancel',    onRemoteDragCancel)
      socket.off('permission:update',   onPermission)
      socket.off('session:started',     onSessionStart)
      socket.off('session:ended',       onSessionEnd)
      socket.off('chat:message',        onChat)
      socket.off('error',               onError)
      socket.emit('room:leave', { classroomId: id })
      reset()
    }
  }, [id, myId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Board event emitters ──────────────────────────────────── */

  // Move: optimistic local apply + broadcast
  const emitMove = useCallback(({ from, to, san, fen }) => {
    applyMove({ from, to, san, fen })
    setCurrentMoveIndex(null)
    socketRef.current?.emit('board:move', { classroomId: id, from, to, san, fen })
  }, [id, applyMove])

  // Click-select: highlight on all viewers instantly
  const emitSelect = useCallback((square) => {
    if (!square) {
      clearDrag()
      socketRef.current?.emit('board:dragCancel', { classroomId: id })
    } else {
      setSelectedSquare(square)
      socketRef.current?.emit('board:select', { classroomId: id, square })
    }
  }, [id, setSelectedSquare, clearDrag])

  // Drag update: throttled (called ~60fps from ChessBoard)
  const emitDragUpdate = useCallback(({ from, square }) => {
    setDragState(from, square)   // update local store (admin sees it too)
    socketRef.current?.emit('board:dragUpdate', { classroomId: id, from, square })
  }, [id, setDragState])

  // Drag cancel
  const emitDragCancel = useCallback(() => {
    clearDrag()
    socketRef.current?.emit('board:dragCancel', { classroomId: id })
  }, [id, clearDrag])

  const emitReset = () => { setCurrentMoveIndex(null); socketRef.current?.emit('board:reset', { classroomId: id }); }
  const emitFen   = () => {
    if (!fenInput.trim()) return
    setCurrentMoveIndex(null)
    socketRef.current?.emit('board:setFen', { classroomId: id, fen: fenInput.trim() })
    setFenInput('')
  }
  const toggleBoard  = (uid, grant) => socketRef.current?.emit('permission:board', { classroomId: id, targetUserId: uid, grant })
  const toggleMute   = (uid, mute)  => socketRef.current?.emit('permission:mute',  { classroomId: id, targetUserId: uid, mute })
  const startSession = () => socketRef.current?.emit('session:start', { classroomId: id })
  const endSession   = () => { if (!window.confirm('End session for all students?')) return; socketRef.current?.emit('session:end', { classroomId: id }) }
  const sendChat     = (msg) => socketRef.current?.emit('chat:send', { classroomId: id, message: msg })
  const copyCode     = () => { const c = classroomData?.code; if (!c) return; navigator.clipboard.writeText(c); toast.success(`Code "${c}" copied!`) }

  /* ── Derived ────────────────────────────────────────────────── */
  const canMove   = isAdmin || myPermissions?.canControlBoard
  const roomTitle = classroom?.title || classroomData?.title || 'Classroom'

  const statusInfo = (() => {
    if (sessionStatus === 'ended')  return { icon: <Square size={13} />,  text: 'Session ended',          color: 'var(--text-muted)' }
    if (sessionStatus === 'waiting' && !isAdmin) return { icon: null, text: 'Waiting for coach to start the session…', color: 'var(--yellow)' }
    if (!canMove  && sessionStatus === 'live')   return { icon: <Eye size={13} />,   text: 'View only — watching live', color: 'var(--text-secondary)' }
    if (canMove   && sessionStatus === 'live')   return { icon: <Pencil size={13} />, text: 'Your turn — you can move', color: 'var(--green)' }
    return null
  })()

  // ── History Playback Logic ──
  const activeIndex = currentMoveIndex === null ? moveHistory.length : currentMoveIndex
  const isViewingHistory = activeIndex < moveHistory.length
  const displayFen = activeIndex === 0
    ? initialFen
    : (moveHistory[activeIndex - 1]?.fen || initialFen)
  const displayLastMove = activeIndex === 0
    ? null
    : { from: moveHistory[activeIndex - 1]?.from, to: moveHistory[activeIndex - 1]?.to }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className={[styles.room, isFocusMode ? styles.focusMode : ''].join(' ')}>

      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn}
          onClick={() => navigate(isAdmin ? '/admin/classrooms' : '/student/classrooms')}>
          <ArrowLeft size={16} />
        </button>
        <div className={styles.roomTitle}>
          <span className={styles.roomName}>{roomTitle}</span>
          <Badge variant={sessionStatus === 'live' ? 'green' : sessionStatus === 'ended' ? 'default' : 'yellow'} dot>
            {sessionStatus === 'live' ? 'Live' : sessionStatus === 'ended' ? 'Ended' : 'Waiting'}
          </Badge>
        </div>
        <div className={styles.topRight}>
          {classroomData?.code && (
            <div className={styles.codeChip}>
              <span className={styles.codeLbl}>CODE</span>
              <span className={styles.codeVal}>{classroomData.code}</span>
              <button className={styles.iconBtn} onClick={copyCode}><Copy size={13} /></button>
            </div>
          )}
          <div className={styles.connIndicator} title={connected ? 'Connected' : 'Reconnecting…'}>
            {connected ? <Wifi size={14} className={styles.connOn} /> : <WifiOff size={14} className={styles.connOff} />}
          </div>
          <Button
            size="sm"
            variant={isFocusMode ? 'primary' : 'secondary'}
            icon={isFocusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            onClick={() => {
              setIsFocusMode(!isFocusMode)
              setDrawerOpen(false)
            }}
          >
            {isFocusMode ? 'Normal View' : 'Focus Mode'}
          </Button>
          {isAdmin && (
            <>
              {sessionStatus === 'waiting' && (
                <Button size="sm" variant="success" icon={<Play size={13} />} onClick={startSession}>Start Session</Button>
              )}
              {sessionStatus === 'live' && (
                <Button size="sm" variant="danger" icon={<Square size={13} />} onClick={endSession}>End Session</Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className={styles.mainArea}>

        {/* ── Board column ── */}
        <div className={styles.boardCol}>

          {/* Admin toolbar */}
          {isAdmin && (
            <div className={styles.boardToolbar}>
              <button className={styles.toolBtn} onClick={emitReset}>
                <RotateCcw size={14} /> Reset
              </button>
              <div className={styles.fenRow}>
                <input
                  className={styles.fenInput}
                  placeholder="Paste FEN to set position…"
                  value={fenInput}
                  onChange={(e) => setFenInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && emitFen()}
                />
                <button className={styles.toolBtn} onClick={emitFen} disabled={!fenInput.trim()}>Set</button>
              </div>
              <div className={styles.playbackControls}>
                <button className={styles.pbBtn} onClick={() => setCurrentMoveIndex(0)} disabled={activeIndex === 0}><SkipBack size={14} /></button>
                <button className={styles.pbBtn} onClick={() => setCurrentMoveIndex(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}><ChevronLeft size={14} /></button>
                <button className={styles.pbBtn} onClick={() => setCurrentMoveIndex(activeIndex >= moveHistory.length ? null : activeIndex + 1)} disabled={activeIndex === moveHistory.length}><ChevronRight size={14} /></button>
                <button className={styles.pbBtn} onClick={() => setCurrentMoveIndex(null)} disabled={activeIndex === moveHistory.length}><SkipForward size={14} /></button>
              </div>
            </div>
          )}

          {/* ── THE BOARD ── */}
          <div className={styles.boardResponsive}>
            <ChessBoard
              key={`board-${id}`}
              id={`live-${id}`}
              fen={displayFen}
              size={isFocusMode ? 820 : 640}
              interactive={canMove && sessionStatus === 'live' && !isViewingHistory}
              onMove={emitMove}
              onSelect={canMove && !isViewingHistory ? emitSelect : undefined}
              onDragUpdate={canMove && !isViewingHistory ? emitDragUpdate : undefined}
              onDragCancel={canMove && !isViewingHistory ? emitDragCancel : undefined}
              lastMove={displayLastMove}
              showCoordinates
              allowFullscreen={isAdmin}
              remoteSelected={!isAdmin ? selectedSquare : null}
              remoteDragFrom={!isAdmin ? dragFrom        : null}
              remoteDragOver={!isAdmin ? dragOver         : null}
            />
          </div>

          {/* Status bar — clean, below board */}
          {statusInfo && (
            <div className={styles.boardStatus} style={{ color: statusInfo.color }}>
              {statusInfo.icon}
              <span>{statusInfo.text}</span>
              {/* Live drag indicator */}
              {!isAdmin && dragFrom && (
                <span className={styles.dragIndicator}>
                  ♟ Coach moving {dragFrom}{dragOver ? ` → ${dragOver}` : '…'}
                </span>
              )}
            </div>
          )}

          {/* Move history */}
          <div className={styles.moveHistory}>
            <span className={styles.moveHistoryLbl}>Moves</span>
            <div className={styles.moveList} ref={moveListRef}>
              {moveHistory.length === 0
                ? <span className={styles.noMoves}>No moves yet</span>
                : Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, rowIndex) => {
                    const whiteIndex = rowIndex * 2;
                    const blackIndex = whiteIndex + 1;
                    const whiteMove = moveHistory[whiteIndex];
                    const blackMove = moveHistory[blackIndex];

                    return (
                      <div key={rowIndex} className={styles.moveRow}>
                        <span className={styles.moveRowNumber}>{rowIndex + 1}.</span>
                        <span
                          className={[
                            styles.moveChip,
                            whiteIndex === activeIndex - 1 ? styles.moveChipLast : '',
                          ].join(' ')}
                          onClick={() => { setCurrentMoveIndex(whiteIndex + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        >
                          {whiteMove.san}
                        </span>
                        {blackMove ? (
                          <span
                            className={[
                              styles.moveChip,
                              blackIndex === activeIndex - 1 ? styles.moveChipLast : '',
                            ].join(' ')}
                            onClick={() => { setCurrentMoveIndex(blackIndex + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          >
                            {blackMove.san}
                          </span>
                        ) : (
                          <span className={styles.moveChipEmpty}></span>
                        )}
                      </div>
                    );
                  })
              }
            </div>
          </div>
        </div>

        {/* ── Drawer Trigger & Overlay for Focus Mode ── */}
        {isFocusMode && (
          <>
            <button className={styles.drawerTrigger} onClick={() => setDrawerOpen(!drawerOpen)}>
              <Users size={16} />
              <span className={styles.drawerTriggerText}>{drawerOpen ? 'Hide Info' : 'Show Info'}</span>
            </button>
            {drawerOpen && (
              <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} />
            )}
          </>
        )}

        {/* ── Side panel ── */}
        <div className={isFocusMode ? [styles.sidePanelDrawer, drawerOpen ? styles.drawerOpen : ''].join(' ') : styles.sidePanel}>
          <div className={styles.tabs}>
            <button className={[styles.tab, tab === 'participants' ? styles.tabActive : ''].join(' ')}
              onClick={() => setTab('participants')}>
              <Users size={13} /> Players ({participants.length})
            </button>
            <button className={[styles.tab, tab === 'chat' ? styles.tabActive : ''].join(' ')}
              onClick={() => setTab('chat')}>
              <MessageSquare size={13} /> Chat
              {chatMessages.length > 0 && (
                <span className={styles.chatBadge}>{chatMessages.length > 9 ? '9+' : chatMessages.length}</span>
              )}
            </button>
          </div>

          {tab === 'participants' && (
            <div className={styles.participantList}>
              <div className={styles.sectionLbl}><Crown size={11} /> Coach</div>
              {classroomData?.host && (
                <div className={[styles.pRow, styles.hostRow].join(' ')}>
                  <div className={styles.pAvatar} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    {(classroomData.host.firstName?.[0] || classroomData.host.username?.[0] || 'C').toUpperCase()}
                  </div>
                  <div className={styles.pInfo}>
                    <div className={styles.pName}>
                      {classroomData.host.firstName
                        ? `${classroomData.host.firstName} ${classroomData.host.lastName || ''}`.trim()
                        : classroomData.host.username}
                      {classroomData.host._id === myId && <span className={styles.youTag}>You</span>}
                    </div>
                    <div className={styles.pBadges}>
                      <Badge variant="yellow" size="sm"><Crown size={9} /> Coach</Badge>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.sectionLbl} style={{ marginTop: 8 }}>
                <GraduationCap size={11} /> In Room ({participants.length})
              </div>
              {participants.length === 0 && (
                <div className={styles.noParticipants}>No students in room yet</div>
              )}
              {participants.map((p, i) => {
                const uid = (p.userId?._id || p.userId)?.toString()
                return (
                  <ParticipantRow
                    key={uid || i}
                    p={p} isAdmin={isAdmin} myId={myId}
                    onToggleBoard={toggleBoard} onToggleMute={toggleMute}
                    isSpeaking={speakingUsers.includes(uid)}
                    isInVoice={voiceParticipants.includes(uid)}
                  />
                )
              })}

              {isAdmin && classroomData?.invitedStudents?.length > 0 && (() => {
                const notJoined = classroomData.invitedStudents.filter(
                  (s) => !participants.some((p) => (p.userId?._id || p.userId)?.toString() === s._id?.toString())
                )
                if (!notJoined.length) return null
                return (
                  <>
                    <div className={styles.sectionLbl} style={{ marginTop: 8 }}>
                      Invited — not joined ({notJoined.length})
                    </div>
                    {notJoined.map((s) => (
                      <div key={s._id} className={[styles.pRow, styles.pRowInactive].join(' ')}>
                        <div className={styles.pAvatar} style={{ background: '#444' }}>
                          {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                        </div>
                        <div className={styles.pInfo}>
                          <div className={styles.pName}>
                            {s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : s.username}
                          </div>
                          <div className={styles.pBadges}>
                            <Badge variant="default" size="sm">Not joined</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )
              })()}
            </div>
          )}

          {tab === 'chat' && (
            <ChatPanel messages={chatMessages} onSend={sendChat} myId={myId} />
          )}
        </div>
      </div>

      {/* ── Voice bar ── */}
      <VoiceBar
        isInVoice={voice.isInVoice}
        isMuted={voice.isMuted}
        isJoining={voice.isJoining}
        onJoin={voice.joinVoice}
        onLeave={voice.leaveVoice}
        onToggleMute={voice.toggleMute}
        participants={participants}
        myId={myId}
        onRightSide={true}
      />
    </div>
  )
}
