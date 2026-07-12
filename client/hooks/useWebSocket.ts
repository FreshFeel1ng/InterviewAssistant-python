import { useEffect, useRef, useCallback, useState } from 'react';

interface WSMessage {
  type: string;
  payload: unknown;
}

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  onOpen?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onError,
    onClose,
    onOpen,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const [isConnected, setIsConnected] = useState(false);

  // 用 ref 存储回调，避免 useCallback 依赖变化导致重连
  const callbacksRef = useRef({ onMessage, onError, onClose, onOpen });
  callbacksRef.current = { onMessage, onError, onClose, onOpen };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] 已连接');
        setIsConnected(true);
        reconnectCount.current = 0;
        callbacksRef.current.onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          callbacksRef.current.onMessage?.(message);
        } catch (err) {
          console.error('[WS] 消息解析失败:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] 连接错误, readyState:', ws.readyState);
        callbacksRef.current.onError?.(error);
      };

      ws.onclose = (event) => {
        console.log('[WS] 连接关闭, code:', event.code, 'wasClean:', event.wasClean);
        setIsConnected(false);
        callbacksRef.current.onClose?.();

        // 只在组件仍挂载且非主动关闭时重连
        if (mountedRef.current && reconnectCount.current < maxReconnectAttempts) {
          reconnectTimer.current = setTimeout(() => {
            reconnectCount.current++;
            console.log(`[WS] 尝试重连 (${reconnectCount.current}/${maxReconnectAttempts})`);
            connect();
          }, reconnectInterval);
        }
      };
    } catch (err) {
      console.error('[WS] 创建连接失败:', err);
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] 连接未就绪，无法发送消息');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return {
    sendMessage,
    isConnected,
    reconnect: connect,
  };
}
