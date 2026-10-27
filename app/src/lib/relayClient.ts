import { AppState } from 'react-native';
import type { ClientEvent, ServerEvent } from '../types/relay';

type Handler = (event: ServerEvent) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
// The relay pings every 30s and drops a client that misses 2 pongs (~60-90s).
// If NOTHING (not even a ping) has arrived for this long, the connection is
// dead even though the OS still reports the socket as open — typical after the
// phone sleeps or switches network. Tear it down and reconnect.
const STALE_AFTER_MS = 75_000;
const WATCHDOG_INTERVAL_MS = 15_000;
// A socket that never reaches OPEN (RN has no connect timeout of its own).
const CONNECT_TIMEOUT_MS = 12_000;
// After returning to the foreground we probe the connection with a ping; if
// no frame arrives within this window it is treated as dead.
const FOREGROUND_PROBE_MS = 5_000;

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
  // Which account the current socket belongs to, so connect() can tell a
  // harmless token refresh (same account) from an account switch.
  private userId: string | null = null;
  // Fetches a CURRENT access token (refreshing it if expired). The token
  // captured at connect() time is only good for ~1h; reconnects after that
  // must not reuse it.
  private tokenProvider: (() => Promise<string | null>) | null = null;
  private lastFrameAt = 0;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
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

  constructor() {
    // Returning to the foreground is when a connection is most likely to
    // have silently died (iOS suspends sockets; Android may kill them).
    AppState.addEventListener('change', (state) => {
      if (state === 'active') this.onForeground();
    });
  }

  // Lets the owner of the auth session supply a fresh token on demand (see
  // authStore.ts) — used for every (re)connect instead of the stale token
  // passed to connect().
  setTokenProvider(provider: (() => Promise<string | null>) | null) {
    this.tokenProvider = provider;
  }

  // Public entry point — call with the current auth token to start (or keep)
  // the connection. Safe to call repeatedly: it is invoked on every auth
  // state change, including hourly token refreshes, and must NOT open a
  // second socket each time.
  connect(token: string, userId?: string) {
    this.manuallyClosed = false;
    this.token = token;
    const sameAccount = !userId || !this.userId || userId === this.userId;
    if (userId) this.userId = userId;

    const live = this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING);
    if (live && sameAccount) return; // token refresh / duplicate call: keep the existing socket
    this.openSocket(); // new account, or nothing live: (re)open — openSocket closes any old socket first
  }

  // Opens one WebSocket attempt and wires its lifecycle handlers. Any
  // previous socket is detached and closed FIRST: leaving it alive meant two
  // sockets delivering the same events (duplicate messages) and its late
  // 'close' event clobbering the new socket's state.
  private openSocket() {
    const url = process.env.EXPO_PUBLIC_RELAY_WS_URL;
    if (!url) {
      // eslint-disable-next-line no-console
      console.warn('[relay] EXPO_PUBLIC_RELAY_WS_URL is not set — see .env.example');
      return;
    }
    this.clearReconnectTimer();
    this.discardSocket();

    // eslint-disable-next-line no-console
    console.log('[relay] connecting to', url, '(attempt', this.reconnectAttempt, ')');
    this.setStatus('connecting');
    const socket = new WebSocket(url);
    this.socket = socket;
    this.lastFrameAt = Date.now();
    this.startWatchdog();

    // Never reaches OPEN (bad network, captive portal): give up on it and retry.
    this.connectTimer = setTimeout(() => {
      if (this.socket === socket && socket.readyState !== WebSocket.OPEN) {
        // eslint-disable-next-line no-console
        console.warn('[relay] connect timed out');
        this.reconnectNow(false);
      }
    }, CONNECT_TIMEOUT_MS);

    // Every handler below ignores events from a socket that is no longer the
    // current one (identity check against this.socket).
    socket.onopen = () => {
      if (this.socket !== socket) return;
      if (this.connectTimer) clearTimeout(this.connectTimer);
      this.connectTimer = null;
      // eslint-disable-next-line no-console
      console.log('[relay] socket open — sending auth');
      this.sendAuth(socket);
    };
    socket.onmessage = (e) => {
      if (this.socket !== socket) return;
      this.lastFrameAt = Date.now();
      try {
        const event: ServerEvent = JSON.parse(e.data);
        if (event.type === 'auth:ok') {
          // eslint-disable-next-line no-console
          console.log('[relay] authenticated as', event.userId);
          // Only now is the connection really good: resetting the backoff at
          // socket-open instead meant a server that accepts the socket but
          // rejects the login was retried every second forever.
          this.reconnectAttempt = 0;
          this.setStatus('connected');
        }
        if (event.type === 'auth:error') {
          // eslint-disable-next-line no-console
          console.warn('[relay] auth rejected by server:', event.message);
        }
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
    socket.onerror = (e) => {
      if (this.socket !== socket) return;
      // React Native's WebSocket error event carries a `message` field
      // (not a standard browser ErrorEvent) — logged so a connection
      // failure (bad URL, unreachable host, TLS issue) is actually visible
      // instead of silently leaving status stuck at 'connecting'/'error'
      // with zero trace anywhere.
      // eslint-disable-next-line no-console
      console.warn('[relay] socket error:', (e as any)?.message ?? e);
      this.setStatus('error');
    };
    socket.onclose = (e) => {
      if (this.socket !== socket) return; // a replaced/discarded socket closing late — not our business
      // eslint-disable-next-line no-console
      console.log('[relay] socket closed — code:', e.code, 'reason:', e.reason || '(none)', 'manuallyClosed:', this.manuallyClosed);
      this.socket = null;
      if (this.connectTimer) clearTimeout(this.connectTimer);
      this.connectTimer = null;
      if (this.manuallyClosed) {
        this.setStatus('idle');
        return;
      }
      this.scheduleReconnect(false);
    };
  }

  // Sends the auth event with a CURRENT token (refreshed if expired) rather
  // than the one captured when connect() was first called.
  private async sendAuth(socket: WebSocket) {
    let token = this.token;
    if (this.tokenProvider) {
      try {
        token = (await this.tokenProvider()) ?? token;
      } catch {
        // fall back to the last known token
      }
    }
    if (this.socket !== socket || socket.readyState !== WebSocket.OPEN) return; // replaced/closed while fetching
    if (token) this.rawSend({ type: 'auth', token });
  }

  // Detaches and closes the current socket without triggering reconnect logic.
  private discardSocket() {
    const old = this.socket;
    this.socket = null;
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
    if (!old) return;
    old.onopen = old.onmessage = old.onerror = old.onclose = null;
    try {
      old.close();
    } catch {
      // already dead
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  // Schedules the next attempt with exponential backoff (or right away).
  private scheduleReconnect(immediate: boolean) {
    if (this.manuallyClosed) return;
    this.setStatus('reconnecting');
    if (this.reconnectTimer && !immediate) return; // one pending attempt is enough
    this.clearReconnectTimer();
    const delay = immediate ? 0 : Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
    if (!immediate) this.reconnectAttempt += 1;
    // eslint-disable-next-line no-console
    console.log('[relay] reconnecting in', delay, 'ms');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  // Throws the current socket away and reconnects (used when it is
  // known/suspected dead although the OS never reported a close).
  private reconnectNow(immediate: boolean) {
    if (this.manuallyClosed || !this.token) return;
    this.discardSocket();
    this.scheduleReconnect(immediate);
  }

  // Dead-connection watchdog: the relay pings every 30s, so a live
  // connection always has recent inbound traffic. Silence beyond
  // STALE_AFTER_MS means the connection is dead even though readyState
  // still says OPEN.
  private startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => {
      if (this.manuallyClosed || !this.socket) return;
      if (this._status === 'connected' && Date.now() - this.lastFrameAt > STALE_AFTER_MS) {
        // eslint-disable-next-line no-console
        console.warn('[relay] no traffic for', Math.round((Date.now() - this.lastFrameAt) / 1000), 's — connection is dead, reconnecting');
        this.reconnectNow(true);
      }
    }, WATCHDOG_INTERVAL_MS);
  }

  // App came back to the foreground: reconnect at once if we are not
  // connected, otherwise probe the connection with a ping and reconnect if
  // nothing comes back.
  private onForeground() {
    if (this.manuallyClosed || !this.token) return;
    const open = this.socket && this.socket.readyState === WebSocket.OPEN;
    if (!open && this.socket?.readyState !== WebSocket.CONNECTING) {
      this.reconnectAttempt = 0;
      this.reconnectNow(true);
      return;
    }
    if (open && this._status === 'connected') {
      const sentAt = Date.now();
      this.rawSend({ type: 'ping' });
      if (this.probeTimer) clearTimeout(this.probeTimer);
      this.probeTimer = setTimeout(() => {
        this.probeTimer = null;
        if (this.lastFrameAt < sentAt && !this.manuallyClosed) {
          // eslint-disable-next-line no-console
          console.warn('[relay] no reply after returning to foreground — reconnecting');
          this.reconnectNow(true);
        }
      }, FOREGROUND_PROBE_MS);
    }
  }

  // Intentional close (e.g. sign-out) — suppresses the auto-reconnect that
  // would otherwise fire from onclose.
  disconnect() {
    this.manuallyClosed = true;
    this.token = null;
    this.userId = null;
    this.clearReconnectTimer();
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = null;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.discardSocket();
    this.setStatus('idle');
  }

  // Public send. Returns whether the event was actually handed to an open
  // socket — callers that need delivery feedback (e.g. marking a message
  // failed instead of leaving it on "sending" forever) can check it.
  send(event: ClientEvent): boolean {
    // 'connected' means authenticated (auth:ok received). An event sent
    // earlier would just be rejected by the relay ("Not authenticated").
    if (this._status !== 'connected') return false;
    return this.rawSend(event);
  }

  // Returns false (and sends nothing) if the socket isn't open.
  private rawSend(event: ClientEvent): boolean {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
      return true;
    }
    return false;
  }

  // Subscribes to every incoming server event; returns an unsubscribe fn.
  on(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export const relayClient = new RelayClient();
