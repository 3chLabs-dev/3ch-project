import { useState } from "react";
import type { FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, CssBaseline, IconButton, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AppTheme from "../shared-theme/AppTheme";
import { loginUrl } from "../../utils/returnNavigation";

type LookupResult = { found: boolean; providers: string[] };
const providerLabels: Record<string, string> = {
  local: "이메일", google: "구글", kakao: "카카오", naver: "네이버",
};

export default function AccountFindPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setResult(null);
    setError("");
    setLoading(true);
    try {
      const response = await axios.post<LookupResult>(
        `${import.meta.env.VITE_API_BASE_URL ?? "/api"}/auth/find-account`,
        { name: name.trim(), email: email.trim() },
      );
      setResult(response.data);
    } catch (lookupError) {
      const status = axios.isAxiosError(lookupError) ? lookupError.response?.status : undefined;
      setError(status === 429
        ? "조회 요청이 많습니다. 잠시 후 다시 시도해 주세요."
        : status === 400 ? "이름과 이메일을 올바르게 입력해 주세요."
          : "조회하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppTheme>
      <CssBaseline enableColorScheme />
      <Stack sx={{ p: { xs: 2, sm: 3 }, width: "100%", maxWidth: 468, mx: "auto" }} spacing={3}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton aria-label="로그인으로 돌아가기" onClick={() => navigate(loginUrl())} size="small">
            <ArrowBackIosNewIcon sx={{ fontSize: 22 }} />
          </IconButton>
          <Typography fontSize={22} fontWeight={900}>아이디 찾기</Typography>
        </Stack>
        <Typography fontSize={14} color="text.secondary">
          가입할 때 입력한 이름과 이메일로 가입 방식을 확인할 수 있습니다.
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField label="이름" name="name" autoComplete="name" required fullWidth
              value={name} disabled={loading} inputProps={{ maxLength: 50 }}
              onChange={event => { setName(event.target.value); setResult(null); setError(""); }} />
            <TextField label="이메일" name="email" type="email" autoComplete="email" required fullWidth
              value={email} disabled={loading} inputProps={{ maxLength: 254 }}
              onChange={event => { setEmail(event.target.value); setResult(null); setError(""); }} />
            <Button type="submit" variant="contained" disableElevation fullWidth
              disabled={loading || !name.trim() || !email.trim()} sx={{ height: 44, borderRadius: 999, fontWeight: 800 }}>
              {loading ? <CircularProgress size={22} color="inherit" aria-label="조회 중" /> : "조회하기"}
            </Button>
          </Stack>
        </Box>
        <Box aria-live="polite">
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Alert severity={result.found ? "success" : "info"}>
              {result.found ? (
                <Stack spacing={0.5}>
                  <Typography fontSize={14} fontWeight={700}>가입된 계정이 있습니다.</Typography>
                  {result.providers.map(provider => (
                    <Typography key={provider} fontSize={14}>
                      {provider === "unknown" ? "가입 방식은 채팅 문의로 확인해 주세요."
                        : `${providerLabels[provider] ?? "SNS"}${provider === "local" ? "로 가입한 계정입니다. 이메일과 비밀번호로 로그인해 주세요." : "로 가입한 계정입니다. 로그인 화면에서 해당 SNS 버튼을 눌러 주세요."}`}
                    </Typography>
                  ))}
                </Stack>
              ) : "입력한 이름과 이메일로 가입된 계정이 없습니다."}
            </Alert>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button fullWidth variant="contained" disableElevation onClick={() => navigate(loginUrl())}
            sx={{ height: 44, borderRadius: 999, fontWeight: 800 }}>로그인</Button>
          <Button fullWidth variant="outlined" onClick={() => navigate("/password/help")}
            sx={{ height: 44, borderRadius: 999, fontWeight: 800 }}>비밀번호 찾기</Button>
        </Stack>
      </Stack>
    </AppTheme>
  );
}
