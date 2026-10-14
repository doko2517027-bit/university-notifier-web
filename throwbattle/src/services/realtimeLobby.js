export const THROB_REALTIME_URL = 'wss://caremate-throb-pilot.onrender.com/realtime';
const RESUME_STORAGE_KEY = 'throb:realtime:resume:v1';

export class RealtimeLobbyClient {
  constructor({ tokenProvider, onMessage = () => {}, onStatus = () => {}, socketFactory = (url) => new WebSocket(url),
    url = THROB_REALTIME_URL, storage = typeof sessionStorage === 'undefined' ? null : sessionStorage,
    retryDelayMs = 1000, graceMs = 60_000 }) {
    this.tokenProvider = tokenProvider;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.socketFactory = socketFactory;
    this.url = url;
    this.storage = storage;
    this.retryDelayMs = retryDelayMs;
    this.graceMs = graceMs;
    this.nextRetryDelay = retryDelayMs;
    this.retryDeadline = 0;
    this.retryTimer = null;
    this.manualClose = false;
    this.socket = null;
    this.connected = false;
    this.connecting = null;
  }

  readResumeToken() {
    try { return this.storage?.getItem(RESUME_STORAGE_KEY) || null; }
    catch { return null; }
  }

  saveResumeToken(token) {
    try {
      if (typeof token === 'string') this.storage?.setItem(RESUME_STORAGE_KEY, token);
      else this.storage?.removeItem(RESUME_STORAGE_KEY);
    } catch { /* Private browsing may deny storage. */ }
  }

  scheduleReconnect() {
    if (this.manualClose || this.connected || this.retryTimer) return;
    if (Date.now() >= this.retryDeadline) { this.retryDeadline = 0; this.onStatus('disconnected'); return; }
    this.onStatus('reconnecting');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect({ retry: true }).catch(() => this.scheduleReconnect());
    }, this.nextRetryDelay);
    this.nextRetryDelay = Math.min(5000, Math.round(this.nextRetryDelay * 1.7));
  }

  connect({ retry = false } = {}) {
    if (this.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.manualClose = false;
    this.onStatus(retry ? 'reconnecting' : 'connecting');
    this.connecting = new Promise((resolve, reject) => {
      const socket = this.socketFactory(this.url);
      this.socket = socket;
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('connection-timeout')); socket.close(); }
      }, 90_000);
      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };
      socket.addEventListener('open', async () => {
        try {
          const token = await this.tokenProvider();
          if (socket !== this.socket || socket.readyState !== 1) throw new Error('connection-closed');
          socket.send(JSON.stringify({ type: 'authenticate', token, resumeToken: this.readResumeToken() }));
        } catch (error) { fail(error); socket.close(); }
      });
      socket.addEventListener('message', (event) => {
        let message;
        try { message = JSON.parse(event.data); }
        catch { return; }
        if (message.type === 'authenticated' && !settled) {
          settled = true;
          clearTimeout(timeout);
          this.connected = true;
          this.retryDeadline = 0;
          this.nextRetryDelay = this.retryDelayMs;
          this.saveResumeToken(message.resumeToken);
          this.onStatus('connected');
          resolve();
        }
        this.onMessage(message);
      });
      socket.addEventListener('close', () => {
        if (socket !== this.socket) return;
        const wasConnected = this.connected;
        this.connected = false;
        this.socket = null;
        fail(new Error('connection-closed'));
        if (!this.manualClose && (wasConnected || this.retryDeadline)) {
          if (!this.retryDeadline) this.retryDeadline = Date.now() + this.graceMs;
          this.scheduleReconnect();
        } else this.onStatus('disconnected');
      });
      socket.addEventListener('error', () => fail(new Error('connection-error')));
    }).finally(() => { this.connecting = null; });
    return this.connecting;
  }

  send(type, payload = {}) {
    if (!this.connected || this.socket?.readyState !== 1) return false;
    this.socket.send(JSON.stringify({ type, ...payload }));
    return true;
  }

  disconnect() {
    this.manualClose = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retryDeadline = 0;
    this.saveResumeToken(null);
    this.connected = false;
    this.socket?.close(1000, 'client-exit');
    this.socket = null;
    this.onStatus('disconnected');
  }
}
