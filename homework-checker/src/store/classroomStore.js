import { create } from 'zustand'

export const useClassroomStore = create((set) => ({
  classroom:      null,
  participants:   [],
  boardFen:       'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  initialFen:     'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moveHistory:    [],
  myPermissions:  { canControlBoard: false },
  myUserId:       null,
  chatMessages:   [],
  sessionStatus:  'waiting',
  lastMove:       null,

  // Live cursor / drag state broadcast from the mover
  selectedSquare: null,   // square admin just clicked to select a piece
  dragFrom:       null,   // source square of an in-progress drag
  dragOver:       null,   // square the dragged piece is currently hovering over

  // Voice chat state
  voiceParticipants: [],  // array of userId strings in voice chat
  speakingUsers:     [],  // array of userId strings currently speaking

  setRoomState: (data, myUserId) => {
    const myParticipant = data.participants?.find(
      (p) => (p.userId?._id || p.userId)?.toString() === myUserId?.toString()
    )
    set({
      classroom:      data.classroom,
      participants:   data.participants,
      initialFen:     data.classroom.boardFen,
      boardFen:       data.classroom.boardFen,
      moveHistory:    data.classroom.moveHistory || [],
      myPermissions:  myParticipant
        ? { canControlBoard: myParticipant.canControlBoard }
        : data.myPermissions,
      myUserId,
      sessionStatus:  data.classroom.status,
    })
  },

  updateParticipants: (list, myUserId) => {
    const me = list.find(
      (p) => (p.userId?._id || p.userId)?.toString() === myUserId?.toString()
    )
    set((s) => ({
      participants:  list,
      myPermissions: me ? { canControlBoard: me.canControlBoard } : s.myPermissions,
    }))
  },

  applyMove: ({ from, to, san, fen }) =>
    set((s) => ({
      boardFen:       fen,
      lastMove:       { from, to },
      moveHistory:    [...s.moveHistory, { from, to, san, fen }],
      selectedSquare: null,
      dragFrom:       null,
      dragOver:       null,
    })),

  resetBoard: (fen) => set({
    initialFen: fen, boardFen: fen, moveHistory: [], lastMove: null,
    selectedSquare: null, dragFrom: null, dragOver: null,
  }),

  setFen: (fen) => set({
    initialFen: fen, boardFen: fen, selectedSquare: null, dragFrom: null, dragOver: null,
    moveHistory: [], lastMove: null,
  }),

  // Called when admin selects a piece (click)
  setSelectedSquare: (square) => set({ selectedSquare: square, dragFrom: null, dragOver: null }),

  // Called during drag — from = origin, square = current hover
  setDragState: (from, square) => set({ dragFrom: from, dragOver: square, selectedSquare: null }),

  clearDrag: () => set({ dragFrom: null, dragOver: null, selectedSquare: null }),

  updatePermission: ({ userId, canControlBoard, isMuted }, myUserId) =>
    set((s) => {
      const isMe = userId?.toString() === myUserId?.toString()
      return {
        participants: s.participants.map((p) => {
          const pid = (p.userId?._id || p.userId)?.toString()
          if (pid !== userId?.toString()) return p
          return {
            ...p,
            ...(canControlBoard !== undefined && { canControlBoard }),
            ...(isMuted          !== undefined && { isMuted }),
          }
        }),
        myPermissions: isMe && canControlBoard !== undefined
          ? { ...s.myPermissions, canControlBoard }
          : s.myPermissions,
      }
    }),

  setMyPermission: (perms) =>
    set((s) => ({ myPermissions: { ...s.myPermissions, ...perms } })),

  addChat: (msg) =>
    set((s) => ({ chatMessages: [...s.chatMessages.slice(-199), msg] })),

  setSessionStatus: (status) => set({ sessionStatus: status }),

  // Voice chat actions
  addVoiceParticipant: (userId) =>
    set((s) => ({
      voiceParticipants: s.voiceParticipants.includes(userId)
        ? s.voiceParticipants
        : [...s.voiceParticipants, userId],
    })),

  removeVoiceParticipant: (userId) =>
    set((s) => ({
      voiceParticipants: s.voiceParticipants.filter((id) => id !== userId),
      speakingUsers:     s.speakingUsers.filter((id) => id !== userId),
    })),

  setSpeaking: (userId, isSpeaking) =>
    set((s) => ({
      speakingUsers: isSpeaking
        ? (s.speakingUsers.includes(userId) ? s.speakingUsers : [...s.speakingUsers, userId])
        : s.speakingUsers.filter((id) => id !== userId),
    })),

  clearVoiceState: () => set({ voiceParticipants: [], speakingUsers: [] }),

  reset: () => set({
    classroom: null, participants: [], chatMessages: [],
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    boardFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moveHistory: [], myPermissions: { canControlBoard: false },
    myUserId: null, sessionStatus: 'waiting', lastMove: null,
    selectedSquare: null, dragFrom: null, dragOver: null,
    voiceParticipants: [], speakingUsers: [],
  }),
}))

