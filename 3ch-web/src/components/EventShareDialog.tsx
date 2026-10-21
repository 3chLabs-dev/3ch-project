import type { ReactNode } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from "@mui/material";
import QRCode from "react-qr-code";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";

export default function EventShareDialog({ open, onClose, noun, name, path, children, onNotice }: {
  open: boolean; onClose: () => void; noun: string; name: string; path: string;
  children?: ReactNode; onNotice: (message: string, error?: boolean) => void;
}) {
  const link = `${window.location.origin}${path}`;
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
      else {
        const input = document.createElement("textarea");
        input.value = link; input.style.position = "fixed"; input.style.opacity = "0";
        document.body.appendChild(input);
        try { input.focus(); input.select(); if (!document.execCommand("copy")) throw new Error("copy failed"); }
        finally { input.remove(); }
      }
      onNotice("링크가 복사되었습니다!"); onClose();
    } catch { onNotice("링크 복사에 실패했습니다.", true); }
  };
  const kakao = () => {
    try {
      const appUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
      const publicLink = `${appUrl}${path}`;
      const key = import.meta.env.VITE_KAKAO_JS_KEY;
      if (window.Kakao && key && !window.Kakao.isInitialized()) window.Kakao.init(key);
      if (!window.Kakao?.Share) { void copy(); return; }
      window.Kakao.Share.sendDefault({ objectType: "feed", content: {
        title: name, description: `${noun}에 참가해보세요!`, imageUrl: `${appUrl}/og-image.png`,
        link: { mobileWebUrl: publicLink, webUrl: publicLink },
      }, buttons: [{ title: `${noun} 보기`, link: { mobileWebUrl: publicLink, webUrl: publicLink } }] });
    } catch { onNotice("카카오톡 공유에 실패했습니다.", true); }
  };
  const action = (label: string, bg: string, hover: string, color: string, icon: ReactNode, onClick: () => void) =>
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.8 }}>
      <IconButton aria-label={label} onClick={onClick} sx={{ width: 56, height: 56, bgcolor: bg, color, "&:hover": { bgcolor: hover } }}>{icon}</IconButton>
      <Typography fontSize={11} fontWeight={700} color="text.secondary">{label}</Typography>
    </Box>;
  return <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 1, mx: 2 } } }}>
    <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>{noun} 공유</DialogTitle>
    <DialogContent><Stack spacing={3} sx={{ pt: 1, alignItems: "center" }}>
      {children}
      <Box sx={{ p: 2, bgcolor: "#fff", borderRadius: 1, border: "1px solid #E0E0E0" }}><QRCode value={link} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} /></Box>
      <Box sx={{ width: "100%" }}><Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ mb: 0.5 }}>공유 링크</Typography><TextField value={link} fullWidth size="small" slotProps={{ input: { readOnly: true } }} sx={{ "& .MuiInputBase-input": { fontSize: 13 } }} /></Box>
      <Stack direction="row" justifyContent="space-around" sx={{ width: "100%", pt: 0.5 }}>
        {action("카카오톡", "#FFEB3A", "#E6CE00", "#000", <Box component="img" src="/kakao-logo.png" alt="카카오톡" sx={{ width: 40, height: 40, objectFit: "contain" }} />, kakao)}
        {action("문자", "#4CAF50", "#43A047", "#fff", <SmsOutlinedIcon />, () => { window.location.href = `sms:?body=${encodeURIComponent(`${noun}에 초대합니다! ${link}`)}`; })}
        {action("링크 복사", "#E5E7EB", "#D1D5DB", "#374151", <ContentCopyOutlinedIcon />, () => void copy())}
      </Stack>
    </Stack></DialogContent>
    <DialogActions sx={{ px: 3, pb: 2.5 }}><Button onClick={onClose} variant="contained" disableElevation sx={{ borderRadius: 1, px: 3, fontWeight: 700 }}>닫기</Button></DialogActions>
  </Dialog>;
}
