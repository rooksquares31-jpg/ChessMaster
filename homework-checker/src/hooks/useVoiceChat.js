import { useRef, useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useClassroomStore } from '../store/classroomStore'

/* ══════════════════════════════════════════════════════════════
   useVoiceChat — WebRTC peer-to-peer voice hook (robust)

   Key design decisions:
   1. Socket listeners are registered inside joinVoice() — NOT in
      useEffect — guaranteeing the socket is connected and listeners
      are attached BEFORE we emit voice:ready.
   2. All handler logic lives in a ref that's updated every render,
      so stable wrapper functions can be registered once on the socket
      without stale closures.
   3. ICE candidates that arrive before setRemoteDescription are
      buffered and flushed once the remote description is set.
══════════════════════════════════════════════════════════════ */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const SPEAKING_THRESHOLD = 15
const SPEAKING_CHECK_INTERVAL = 150

export default function useVoiceChat(socketRef, classroomId, myId) {
  const [isInVoice, setIsInVoice] = useState(false)
  const [isMuted, setIsMuted]     = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [peerCount, setPeerCount] = useState(0)

  const localStreamRef       = useRef(null)
  const peersRef             = useRef(new Map()) // Map<socketId, { pc, userId, name, remoteDescSet }>
  const audioElementsRef     = useRef(new Map()) // Map<socketId, HTMLAudioElement>
  const analyserMapRef       = useRef(new Map()) // Map<userId, { source, intervalId }>
  const localAnalyserRef     = useRef(null)
  const audioContextRef      = useRef(null)
  const iceCandidateBuffer   = useRef(new Map()) // Map<socketId, RTCIceCandidate[]>
  const listenersAttachedRef = useRef(false)
  const stableHandlersRef    = useRef(null) // stable wrapper functions
  const implRef              = useRef({})   // always-fresh implementation logic

  const {
    addVoiceParticipant,
    removeVoiceParticipant,
    setSpeaking,
    clearVoiceState,
  } = useClassroomStore()

  /* ── AudioContext helper ── */
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  /* ── Speaking detection for a remote stream ── */
  const startSpeakingDetection = useCallback((userId, stream) => {
    try {
      const ctx = getAudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const intervalId = setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setSpeaking(userId, avg > SPEAKING_THRESHOLD)
      }, SPEAKING_CHECK_INTERVAL)
      analyserMapRef.current.set(userId, { source, intervalId })
    } catch (err) {
      console.warn('Speaking detection setup failed:', err)
    }
  }, [getAudioContext, setSpeaking])

  /* ── Speaking detection for local stream ── */
  const startLocalSpeakingDetection = useCallback((stream) => {
    try {
      const ctx = getAudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const intervalId = setInterval(() => {
        const track = localStreamRef.current?.getAudioTracks()[0]
        if (track?.enabled) {
          analyser.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setSpeaking(myId, avg > SPEAKING_THRESHOLD)
        } else {
          setSpeaking(myId, false)
        }
      }, SPEAKING_CHECK_INTERVAL)
      localAnalyserRef.current = { source, intervalId }
    } catch (err) {
      console.warn('Local speaking detection failed:', err)
    }
  }, [getAudioContext, setSpeaking, myId])

  /* ── Stop speaking detection ── */
  const stopSpeakingDetection = useCallback((userId) => {
    const entry = analyserMapRef.current.get(userId)
    if (entry) {
      clearInterval(entry.intervalId)
      try { entry.source.disconnect() } catch {}
      analyserMapRef.current.delete(userId)
    }
    setSpeaking(userId, false)
  }, [setSpeaking])

  /* ── Update peer count state ── */
  const syncPeerCount = useCallback(() => {
    setPeerCount(peersRef.current.size)
  }, [])

  /* ── Create a peer connection to another user ── */
  const createPeerConnection = useCallback((peerSocketId, peerUserId, peerName) => {
    // If connection already exists, return it
    const existing = peersRef.current.get(peerSocketId)
    if (existing) return existing.pc

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add our local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    // Relay ICE candidates to the remote peer via socket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('voice:ice-candidate', {
          targetSocketId: peerSocketId,
          candidate: event.candidate,
        })
      }
    }

    // Play incoming remote audio
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0]
      if (!remoteStream) return

      let audio = audioElementsRef.current.get(peerSocketId)
      if (!audio) {
        audio = new Audio()
        audio.autoplay = true
        audio.playsInline = true
        audioElementsRef.current.set(peerSocketId, audio)
      }
      audio.srcObject = remoteStream
      // Force play (some browsers need this)
      audio.play().catch(() => {})

      startSpeakingDetection(peerUserId, remoteStream)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        console.warn(`Voice connection to ${peerName} failed, removing peer`)
        implRef.current.removePeer?.(peerSocketId)
      }
    }

    peersRef.current.set(peerSocketId, {
      pc, userId: peerUserId, name: peerName, remoteDescSet: false,
    })
    addVoiceParticipant(peerUserId)
    syncPeerCount()

    return pc
  }, [socketRef, addVoiceParticipant, startSpeakingDetection, syncPeerCount])

  /* ── Remove a peer connection and clean up ── */
  const removePeer = useCallback((peerSocketId) => {
    const peer = peersRef.current.get(peerSocketId)
    if (peer) {
      peer.pc.close()
      stopSpeakingDetection(peer.userId)
      removeVoiceParticipant(peer.userId)
      peersRef.current.delete(peerSocketId)
    }
    const audio = audioElementsRef.current.get(peerSocketId)
    if (audio) {
      audio.srcObject = null
      audioElementsRef.current.delete(peerSocketId)
    }
    iceCandidateBuffer.current.delete(peerSocketId)
    syncPeerCount()
  }, [stopSpeakingDetection, removeVoiceParticipant, syncPeerCount])

  /* ── Flush buffered ICE candidates once remote description is set ── */
  const flushIceCandidates = useCallback(async (peerSocketId, pc) => {
    const buffered = iceCandidateBuffer.current.get(peerSocketId) || []
    for (const candidate of buffered) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.warn('Failed to add buffered ICE candidate:', err)
      }
    }
    iceCandidateBuffer.current.delete(peerSocketId)
  }, [])

  /* ════════════════════════════════════════════════════════════
     Keep implementation ref always fresh — updated every render.
     Stable wrapper functions (created once) delegate to this ref,
     so socket listeners never go stale.
  ════════════════════════════════════════════════════════════ */
  implRef.current = {
    createPeerConnection,
    removePeer,
    flushIceCandidates,
    setSpeaking,
    myId,

    onVoiceReady: async ({ userId, socketId, name }) => {
      if (!localStreamRef.current) return
      try {
        const pc = createPeerConnection(socketId, userId, name)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketRef.current?.emit('voice:offer', {
          targetSocketId: socketId,
          offer: pc.localDescription,
        })
      } catch (err) {
        console.error('Voice: failed to create offer:', err)
      }
    },

    onVoiceOffer: async ({ offer, fromUserId, fromSocketId, fromName }) => {
      if (!localStreamRef.current) return
      try {
        const pc = createPeerConnection(fromSocketId, fromUserId, fromName)
        await pc.setRemoteDescription(new RTCSessionDescription(offer))

        // Mark remote desc set and flush buffered ICE candidates
        const peer = peersRef.current.get(fromSocketId)
        if (peer) peer.remoteDescSet = true
        await flushIceCandidates(fromSocketId, pc)

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socketRef.current?.emit('voice:answer', {
          targetSocketId: fromSocketId,
          answer: pc.localDescription,
        })
      } catch (err) {
        console.error('Voice: failed to handle offer:', err)
      }
    },

    onVoiceAnswer: async ({ answer, fromSocketId }) => {
      const peer = peersRef.current.get(fromSocketId)
      if (!peer) return
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer))
        peer.remoteDescSet = true
        await flushIceCandidates(fromSocketId, peer.pc)
      } catch (err) {
        console.error('Voice: failed to set answer:', err)
      }
    },

    onIceCandidate: async ({ candidate, fromSocketId }) => {
      const peer = peersRef.current.get(fromSocketId)

      // Buffer if peer doesn't exist yet or remote desc not set
      if (!peer || !peer.remoteDescSet) {
        const buf = iceCandidateBuffer.current.get(fromSocketId) || []
        buf.push(candidate)
        iceCandidateBuffer.current.set(fromSocketId, buf)
        return
      }

      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.warn('Voice: failed to add ICE candidate:', err)
      }
    },

    onVoiceLeave: ({ socketId }) => {
      removePeer(socketId)
    },

    onForceMute: ({ muted }) => {
      if (!localStreamRef.current) return
      const track = localStreamRef.current.getAudioTracks()[0]
      if (track && muted) {
        track.enabled = false
        setIsMuted(true)
        setSpeaking(myId, false)
        toast('🔇 You were muted by the coach', { icon: '🔇' })
      }
    },
  }

  /* ── Create stable wrapper functions ONCE ── */
  if (!stableHandlersRef.current) {
    stableHandlersRef.current = {
      onVoiceReady:    (data) => implRef.current.onVoiceReady(data),
      onVoiceOffer:    (data) => implRef.current.onVoiceOffer(data),
      onVoiceAnswer:   (data) => implRef.current.onVoiceAnswer(data),
      onIceCandidate:  (data) => implRef.current.onIceCandidate(data),
      onVoiceLeave:    (data) => implRef.current.onVoiceLeave(data),
      onForceMute:     (data) => implRef.current.onForceMute(data),
    }
  }

  /* ── Register socket listeners ── */
  const attachListeners = useCallback(() => {
    const socket = socketRef.current
    if (!socket || listenersAttachedRef.current) return

    const h = stableHandlersRef.current
    socket.on('voice:ready',         h.onVoiceReady)
    socket.on('voice:offer',         h.onVoiceOffer)
    socket.on('voice:answer',        h.onVoiceAnswer)
    socket.on('voice:ice-candidate', h.onIceCandidate)
    socket.on('voice:leave',         h.onVoiceLeave)
    socket.on('voice:force-mute',    h.onForceMute)

    listenersAttachedRef.current = true
    console.log('🎙️ Voice listeners attached')
  }, [socketRef])

  /* ── Unregister socket listeners ── */
  const detachListeners = useCallback(() => {
    const socket = socketRef.current
    if (!socket || !listenersAttachedRef.current) return

    const h = stableHandlersRef.current
    socket.off('voice:ready',         h.onVoiceReady)
    socket.off('voice:offer',         h.onVoiceOffer)
    socket.off('voice:answer',        h.onVoiceAnswer)
    socket.off('voice:ice-candidate', h.onIceCandidate)
    socket.off('voice:leave',         h.onVoiceLeave)
    socket.off('voice:force-mute',    h.onForceMute)

    listenersAttachedRef.current = false
    console.log('🎙️ Voice listeners detached')
  }, [socketRef])

  /* ════════════════════════════════════════════════════════════
     JOIN VOICE
     1. Get microphone stream
     2. Attach socket listeners (BEFORE announcing)
     3. Emit voice:ready so existing peers connect to us
  ════════════════════════════════════════════════════════════ */
  const joinVoice = useCallback(async () => {
    if (localStreamRef.current || isJoining) return
    setIsJoining(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })

      localStreamRef.current = stream
      setIsMuted(false)
      setIsInVoice(true)
      addVoiceParticipant(myId)
      startLocalSpeakingDetection(stream)

      // CRITICAL: attach listeners BEFORE emitting voice:ready
      // so we can receive offers from peers who respond immediately
      attachListeners()

      // Now announce to all peers in the room
      socketRef.current?.emit('voice:ready', { classroomId })

      toast.success('🎤 Joined voice chat')
    } catch (err) {
      console.error('Failed to access microphone:', err)
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone in browser settings.')
      } else if (err.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone.')
      } else {
        toast.error('Failed to join voice chat')
      }
    } finally {
      setIsJoining(false)
    }
  }, [isJoining, classroomId, myId, socketRef, addVoiceParticipant, startLocalSpeakingDetection, attachListeners])

  /* ════════════════════════════════════════════════════════════
     LEAVE VOICE
     Clean up everything: stream, peers, audio, analysers, listeners
  ════════════════════════════════════════════════════════════ */
  const leaveVoice = useCallback(() => {
    // Stop local mic stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }

    // Stop local speaking detection
    if (localAnalyserRef.current) {
      clearInterval(localAnalyserRef.current.intervalId)
      try { localAnalyserRef.current.source.disconnect() } catch {}
      localAnalyserRef.current = null
    }
    setSpeaking(myId, false)

    // Close all peer connections
    for (const [sid] of peersRef.current) {
      removePeer(sid)
    }
    peersRef.current.clear()

    // Clean up any remaining audio elements
    for (const [, audio] of audioElementsRef.current) {
      audio.srcObject = null
    }
    audioElementsRef.current.clear()

    // Clean up analysers
    for (const [, entry] of analyserMapRef.current) {
      clearInterval(entry.intervalId)
      try { entry.source.disconnect() } catch {}
    }
    analyserMapRef.current.clear()

    // Clear ICE buffer
    iceCandidateBuffer.current.clear()

    // Remove self from voice participants
    removeVoiceParticipant(myId)

    // Notify room
    socketRef.current?.emit('voice:leave', { classroomId })

    // Detach socket listeners
    detachListeners()

    setIsInVoice(false)
    setIsMuted(false)
    setPeerCount(0)

    toast('🔇 Left voice chat')
  }, [classroomId, myId, socketRef, removeVoiceParticipant, removePeer, setSpeaking, detachListeners])

  /* ── Toggle mute ── */
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return

    const audioTrack = localStreamRef.current.getAudioTracks()[0]
    if (!audioTrack) return

    const newEnabled = !audioTrack.enabled
    audioTrack.enabled = newEnabled
    setIsMuted(!newEnabled)

    if (!newEnabled) {
      setSpeaking(myId, false)
    }
  }, [myId, setSpeaking])

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
      }
      // Stop local analyser
      if (localAnalyserRef.current) {
        clearInterval(localAnalyserRef.current.intervalId)
        try { localAnalyserRef.current.source.disconnect() } catch {}
        localAnalyserRef.current = null
      }
      // Close all peer connections
      for (const [, peer] of peersRef.current) {
        peer.pc.close()
      }
      peersRef.current.clear()
      // Clean up audio elements
      for (const [, audio] of audioElementsRef.current) {
        audio.srcObject = null
      }
      audioElementsRef.current.clear()
      // Clean up analysers
      for (const [, entry] of analyserMapRef.current) {
        clearInterval(entry.intervalId)
        try { entry.source.disconnect() } catch {}
      }
      analyserMapRef.current.clear()
      // Clear ICE buffer
      iceCandidateBuffer.current.clear()
      // Close AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }
      // Detach socket listeners
      const socket = socketRef.current
      if (socket && listenersAttachedRef.current && stableHandlersRef.current) {
        const h = stableHandlersRef.current
        socket.off('voice:ready',         h.onVoiceReady)
        socket.off('voice:offer',         h.onVoiceOffer)
        socket.off('voice:answer',        h.onVoiceAnswer)
        socket.off('voice:ice-candidate', h.onIceCandidate)
        socket.off('voice:leave',         h.onVoiceLeave)
        socket.off('voice:force-mute',    h.onForceMute)
      }
      // Clear store state
      clearVoiceState()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isInVoice,
    isMuted,
    isJoining,
    peerCount,
    joinVoice,
    leaveVoice,
    toggleMute,
  }
}
