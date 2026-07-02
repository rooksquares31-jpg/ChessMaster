const { Server }  = require('socket.io');
const jwt         = require('jsonwebtoken');
const Classroom   = require('../models/Classroom');
const User        = require('../models/User');

/**
 * Attach Socket.io to the HTTP server.
 * Every socket must authenticate with a valid JWT token on handshake.
 *
 * Events emitted by server:
 *   room:state         — full classroom snapshot sent on join
 *   participants:update — participant list changed
 *   board:move         — piece moved on the board
 *   board:reset        — board reset to starting position
 *   board:fen          — board set to custom FEN
 *   permission:update  — admin toggled a student's board permission / mute
 *   session:started    — admin started the live session
 *   session:ended      — admin ended the session
 *   chat:message       — in-room chat message
 *   error              — something went wrong
 */
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim()).filter(Boolean)
  : ['http://localhost:5173'];

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
  });

  /* ── Auth middleware ── */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password -refreshToken');
      if (!user) return next(new Error('User not found'));
      if (user.status === 'inactive') return next(new Error('Account deactivated'));

      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  /* ── Connection ── */
  io.on('connection', (socket) => {
    const { user } = socket;
    const isAdmin  = user.role === 'admin';

    console.log(`🔌 Socket connected: ${user.username} (${user.role})`);

    /* ── JOIN ROOM ── */
    socket.on('room:join', async ({ classroomId }) => {
      try {
        const classroom = await Classroom.findById(classroomId)
          .populate('host', 'username firstName lastName')
          .populate('invitedStudents', '_id username firstName lastName')
          .populate('activeParticipants.userId', 'username firstName lastName');

        if (!classroom) return socket.emit('error', { message: 'Classroom not found' });

        // Authorization
        const isHost = classroom.host._id.toString() === user._id.toString();
        const invited = classroom.invitedStudents.some(
          (s) => s._id.toString() === user._id.toString()
        );
        if (!isHost && !invited)
          return socket.emit('error', { message: 'Not authorized to join this room' });

        socket.join(classroomId);
        socket.currentRoom = classroomId;

        // Upsert participant record
        const existing = classroom.activeParticipants.find(
          (p) => p.userId?._id?.toString() === user._id.toString()
        );
        if (!existing) {
          classroom.activeParticipants.push({
            userId:         user._id,
            socketId:       socket.id,
            canControlBoard: isHost,
          });
        } else {
          existing.socketId = socket.id;
        }
        await classroom.save();

        // Send full state to the joining client
        socket.emit('room:state', {
          classroom: {
            _id:         classroom._id,
            title:       classroom.title,
            code:        classroom.code,
            status:      classroom.status,
            boardFen:    classroom.boardFen,
            moveHistory: classroom.moveHistory.slice(-50),
            host:        classroom.host,
            invitedStudents: classroom.invitedStudents,
          },
          participants:    classroom.activeParticipants,
          myPermissions: {
            canControlBoard: isHost || (existing?.canControlBoard ?? false),
          },
        });

        // Notify everyone else
        io.to(classroomId).emit('participants:update', {
          participants: classroom.activeParticipants,
        });

        console.log(`➡️  ${user.username} joined room ${classroom.code}`);
      } catch (err) {
        console.error('room:join error', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /* ── PIECE DRAG TRACKING (broadcast only, no DB write) ── */
    // Fired continuously while admin drags — students see the piece moving in real-time
    socket.on('board:dragUpdate', ({ classroomId, from, square }) => {
      // Broadcast to everyone EXCEPT the sender (they already see it)
      socket.to(classroomId).emit('board:dragUpdate', {
        from,
        square,
        movedBy: user._id,
      });
    });

    /* ── SQUARE SELECT / CLICK HIGHLIGHT (broadcast only, no DB write) ── */
    // Fired when admin clicks a piece to select it
    socket.on('board:select', ({ classroomId, square }) => {
      socket.to(classroomId).emit('board:select', { square, movedBy: user._id });
    });

    /* ── DRAG CANCEL (piece dropped back / escaped) ── */
    socket.on('board:dragCancel', ({ classroomId }) => {
      socket.to(classroomId).emit('board:dragCancel');
    });

    /* ── BOARD MOVE ── */
    socket.on('board:move', async ({ classroomId, from, to, san, fen }) => {
      try {
        const classroom = await Classroom.findById(classroomId);
        if (!classroom) return;

        const isHost = classroom.host.toString() === user._id.toString();
        const participant = classroom.activeParticipants.find(
          (p) => p.userId?.toString() === user._id.toString()
        );
        if (!isHost && !participant?.canControlBoard) {
          return socket.emit('error', { message: 'You do not have board control' });
        }

        // Persist
        classroom.boardFen = fen;
        classroom.moveHistory.push({ from, to, san, fen, movedBy: user._id });
        await classroom.save();

        // Broadcast to all in room (including sender so they get confirmation)
        io.to(classroomId).emit('board:move', { from, to, san, fen, movedBy: user._id });
      } catch (err) {
        socket.emit('error', { message: 'Move failed' });
      }
    });

    /* ── BOARD RESET (admin only) ── */
    socket.on('board:reset', async ({ classroomId }) => {
      try {
        const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        await Classroom.findByIdAndUpdate(classroomId, {
          boardFen: startFen,
          $set: { moveHistory: [] },
        });
        io.to(classroomId).emit('board:reset', { fen: startFen });
      } catch {
        socket.emit('error', { message: 'Reset failed' });
      }
    });

    /* ── SET CUSTOM FEN (admin only) ── */
    socket.on('board:setFen', async ({ classroomId, fen }) => {
      try {
        await Classroom.findByIdAndUpdate(classroomId, { boardFen: fen });
        io.to(classroomId).emit('board:fen', { fen });
      } catch {
        socket.emit('error', { message: 'Failed to set FEN' });
      }
    });

    /* ── GRANT/REVOKE BOARD CONTROL (admin only) ── */
    socket.on('permission:board', async ({ classroomId, targetUserId, grant }) => {
      try {
        const classroom = await Classroom.findById(classroomId);
        if (!classroom) return;
        if (classroom.host.toString() !== user._id.toString()) return;

        const participant = classroom.activeParticipants.find(
          (p) => p.userId?.toString() === targetUserId
        );
        if (participant) {
          participant.canControlBoard = grant;
          await classroom.save();
        }

        io.to(classroomId).emit('permission:update', {
          userId: targetUserId,
          canControlBoard: grant,
        });
      } catch {
        socket.emit('error', { message: 'Permission update failed' });
      }
    });

    /* ── MUTE / UNMUTE (admin only) ── */
    socket.on('permission:mute', async ({ classroomId, targetUserId, mute }) => {
      try {
        const classroom = await Classroom.findById(classroomId);
        if (!classroom || classroom.host.toString() !== user._id.toString()) return;

        const participant = classroom.activeParticipants.find(
          (p) => p.userId?.toString() === targetUserId
        );
        if (participant) {
          participant.isMuted = mute;
          await classroom.save();
        }

        io.to(classroomId).emit('permission:update', {
          userId: targetUserId,
          isMuted: mute,
        });

        // Also tell the target user's client to force-mute/unmute their mic track
        if (mute) {
          const targetParticipant = classroom.activeParticipants.find(
            (p) => p.userId?.toString() === targetUserId
          );
          if (targetParticipant?.socketId) {
            io.to(targetParticipant.socketId).emit('voice:force-mute', { muted: true });
          }
        }
      } catch {
        socket.emit('error', { message: 'Mute update failed' });
      }
    });

    /* ══════════════════════════════════════════════════════════════
       WebRTC Voice Signaling
       The server only RELAYS signaling messages between peers.
       No audio data flows through the server.
    ══════════════════════════════════════════════════════════════ */

    /* ── VOICE READY — user is ready to receive WebRTC connections ── */
    socket.on('voice:ready', ({ classroomId }) => {
      socket.to(classroomId).emit('voice:ready', {
        userId:   user._id.toString(),
        socketId: socket.id,
        name:     user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username,
      });
    });

    /* ── VOICE OFFER — relay SDP offer to a specific peer ── */
    socket.on('voice:offer', ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit('voice:offer', {
        offer,
        fromUserId:   user._id.toString(),
        fromSocketId: socket.id,
        fromName:     user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username,
      });
    });

    /* ── VOICE ANSWER — relay SDP answer to a specific peer ── */
    socket.on('voice:answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('voice:answer', {
        answer,
        fromUserId:   user._id.toString(),
        fromSocketId: socket.id,
      });
    });

    /* ── VOICE ICE CANDIDATE — relay ICE candidate to a specific peer ── */
    socket.on('voice:ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('voice:ice-candidate', {
        candidate,
        fromUserId:   user._id.toString(),
        fromSocketId: socket.id,
      });
    });

    /* ── VOICE LEAVE — user left voice chat ── */
    socket.on('voice:leave', ({ classroomId }) => {
      socket.to(classroomId).emit('voice:leave', {
        userId:   user._id.toString(),
        socketId: socket.id,
      });
    });

    /* ── START SESSION (admin only) ── */
    socket.on('session:start', async ({ classroomId }) => {
      try {
        await Classroom.findByIdAndUpdate(classroomId, {
          status: 'live',
          startedAt: new Date(),
        });
        io.to(classroomId).emit('session:started', { startedAt: new Date() });
      } catch {
        socket.emit('error', { message: 'Could not start session' });
      }
    });

    /* ── END SESSION (admin only) ── */
    socket.on('session:end', async ({ classroomId }) => {
      try {
        await Classroom.findByIdAndUpdate(classroomId, {
          status: 'ended',
          endedAt: new Date(),
          $set: { activeParticipants: [] },
        });
        io.to(classroomId).emit('session:ended');
      } catch {
        socket.emit('error', { message: 'Could not end session' });
      }
    });

    /* ── CHAT MESSAGE ── */
    socket.on('chat:send', ({ classroomId, message }) => {
      if (!message?.trim()) return;
      io.to(classroomId).emit('chat:message', {
        userId:   user._id,
        username: user.username,
        name:     user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.username,
        role:     user.role,
        message:  message.trim().slice(0, 500),
        timestamp: new Date().toISOString(),
      });
    });

    /* ── DISCONNECT ── */
    socket.on('disconnect', async () => {
      console.log(`🔌 Disconnected: ${user.username}`);
      if (!socket.currentRoom) return;
      try {
        await Classroom.findByIdAndUpdate(socket.currentRoom, {
          $pull: { activeParticipants: { socketId: socket.id } },
        });
        const updated = await Classroom.findById(socket.currentRoom);
        if (updated) {
          io.to(socket.currentRoom).emit('participants:update', {
            participants: updated.activeParticipants,
          });
        }
      } catch {}
    });
  });

  return io;
};

module.exports = initSocket;
