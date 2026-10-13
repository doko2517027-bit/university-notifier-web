export const THROB_REALTIME_URL = 'wss://caremate-throb-pilot.onrender.com/realtime';

export class RealtimeLobbyClient {
  constructor({ tokenProvider, onMessage = () => {}, onStatus = () => {}, socketFactory = (url) => new WebSocket(url), url = THROB_REALTIME_URL }) {
    this.tokenProvider = tokenProvider;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.socketFactory = socketFactory;
    this.url = url;
    this.socket = null;
    this.connected = false;
    this.connecting = null;
  }

  connect() {
    if (this.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.onStatus('connecting');
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
          socket.send(JSON.stringify({ type: 'authenticate', token }));
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
          this.onStatus('connected');
          resolve();
        }
        this.onMessage(message);
      });
      socket.addEventListener('close', () => {
        this.connected = false;
        if (socket === this.socket) this.socket = null;
        this.onStatus('disconnected');
        fail(new Error('connection-closed'));
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
    this.connected = false;
    this.socket?.close();
    this.socket = null;
  }
}
