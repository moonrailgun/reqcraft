import { create } from 'zustand';

interface ServiceWebSocketStore {
  connected: boolean;
  connect: (onReload: () => void) => void;
  disconnect: () => void;
  _socket: WebSocket | null;
  _reconnectTimer: ReturnType<typeof setTimeout> | null;
}

export const useServiceWSStore = create<ServiceWebSocketStore>((set, get) => ({
  connected: false,
  _socket: null,
  _reconnectTimer: null,

  connect: (onReload: () => void) => {
    const state = get();
    if (state._socket) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    function doConnect() {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        set({ connected: true, _socket: ws });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'reload') {
            console.log('[reqcraft] Config changed, reloading data...');
            onReload();
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        set({ connected: false, _socket: null });
        const timer = setTimeout(doConnect, 3000);
        set({ _reconnectTimer: timer });
      };

      ws.onerror = () => {
        set({ connected: false });
      };
    }

    doConnect();
  },

  disconnect: () => {
    const { _socket, _reconnectTimer } = get();
    if (_reconnectTimer) clearTimeout(_reconnectTimer);
    _socket?.close();
    set({ connected: false, _socket: null, _reconnectTimer: null });
  },
}));
