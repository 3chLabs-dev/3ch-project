import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { useSupportChatSocket } from "../../hooks/useSupportChatSocket";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Room = {
  id: number;
  status: "open" | "closed";
  user_name: string | null;
  user_email: string;
  last_message: string | null;
  last_sender_type: "user" | "admin" | null;
  last_message_at: string;
};

type Message = {
  id: number;
  sender_type: "user" | "admin";
  content: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminSupportChatPage() {
  const token = localStorage.getItem("admin_token") ?? "";
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selected, setSelected] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadRooms = useCallback(async () => {
    const response = await fetch(`${API}/admin/support-chat/rooms`, { headers });
    if (!response.ok) throw new Error("채팅방 목록을 불러오지 못했습니다.");
    const data = await response.json();
    setRooms(data.rooms ?? []);
    setSelected((current) => {
      if (!current) return data.rooms?.[0] ?? null;
      return data.rooms?.find((room: Room) => room.id === current.id) ?? current;
    });
  }, [headers]);

  const loadMessages = useCallback(async (roomId: number) => {
    const response = await fetch(`${API}/admin/support-chat/rooms/${roomId}`, { headers });
    if (!response.ok) throw new Error("메시지를 불러오지 못했습니다.");
    const data = await response.json();
    setMessages(data.messages ?? []);
  }, [headers]);

  const refresh = useCallback(async () => {
    try {
      await loadRooms();
      if (selected) await loadMessages(selected.id);
      setError("");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "잠시 후 다시 시도해 주세요.");
    }
  }, [loadMessages, loadRooms, selected]);

  useEffect(() => {
    setLoading(true);
    loadRooms().catch(() => setError("채팅방 목록을 불러오지 못했습니다.")).finally(() => setLoading(false));
  }, [loadRooms]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    loadMessages(selected.id).catch(() => setError("메시지를 불러오지 못했습니다."));
  }, [loadMessages, selected]);

  useSupportChatSocket(token, true, refresh);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const response = await fetch(`${API}/admin/support-chat/rooms/${selected.id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: reply.trim() }),
      });
      if (!response.ok) throw new Error("답변 전송에 실패했습니다.");
      setReply("");
      await refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "답변 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async () => {
    if (!selected) return;
    const status = selected.status === "open" ? "closed" : "open";
    const response = await fetch(`${API}/admin/support-chat/rooms/${selected.id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });
    if (response.ok) await refresh();
  };

  return (
    <Box sx={{ height: "calc(100vh - 116px)", minHeight: 560, display: "flex", overflow: "hidden" }}>
      <Box sx={{ width: 300, borderRight: "1px solid #E5E7EB", overflowY: "auto", flexShrink: 0 }}>
        <Box sx={{ px: 2.5, py: 2.2, borderBottom: "1px solid #E5E7EB" }}>
          <Typography fontSize={18} fontWeight={900}>채팅 상담</Typography>
          <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.4 }}>최근 메시지 순으로 표시됩니다.</Typography>
        </Box>
        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress size={26} /></Box>
        ) : rooms.length === 0 ? (
          <Typography textAlign="center" color="text.secondary" fontSize={13} sx={{ py: 7 }}>진행 중인 채팅이 없습니다.</Typography>
        ) : rooms.map((room) => (
          <Box
            key={room.id}
            onClick={() => setSelected(room)}
            sx={{
              px: 2.2,
              py: 1.7,
              cursor: "pointer",
              borderBottom: "1px solid #F1F5F9",
              bgcolor: selected?.id === room.id ? "#FDF2F8" : "#fff",
              "&:hover": { bgcolor: selected?.id === room.id ? "#FDF2F8" : "#F8FAFC" },
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography fontSize={13} fontWeight={800} noWrap sx={{ flex: 1 }}>
                {room.user_name || room.user_email}
              </Typography>
              <Chip
                size="small"
                label={room.status === "open" ? "상담 중" : "종료"}
                sx={{
                  height: 19,
                  fontSize: 10,
                  fontWeight: 800,
                  bgcolor: room.status === "open" ? "#DCFCE7" : "#F1F5F9",
                  color: room.status === "open" ? "#15803D" : "#64748B",
                }}
              />
            </Stack>
            <Typography fontSize={12} color="text.secondary" noWrap>
              {room.last_sender_type === "admin" ? "상담팀: " : ""}{room.last_message || "메시지가 없습니다."}
            </Typography>
            <Typography fontSize={10} color="text.disabled" sx={{ mt: 0.5 }}>{formatDate(room.last_message_at)}</Typography>
          </Box>
        ))}
      </Box>

      <Stack sx={{ flex: 1, minWidth: 0, bgcolor: "#F8FAFC" }}>
        {!selected ? (
          <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}>
            <Typography color="text.secondary" fontSize={14}>상담할 채팅방을 선택해 주세요.</Typography>
          </Box>
        ) : (
          <>
            <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.6, bgcolor: "#fff", borderBottom: "1px solid #E5E7EB" }}>
              <Box sx={{ flex: 1 }}>
                <Typography fontSize={15} fontWeight={900}>{selected.user_name || selected.user_email}</Typography>
                <Typography fontSize={11} color="text.secondary">{selected.user_email}</Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={changeStatus} sx={{ fontSize: 11, fontWeight: 800 }}>
                {selected.status === "open" ? "상담 종료" : "상담 다시 열기"}
              </Button>
            </Stack>

            <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
              <Stack spacing={1.5}>
                {messages.map((message) => {
                  const isAdmin = message.sender_type === "admin";
                  return (
                    <Box key={message.id} sx={{ alignSelf: isAdmin ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                      <Box
                        sx={{
                          px: 1.7,
                          py: 1.2,
                          bgcolor: isAdmin ? "#EC4899" : "#fff",
                          color: isAdmin ? "#fff" : "text.primary",
                          borderRadius: isAdmin ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                          boxShadow: isAdmin ? "none" : "0 2px 8px rgba(15,23,42,0.06)",
                        }}
                      >
                        <Typography fontSize={13} lineHeight={1.65} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.content}</Typography>
                      </Box>
                      <Typography fontSize={10} color="text.disabled" textAlign={isAdmin ? "right" : "left"} sx={{ mt: 0.4 }}>
                        {formatDate(message.created_at)}
                      </Typography>
                    </Box>
                  );
                })}
                <div ref={messagesEndRef} />
              </Stack>
            </Box>

            <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ p: 1.5, bgcolor: "#fff", borderTop: "1px solid #E5E7EB" }}>
              <TextField
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendReply();
                  }
                }}
                multiline
                maxRows={4}
                fullWidth
                size="small"
                placeholder="답변을 입력해 주세요"
                inputProps={{ maxLength: 2000 }}
              />
              <IconButton
                onClick={sendReply}
                disabled={!reply.trim() || sending}
                sx={{ bgcolor: "#EC4899", color: "#fff", "&:hover": { bgcolor: "#DB2777" }, "&.Mui-disabled": { bgcolor: "#E5E7EB" } }}
              >
                {sending ? <CircularProgress size={19} color="inherit" /> : <SendRoundedIcon />}
              </IconButton>
            </Stack>
          </>
        )}
        {error && <Typography color="error" fontSize={12} textAlign="center" sx={{ bgcolor: "#fff", pb: 1 }}>{error}</Typography>}
      </Stack>
    </Box>
  );
}
