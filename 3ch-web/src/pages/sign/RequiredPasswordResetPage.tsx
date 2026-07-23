import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,12}$/;

export default function RequiredPasswordResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const passwordError = useMemo(() => {
    if (!password) return "";
    return passwordRegex.test(password)
      ? ""
      : "숫자, 영문, 특수기호를 모두 포함한 8~12자로 입력해 주세요.";
  }, [password]);
  const confirmError = useMemo(() => {
    if (!confirmPassword) return "";
    return password === confirmPassword ? "" : "새 비밀번호와 동일하게 입력해 주세요.";
  }, [confirmPassword, password]);
  const canSubmit = Boolean(
    password && confirmPassword && !passwordError && !confirmError,
  );

  const handleSubmit = async () => {
    const resetToken = sessionStorage.getItem("passwordResetToken");
    if (!resetToken) {
      setError("재설정 정보가 만료되었습니다. 임시 비밀번호로 다시 로그인해 주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await axios.post(`${apiBaseUrl}/auth/reset-required-password`, {
        resetToken,
        password,
      });
      sessionStorage.removeItem("passwordResetToken");
      window.alert("비밀번호가 변경되었습니다.");
      navigate("/login", { replace: true });
    } catch {
      setError("비밀번호를 변경하지 못했습니다. 임시 비밀번호로 다시 로그인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const passwordAdornment = (visible: boolean, toggle: () => void) => (
    <InputAdornment position="end">
      <IconButton onClick={toggle} edge="end" aria-label="비밀번호 표시 전환">
        {visible ? <VisibilityOff /> : <Visibility />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 430, mx: "auto", px: 3, pt: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={5}>
        <IconButton onClick={() => navigate("/login")} sx={{ p: 0.5 }}>
          <ArrowBackIosNewIcon />
        </IconButton>
        <Typography sx={{ fontSize: 24, fontWeight: 800 }}>비밀번호 초기화</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography sx={{ fontSize: 15, fontWeight: 800, mb: 1 }}>새 비밀번호</Typography>
      <TextField
        fullWidth
        type={showPassword ? "text" : "password"}
        placeholder="숫자+영문+특수기호를 모두 포함한 8~12자"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={Boolean(passwordError)}
        helperText={passwordError || " "}
        slotProps={{
          input: {
            endAdornment: passwordAdornment(showPassword, () => setShowPassword((value) => !value)),
          },
        }}
      />

      <Typography sx={{ fontSize: 15, fontWeight: 800, mt: 2, mb: 1 }}>새 비밀번호 확인</Typography>
      <TextField
        fullWidth
        type={showConfirm ? "text" : "password"}
        placeholder="새 비밀번호를 다시 입력해 주세요."
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={Boolean(confirmError)}
        helperText={confirmError || " "}
        slotProps={{
          input: {
            endAdornment: passwordAdornment(showConfirm, () => setShowConfirm((value) => !value)),
          },
        }}
      />

      <Button
        fullWidth
        variant="contained"
        disableElevation
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        sx={{ mt: 4, height: 48, borderRadius: 1, fontSize: 17, fontWeight: 800 }}
      >
        완료
      </Button>
    </Box>
  );
}
