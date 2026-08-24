import type { ClientEvent, ServerEvent } from '../types/relay';

type Handler = (event: ServerEvent) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

/**
 * FILE PURPOSE / class doc: Thin WebSocket client for the relay server.
 * Reconnects with backoff and re-authenticates automatically. Nothing here
 * ever touches disk — messages exist only as in-flight JS objects on their
 * way to/from the socket. Consumed by chatStore.ts/callStore.ts/etc. via
 * the single `relayClient` instance exported below.
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

  // Public entry point — call once with a fresh auth token to (re)start
  // the connection lifecycle.
  connect(token: string) {
    this.manuallyClosed = false;
    this.token = token;
    this.openSocket();
  }

  // Opens one WebSocket attempt and wires its lifecycle handlers,
  // including the reconnect-with-backoff scheduling on close.
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
        // Server-initiated heartbeat — reply immediately so the relay
        // knows this connection is still alive. A plain JSON app message,
        // not a native WebSocket protocol-level pong control frame — see
        // the matching comment in server/src/index.ts for why.
        if (event.type === 'ping') {
          this.rawSend({ type: 'pong' });
          return;
        }
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

  // Intentional close (e.g. sign-out) — suppresses the auto-reconnect that
  // would otherwise fire from onclose.
  disconnect() {
    this.manuallyClosed = true;
    this.token = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.setStatus('idle');
  }

  // Public send — currently just forwards to rawSend, kept as its own
  // method so call sites depend on a stable public API distinct from the
  // internal auth/pong sends in openSocket above.
  send(event: ClientEvent) {
    this.rawSend(event);
  }

  // Silently drops the event if the socket isn't open — callers don't need
  // to track connection state themselves before sending.
  private rawSend(event: ClientEvent) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    }
  }

  // Subscribes to every incoming server event; returns an unsubscribe fn.
  on(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export const relayClient = new RelayClient();
