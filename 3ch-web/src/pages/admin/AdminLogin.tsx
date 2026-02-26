import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, TextField, Typography, Alert } from "@mui/material";
import { useAppDispatch } from "../../app/hooks";
import { adminLogin } from "../../features/admin/adminSlice";

export default function AdminLogin() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg =
          data.error === "INVALID_CREDENTIALS" ? "아이디 또는 비밀번호가 올바르지 않습니다." :
          data.error === "NOT_ADMIN" ? "관리자 계정이 아닙니다." :
          "로그인에 실패했습니다.";
        setError(msg);
        return;
      }
      dispatch(adminLogin({ token: data.token, user: data.user }));
      navigate("/admin", { replace: true });
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#F3F4F6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: 360,
          bgcolor: "#fff",
          borderRadius: 3,
          p: 4,
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        }}
      >
        <Box sx={{ textAlign: "center", mb: 3.5 }}>
          <Box component="img" src="/192_EN_우리리그.png" alt="우리리그" sx={{ width: 120, mb: 1 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#6B7280" }}>
            관리자페이지
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontWeight: 700, fontSize: 13 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          placeholder="아이디(이메일)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
          size="small"
          sx={{ mb: 1.5 }}
        />
        <TextField
          fullWidth
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
          size="small"
          sx={{ mb: 2.5 }}
        />

        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={handleLogin}
          disabled={loading || !email.trim() || !password.trim()}
          sx={{
            borderRadius: 5,
            height: 44,
            fontWeight: 900,
            fontSize: 16,
            bgcolor: "#4DA3FF",
            "&:hover": { bgcolor: "#3A8FE8" },
            "&.Mui-disabled": { bgcolor: "#B3D4F9", color: "#fff" },
          }}
        >
          {loading ? "로그인 중..." : "로그인"}
        </Button>
      </Box>
    </Box>
  );
}
