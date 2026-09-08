import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import { useLocation } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { useSupportChatSocket } from "../hooks/useSupportChatSocket";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const GUEST_TOKEN_STORAGE_KEY = "support_chat_guest_token";

type ChatRoom = {
  id: number;
  status: "open" | "closed";
};

type ChatMessage = {
  id: number;
  sender_type: "user" | "admin";
  content: string;
  created_at: string;
};

function formatTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SupportChat() {
  const location = useLocation();
  const token = useAppSelector((state) => state.auth.token);
  const [guestToken, setGuestToken] = useState(
    () => localStorage.getItem(GUEST_TOKEN_STORAGE_KEY) ?? "",
  );
  const [open, setOpen] = useState(false);
  const [buttonExpanded, setButtonExpanded] = useState(false);
  const [hasFloatingAction, setHasFloatingAction] = useState(false);
  const [message, setMessage] = useState("");
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/support-chat`, {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : guestToken
            ? { "X-Support-Guest-Token": guestToken }
            : {},
      });
      if (!response.ok) throw new Error("채팅 내역을 불러오지 못했습니다.");
      const data = await response.json();
      if (!token && data.guestToken) {
        localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, data.guestToken);
        setGuestToken(data.guestToken);
      }
      setRoom(data.room);
      setItems(data.messages ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [guestToken, token]);

  useEffect(() => {
    if (open) loadMessages();
  }, [loadMessages, open]);

  useSupportChatSocket(token, open, loadMessages, token ? null : guestToken);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("open-support-chat", openChat);
    return () => window.removeEventListener("open-support-chat", openChat);
  }, []);

  useEffect(() => {
    setButtonExpanded(false);
  }, [location.pathname]);

  useEffect(() => {
    const updateFloatingAction = () => {
      setHasFloatingAction(Boolean(document.querySelector('[data-support-chat-offset="floating-action"]')));
    };
    updateFloatingAction();
    const observer = new MutationObserver(updateFloatingAction);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    if (!buttonExpanded || open) return;
    const timeoutId = window.setTimeout(() => setButtonExpanded(false), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [buttonExpanded, open]);

  useEffect(() => {
    if (!loading) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, loading]);

  const sendMessage = async () => {
    const content = message.trim();
    if (!content) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`${API}/support-chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : guestToken
              ? { "X-Support-Guest-Token": guestToken }
              : {}),
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("문의 전송에 실패했습니다.");
      const data = await response.json();
      if (!token && data.guestToken) {
        localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, data.guestToken);
        setGuestToken(data.guestToken);
      }
      setMessage("");
      await loadMessages();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  if (location.pathname === "/mypage/inquiry") return null;
  const isProgramMatchOrder = location.pathname.endsWith("/program/matches");
  const isLeagueCreationPage = location.pathname === "/league/new"
    || location.pathname === "/league/renewal";
  const isLeagueDetail = !isLeagueCreationPage && /^\/league\/[^/]+\/?$/.test(location.pathname);
  const isClubFloatingActionPage = location.pathname === "/club/create"
    || /^\/club\/[^/]+(?:\/manage)?\/?$/.test(location.pathname);

  return (
    <>
      <Button
        aria-label={buttonExpanded ? "채팅 문의 열기" : "채팅 문의 버튼 펼치기"}
        onClick={() => {
          if (!buttonExpanded) {
            setButtonExpanded(true);
            return;
          }
          setOpen(true);
        }}
        sx={{
          position: "absolute",
          zIndex: 21,
          left: 14,
          bottom: isProgramMatchOrder
            ? "calc(132px + env(safe-area-inset-bottom))"
            : isLeagueDetail || isClubFloatingActionPage || hasFloatingAction
              ? "calc(124px + env(safe-area-inset-bottom))"
              : "calc(68px + env(safe-area-inset-bottom))",
          minWidth: 0,
          width: buttonExpanded ? 112 : 52,
          height: 52,
          px: buttonExpanded ? 1.2 : 0,
          borderRadius: 999,
          bgcolor: "#5B6472",
          color: "#fff",
          boxShadow: "0 6px 18px rgba(55, 65, 81, 0.24)",
          border: "2px solid rgba(255,255,255,0.9)",
          overflow: "hidden",
          transition: "width 180ms ease, padding 180ms ease, background-color 180ms ease",
          "&:hover": { bgcolor: "#424B57" },
        }}
      >
        <SupportAgentRoundedIcon sx={{ fontSize: 28 }} />
        {buttonExpanded && (
          <Typography sx={{ ml: 0.5, mr: 0.3, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
            채팅 문의
          </Typography>
        )}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth={false}
        PaperProps={{
          sx: {
            m: 0,
            width: "min(430px, 100%)",
            maxWidth: "none",
            height: "min(680px, calc(100dvh - 72px))",
            maxHeight: "calc(100dvh - 72px)",
            position: "fixed",
            bottom: 0,
            borderRadius: "22px 22px 0 0",
            overflow: "hidden",
          },
        }}
      >
        <Stack sx={{ height: "100%", bgcolor: "#F8FAFC" }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.2}
            sx={{ px: 2, py: 1.6, bgcolor: "#fff", borderBottom: "1px solid #E5E7EB" }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "#E5E7EB",
                display: "grid",
                placeItems: "center",
              }}
            >
              <SupportAgentRoundedIcon sx={{ color: "#5B6472", fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontSize={16} fontWeight={900}>우리리그 채팅 문의</Typography>
              <Typography fontSize={11} color="text.secondary" fontWeight={600}>
                보통 영업일 기준 1~2일 이내 답변드려요
              </Typography>
            </Box>
            <IconButton aria-label="닫기" onClick={() => setOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>

          <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 2 }}>
            <Stack spacing={1.4}>
              <Box sx={{ alignSelf: "flex-start", maxWidth: "82%" }}>
                <Box sx={{ bgcolor: "#fff", borderRadius: "4px 16px 16px 16px", px: 1.6, py: 1.2, boxShadow: "0 2px 8px rgba(15,23,42,0.06)" }}>
                  <Typography fontSize={13} lineHeight={1.6} sx={{ whiteSpace: "pre-line" }}>
                    {"안녕하세요!\n궁금한 점을 남겨주시면 확인 후 답변드리겠습니다.😊"}
                  </Typography>
                </Box>
              </Box>

              {loading ? (
                <Box sx={{ display: "grid", placeItems: "center", py: 5 }}>
                  <CircularProgress size={28} sx={{ color: "#EC4899" }} />
                </Box>
              ) : (
                items.map((item) => {
                  const isUser = item.sender_type === "user";
                  return (
                    <Box key={item.id} sx={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                      <Box
                        sx={{
                          bgcolor: isUser ? "#EC4899" : "#fff",
                          color: isUser ? "#fff" : "text.primary",
                          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                          px: 1.6,
                          py: 1.2,
                          boxShadow: isUser ? "none" : "0 2px 8px rgba(15,23,42,0.06)",
                        }}
                      >
                        {!isUser && (
                          <Typography fontSize={11} color="#DB2777" fontWeight={800} sx={{ mb: 0.4 }}>
                            우리리그 상담팀
                          </Typography>
                        )}
                        <Typography fontSize={13} lineHeight={1.6} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                          {item.content}
                        </Typography>
                      </Box>
                      <Typography textAlign={isUser ? "right" : "left"} fontSize={10} color="text.disabled" sx={{ mt: 0.4 }}>
                        {formatTime(item.created_at)}
                      </Typography>
                    </Box>
                  );
                })
              )}
              {error && (
                <Typography textAlign="center" fontSize={12} color="error.main" fontWeight={700}>
                  {error}
                </Typography>
              )}
              <div ref={messagesEndRef} />
            </Stack>
          </Box>

          {!loading && (
            <Stack
              direction="row"
              alignItems="flex-end"
              spacing={1}
              sx={{ p: 1.4, pb: "calc(12px + env(safe-area-inset-bottom))", bgcolor: "#fff", borderTop: "1px solid #E5E7EB" }}
            >
              <TextField
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                multiline
                maxRows={4}
                fullWidth
                size="small"
                placeholder={room?.status === "closed" ? "메시지를 보내면 상담이 다시 시작돼요" : "문의 내용을 입력해 주세요"}
                inputProps={{ maxLength: 1000 }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: "#F8FAFC",
                    fontSize: 13,
                  },
                }}
              />
              <IconButton
                aria-label="문의 보내기"
                onClick={sendMessage}
                disabled={!message.trim() || sending}
                sx={{
                  width: 42,
                  height: 42,
                  bgcolor: "#EC4899",
                  color: "#fff",
                  "&:hover": { bgcolor: "#DB2777" },
                  "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF" },
                }}
              >
                {sending ? <CircularProgress size={19} color="inherit" /> : <SendRoundedIcon fontSize="small" />}
              </IconButton>
            </Stack>
          )}
        </Stack>
      </Dialog>
    </>
  );
}
