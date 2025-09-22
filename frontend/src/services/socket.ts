import { io, Socket } from 'socket.io-client';
import { ImportProgress } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private progressCallbacks = new Set<(progress: ImportProgress) => void>();

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

  joinSession(sessionId: string) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token available');
      return;
    }

    // Join the session room for progress updates
    this.socket.emit('join-session', { sessionId, token });

    this.socket.once('joined-session', ({ sessionId: joinedSessionId }) => {
      console.log('Joined session room:', joinedSessionId);
    });
  }

  onProgressUpdate(callback: (progress: ImportProgress) => void) {
    this.progressCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
export default socketService;