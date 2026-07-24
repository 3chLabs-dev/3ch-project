import { useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

function getSocketUrl(token: string | null, guestToken?: string | null) {
  const apiUrl = new URL(API, window.location.origin);
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  else if (guestToken) params.set("guestToken", guestToken);
  return `${protocol}//${apiUrl.host}/ws/support-chat?${params.toString()}`;
}

export function useSupportChatSocket(
  token: string | null,
  enabled: boolean,
  onUpdate: (event: { roomId: number; type: "message" | "status" }) => void,
  guestToken?: string | null,
) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if ((!token && !guestToken) || !enabled) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let stopped = false;

    const connect = () => {
      socket = new WebSocket(getSocketUrl(token, guestToken));
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data);
          if (event.event === "support_chat_updated") onUpdateRef.current(event);
        } catch {
          // Ignore malformed socket events and keep the connection alive.
        }
      };
      socket.onclose = () => {
        if (!stopped) reconnectTimer = window.setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [enabled, guestToken, token]);
}
