import { io } from 'socket.io-client'

let socket = null

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('accessToken')
    socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    })
  }
  return socket
}

export const connectSocket = () => {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect()
    socket = null
  }
}
