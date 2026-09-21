import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure window.fetch is writable and cannot throw 'Cannot set property fetch of #<Window> which has only a getter'
if (typeof window !== 'undefined') {
  try {
    let currentFetch = window.fetch ? window.fetch.bind(window) : undefined;
    const desc =
      Object.getOwnPropertyDescriptor(window, 'fetch') ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');
    if (!desc || !desc.set || !desc.writable) {
      Object.defineProperty(window, 'fetch', {
        get() {
          return currentFetch;
        },
        set(fn) {
          currentFetch = typeof fn === 'function' ? fn.bind(window) : fn;
        },
        configurable: true,
        enumerable: true,
      });
    }
  } catch (_) {}

  try {
    const NativeWebSocket = window.WebSocket;
    (window as any).WebSocket = function (url: string | URL, protocols?: string | string[]) {
      const urlStr = url.toString();
      if (urlStr.includes('/api/hoorvia/live-ws') || urlStr.includes('/api/live-ws')) {
        console.log(`[HOORVIA_WS_CREATED] Path: ${urlStr.split('?')[0]}`);
        const ws = new NativeWebSocket(url, protocols);
        ws.addEventListener('open', () => console.log('[HOORVIA_WS_OPEN]'));
        ws.addEventListener('close', (e) => console.log(`[HOORVIA_WS_CLOSE] code=${e.code} reason=${e.reason}`));
        return ws;
      } else if (urlStr.includes('vite') || urlStr.includes('hmr') || !urlStr.includes('/api/')) {
        console.log(`[VITE_WS_CREATED] Path: ${urlStr.split('?')[0]}`);
        const ws = new NativeWebSocket(url, protocols);
        ws.addEventListener('open', () => console.log('[VITE_WS_OPEN]'));
        ws.addEventListener('close', (e) => console.log(`[VITE_WS_CLOSE] code=${e.code} reason=${e.reason}`));
        return ws;
      }
      return new NativeWebSocket(url, protocols);
    } as any;
    Object.assign((window as any).WebSocket, NativeWebSocket);
  } catch (_) {}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
