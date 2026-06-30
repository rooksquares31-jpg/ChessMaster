import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { useClassroomStore } from '../../store/classroomStore'
import styles from './VoiceBar.module.css'

/* ══════════════════════════════════════════════════════════════
   VoiceBar — Google Meet-style floating audio control bar
══════════════════════════════════════════════════════════════ */
export default function VoiceBar({
  isInVoice,
  isMuted,
  isJoining,
  onJoin,
  onLeave,
  onToggleMute,
  participants,
  myId,
  onRightSide = false,
}) {
  const { voiceParticipants, speakingUsers } = useClassroomStore()

  // Build display list of voice participants
  const voicePeers = participants.filter((p) => {
    const uid = (p.userId?._id || p.userId)?.toString()
    return voiceParticipants.includes(uid) && uid !== myId
  })

  const isMeSpeaking = speakingUsers.includes(myId)

  /* ── Not in voice — show just the join button ── */
  if (!isInVoice) {
    return (
      <div className={`${styles.voiceBarIdle} ${onRightSide ? styles.voiceBarRight : ''}`}>
        <button
          className={`${styles.voiceJoinBtn} ${styles.joinBtn}`}
          onClick={onJoin}
          disabled={isJoining}
          id="voice-join-btn"
        >
          {isJoining ? (
            <>
              <div className={styles.spinner} />
              Connecting…
            </>
          ) : (
            <>
              <Phone size={15} />
              Join Voice
            </>
          )}
        </button>
      </div>
    )
  }

  /* ── In voice — show full control bar ── */
  return (
    <div className={`${styles.voiceBar} ${onRightSide ? styles.voiceBarRight : ''}`}>
      {/* Voice status */}
      <div className={styles.voiceInfo}>
        <div className={styles.voiceStatusDot} />
        <span className={styles.voiceStatusText}>
          In voice
          {voicePeers.length > 0 && (
            <> · <span className={styles.peersCount}>{voicePeers.length}</span> {voicePeers.length === 1 ? 'peer' : 'peers'}</>
          )}
        </span>
      </div>

      {/* Speaking avatars */}
      {voicePeers.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.speakingAvatars}>
            {voicePeers.slice(0, 5).map((p) => {
              const uid = (p.userId?._id || p.userId)?.toString()
              const name = p.userId?.firstName
                ? `${p.userId.firstName} ${p.userId.lastName || ''}`.trim()
                : p.userId?.username || '?'
              const isSpeaking = speakingUsers.includes(uid)
              return (
                <div
                  key={uid}
                  className={`${styles.speakingAvatar} ${isSpeaking ? styles.speakingAvatarSpeaking : ''}`}
                  title={`${name}${isSpeaking ? ' (speaking)' : ''}`}
                >
                  {(name[0] || '?').toUpperCase()}
                </div>
              )
            })}
            {voicePeers.length > 5 && (
              <div className={styles.speakingAvatar} title={`+${voicePeers.length - 5} more`}>
                +{voicePeers.length - 5}
              </div>
            )}
          </div>
        </>
      )}

      <div className={styles.divider} />

      {/* Mute/Unmute button */}
      <button
        className={`${styles.muteBtn} ${isMuted ? styles.muteBtnActive : ''} ${!isMuted && isMeSpeaking ? styles.muteBtnSpeaking : ''}`}
        onClick={onToggleMute}
        title={isMuted ? 'Unmute (click to speak)' : 'Mute'}
        id="voice-mute-btn"
      >
        {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
      </button>

      {/* Leave voice button */}
      <button
        className={`${styles.voiceJoinBtn} ${styles.leaveBtn}`}
        onClick={onLeave}
        id="voice-leave-btn"
      >
        <PhoneOff size={15} />
        Leave
      </button>
    </div>
  )
}
