import type { ClientEvent, ServerEvent } from '../types/relay';

type Handler = (event: ServerEvent) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

/**
 * Thin WebSocket client for the relay server. Reconnects with backoff and
 * re-authenticates automatically. Nothing here ever touches disk — messages
 * exist only as in-flight JS objects on their way to/from the socket.
 */
class RelayClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private token: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private statusHandlers = new Set<(status: ConnectionStatus) => void>();
  private _status: ConnectionStatus = 'idle';

  get status() {
    return this._status;
  }

  private setStatus(s: ConnectionStatus) {
    this._status = s;
    this.statusHandlers.forEach((h) => h(s));
  }

  onStatus(handler: (status: ConnectionStatus) => void) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  connect(token: string) {
    this.manuallyClosed = false;
    this.token = token;
    this.openSocket();
  }

  private openSocket() {
    const url = process.env.EXPO_PUBLIC_RELAY_WS_URL;
    if (!url) {
      // eslint-disable-next-line no-console
      console.warn('[relay] EXPO_PUBLIC_RELAY_WS_URL is not set — see .env.example');
      return;
    }
    this.setStatus('connecting');
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      if (this.token) this.rawSend({ type: 'auth', token: this.token });
    };
    socket.onmessage = (e) => {
      try {
        const event: ServerEvent = JSON.parse(e.data);
        if (event.type === 'auth:ok') this.setStatus('connected');
        this.handlers.forEach((h) => h(event));
      } catch {
        // ignore malformed frames
      }
    };
    socket.onerror = () => {
      this.setStatus('error');
    };
    socket.onclose = () => {
      this.socket = null;
      if (this.manuallyClosed) {
        this.setStatus('idle');
        return;
      }
      this.setStatus('reconnecting');
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
    };
  }

  disconnect() {
    this.manuallyClosed = true;
    this.token = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.setStatus('idle');
  }

  send(event: ClientEvent) {
    this.rawSend(event);
  }

  private rawSend(event: ClientEvent) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    }
  }

  on(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export const relayClient = new RelayClient();
