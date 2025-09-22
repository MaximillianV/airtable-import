import { io, Socket } from 'socket.io-client';
import { ImportProgress } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private progressCallbacks = new Map<string, (progress: ImportProgress) => void>();

  connect() {
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
    
    this.socket = io(socketUrl, {
      withCredentials: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });

    this.socket.on('import-progress', (data: ImportProgress) => {
      // Call all registered progress callbacks
      this.progressCallbacks.forEach(callback => {
        callback(data);
      });
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.progressCallbacks.clear();
  }

  subscribeToProgress(sessionId: string, callback: (progress: ImportProgress) => void) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token available');
      return;
    }

    // Register callback
    this.progressCallbacks.set(sessionId, callback);

    // Subscribe to progress updates for this session
    this.socket.emit('subscribe-progress', { sessionId, token });

    this.socket.once('subscribed', ({ sessionId: subscribedSessionId }) => {
      console.log('Subscribed to progress updates for session:', subscribedSessionId);
    });
  }

  unsubscribeFromProgress(sessionId: string) {
    this.progressCallbacks.delete(sessionId);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
export default socketService;