import { useMemo,useEffect, useState, useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CssBaseline from "@mui/material/CssBaseline";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { styled } from "@mui/material/styles";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { useNavigate } from "react-router-dom";
import AppTheme from "../shared-theme/AppTheme.tsx";
import axios from "axios";
import { TERMS, PRIVACY, } from "../../constants/policies";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import confetti from "canvas-confetti";


const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
// const apiTestUrl = import.meta.env.VITE_API_TEST_URL

/** =========================
 *  Types
 *  ========================= */
type AgreeState = {
    all: boolean;
    age: boolean; // 만 14세 이상 (필수)
    terms: boolean; // 서비스 이용약관 (필수)
    privacy: boolean; // 개인정보 수집 및 이용 (필수)
};

type AgreeKey = "age" | "terms" | "privacy";

/** =========================
 *  Styles
 *  ========================= */
const SignInContainer = styled(Stack)(({ theme }) => ({
    height: "auto",
    overflow: "hidden",
    padding: theme.spacing(2),
    position: "relative",
    [theme.breakpoints.up("sm")]: {
        padding: theme.spacing(3),
    },
    "&::before": {
        content: '""',
        display: "block",
        position: "absolute",
        zIndex: -1,
        inset: 0,
        backgroundImage:
            "radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))",
        backgroundRepeat: "no-repeat",
    },
}));

const inputSx = {
    "& .MuiInputBase-input": {
        fontSize: "0.98rem",
        paddingTop: "0px",
        paddingBottom: "2px",
    },
    "& .MuiInputBase-input::placeholder": {
        fontSize: "0.88rem",
        opacity: 0.6,
    },
    "& .MuiOutlinedInput-root": {
        borderRadius: 0.6,
        backgroundColor: "#fff",
    },
    "& .MuiOutlinedInput-root .MuiInputAdornment-root .MuiIconButton-root": {
        borderRadius: 0.6,
        padding: "6px",          // 기본이 커서 공간 뜸 → 줄여줌
        // marginRight: "2px",      // 오른쪽 벽이랑 너무 붙으면 살짝 띄움
    },
};

// mui에서 검은 행잉 강제 추가 제거
const forceSolid = (bg: string, hover: string, color: string) => ({
    backgroundColor: `${bg} !important`,
    color: `${color} !important`,
    backgroundImage: "none !important",
    boxShadow: "none !important",
    border: "none !important",
    "&:hover": {
        backgroundColor: `${hover} !important`,
        backgroundImage: "none !important",
        boxShadow: "none !important",
    },
});

const primaryBtnSx = {
    borderRadius: 999,
    paddingTop: "0px",
    paddingBottom: "2px",
    fontSize: "1rem",
    fontWeight: 700,
    textTransform: "none",
    ...forceSolid("#4A90E2", "#3C7FCC", "#fff"),
};

export default function SignUp() {
    const navigate = useNavigate();

    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [confirmPassword, setConfirmPassword] = useState<string>("");
    const [username, setUsername] = useState<string>("");

    const [emailError, setEmailError] = useState<string>("");
    const [pwError, setPwError] = useState<string>("");
    const [confirmError, setConfirmError] = useState<string>("");
    const [nameError, setNameError] = useState<string>("");
    const [done, setDone] = useState(false);
    // const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [agree, setAgree] = useState<AgreeState>({
        all: false,
        age: false,
        terms: false,
        privacy: false,
    });

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [apiError, setApiError] = useState<string>("");

    const setAll = (checked: boolean) => {
        setAgree({
            all: checked,
            age: checked,
            terms: checked,
            privacy: checked,
        });
    };

    const toggleOne = (key: AgreeKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setAgree((prev: AgreeState) => {
            const next = { ...prev, [key]: checked };
            const allChecked = next.age && next.terms && next.privacy;
            return { ...next, all: allChecked };
        });
    };

    const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAll(e.target.checked);
    };

    // ✅ 비번 보기
    const [showPw, setShowPw] = useState<boolean>(false);
    const [showConfirmPw, setShowConfirmPw] = useState<boolean>(false);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,12}$/;

    const validateEmail = (v: string): string => {
        if (!v) return "이메일을 입력해주세요.";
        if (!emailRegex.test(v)) return "이메일 형식에 맞게 입력해주세요.";
        return "";
    };

    const validatePw = (v: string): string => {
        if (!v) return "비밀번호를 입력해주세요.";
        if (!pwRegex.test(v))
            return "숫자+영문+특수기호를 모두 포함한 8~12자로 입력해주세요.";
        return "";
    };

    const validateName = (v: string): string => {
        if (!v) return "이름을 입력해주세요.";
        return "";
    };

    const validateConfirm = (pw: string, cpw: string): string => {
        if (!cpw) return "비밀번호 확인을 입력해주세요.";
        if (pw !== cpw) return "비밀번호가 일치하지 않습니다.";
        return "";
    };

    // ✅ “일치합니다” 처리
    const isMatch = Boolean(password && confirmPassword && password === confirmPassword);

    const confirmHelper = useMemo(() => {
        if (!confirmPassword) return " ";
        if (isMatch) return "비밀번호가 일치합니다.";
        return confirmError || " ";
    }, [confirmPassword, confirmError, isMatch]);

    // ✅ 버튼 활성 조건
    const canSubmit = useMemo(() => {
        const filled = email.trim() && password.trim() && confirmPassword.trim() && username.trim();
        const noErrors = !emailError && !pwError && !confirmError && !nameError;
        const requiredAgree = agree.age && agree.terms && agree.privacy;

        return Boolean(filled && noErrors && isMatch && requiredAgree && !isLoading);
    }, [
        email,
        password,
        confirmPassword,
        username,
        emailError,
        pwError,
        confirmError,
        nameError,
        agree,
        isMatch,
        isLoading,
    ]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setApiError(""); // Clear previous API errors

        const eMsg = validateEmail(email);
        const pMsg = validatePw(password);
        const cMsg = validateConfirm(password, confirmPassword);
        const nMsg = validateName(username);

        setEmailError(eMsg);
        setPwError(pMsg);
        setConfirmError(cMsg);
        setNameError(nMsg);

        if (eMsg || pMsg || cMsg || nMsg) {
            setApiError("모든 필수 정보를 올바르게 입력해주세요.");
            return;
        }

        setIsLoading(true);
        try {
            await axios.post(`${apiBaseUrl}/auth/register`, {
                email,
                password,
                name: username,
            });

            setDone(true);
        } catch (error) {
            console.error("Signup API call failed:", error);
            if (axios.isAxiosError(error) && error.response) {
                const { status, data } = error.response;
                if (status === 409 && data.error === "EMAIL_EXISTS") {
                    setEmailError("이미 등록된 이메일입니다.");
                    setApiError("회원가입에 실패했습니다: 이미 사용중인 이메일입니다.");
                } else if (status === 400 && data.error === "VALIDATION_ERROR") {
                    setApiError("회원가입에 실패했습니다: 입력값을 확인해주세요.");
                } else {
                    setApiError(data.error?.message || data.error || "회원가입 중 오류가 발생했습니다.");
                }
            } else {
                setApiError("네트워크 오류 또는 서버에 연결할 수 없습니다.");
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    // 약관
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    type PolicyKey = "terms" | "privacy";
    const [openPolicy, setOpenPolicy] = useState(false);
    const [policyKey, setPolicyKey] = useState<PolicyKey>("terms");

    const policy = policyKey === "terms" ? TERMS : PRIVACY;

    const openTermsDialog = () => {
        setPolicyKey("terms");
        setOpenPolicy(true);
    };

    const openPrivacyDialog = () => {
        setPolicyKey("privacy");
        setOpenPolicy(true);
    };

    const closePolicyDialog = () => setOpenPolicy(false);

      const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

      useEffect(() => {
        if (!done) return;
        const fire = (originX: number, angle: number) =>
          confetti({
            particleCount: 6,
            angle,
            spread: 50,
            origin: { x: originX, y: 0.65 },
            colors: ["#2F80ED", "#56CCF2", "#F2994A", "#27AE60", "#EB5757"],
            zIndex: 9999,
          });
    
        let count = 0;
        animationRef.current = setInterval(() => {
          fire(0.1, 60);
          fire(0.9, 120);
          if (++count >= 8) {
            clearInterval(animationRef.current!);
            animationRef.current = null;
          }
        }, 200);
    
        return () => {
          if (animationRef.current) clearInterval(animationRef.current);
        };
      }, [done]);

    if (done) {
        return (
            <Box sx={{ px: 2.5, pt: 2 }}>
                <Typography sx={{ fontSize: 32, fontWeight: 900, textAlign: "center", mt: 2,color: "#2F80ED" }}>
                    회원가입 완료
                </Typography>

                <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: "center", mt: 1, color: "#6B7280" }}>
                    이제 우리리그에서 클럽을 관리하고{"\n"}리그를 개최할 수 있습니다!
                </Typography>

                <Box
                    sx={{
                        mt: 3,
                        width: "100%",
                        height: 200,
                        // border: "2px solid #2F80ED",
                        borderRadius: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                    }}
                >
                    <Typography sx={{ fontSize: 156, lineHeight: 1, mb: 4 }}>🎉</Typography>
                    {/* <Typography sx={{ fontSize: 32, fontWeight: 900, color: "#2F80ED" }}>축하합니다!</Typography> */}
                </Box>

                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    onClick={() => { if (animationRef.current) { clearInterval(animationRef.current); animationRef.current = null; } navigate("/login"); }}
                    sx={{
                        mt: 3,
                        borderRadius: 1,
                        height: 44,
                        fontWeight: 900,
                        bgcolor: "#2F80ED",
                        "&:hover": { bgcolor: "#256FD1" },
                    }}
                >
                    확인
                </Button>
            </Box>
        );
    }

    return (
        <AppTheme>
            <CssBaseline enableColorScheme />

            <SignInContainer direction="column" justifyContent="flex-start">
                <Box
                    sx={{
                        width: "100%",
                        maxWidth: 420,
                        mx: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                        backgroundColor: "transparent",
                    }}
                >
                    <Box sx={{ textAlign: "center", py: 1.5 }}>
                        <Typography sx={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
                            회원가입
                        </Typography>
                        <Box sx={{ height: 6 }} />
                    </Box>

                    <Box
                        component="form"
                        noValidate
                        onSubmit={handleSubmit}
                        sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                    >
                        {apiError && ( // Reintroduced apiError Typography
                            <Typography color="error" variant="body2" sx={{ textAlign: "center", mb: 1 }}>
                                {apiError}
                            </Typography>
                        )}
                        {/* 이메일 */}
                        <TextField
                            id="email"
                            type="email"
                            name="email"
                            placeholder="아이디(이메일)"
                            autoComplete="email"
                            required
                            fullWidth
                            variant="outlined"
                            sx={inputSx}
                            value={email}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                            onBlur={() => setEmailError(validateEmail(email))}
                            error={!!emailError}
                            helperText={emailError || " "}
                        />

                        {/* 비밀번호 */}
                        <TextField
                            id="password"
                            type={showPw ? "text" : "password"}
                            name="password"
                            placeholder="비밀번호"
                            autoComplete="new-password"
                            required
                            fullWidth
                            variant="outlined"
                            sx={inputSx}
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const v = e.target.value;
                                setPassword(v);
                                if (pwError) setPwError(validatePw(v));
                                if (confirmPassword) setConfirmError(validateConfirm(v, confirmPassword));
                            }}
                            onBlur={() => setPwError(validatePw(password))}
                            error={!!pwError}
                            helperText={pwError || " "}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton edge="end" onClick={() => setShowPw((prev) => !prev)} tabIndex={-1}>
                                            {showPw ? <Visibility /> : <VisibilityOff />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {/* 비밀번호 확인 */}
                        <TextField
                            id="confirmPassword"
                            type={showConfirmPw ? "text" : "password"}
                            name="confirmPassword"
                            placeholder="비밀번호 확인"
                            autoComplete="new-password"
                            required
                            fullWidth
                            variant="outlined"
                            sx={{
                                ...inputSx,
                                ...(isMatch ? { "& .MuiFormHelperText-root": { color: "success.main" } } : {}),
                            }}
                            value={confirmPassword}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const v = e.target.value;
                                setConfirmPassword(v);
                                setConfirmError(validateConfirm(password, v));
                            }}
                            onBlur={() => setConfirmError(validateConfirm(password, confirmPassword))}
                            error={!!confirmError && !isMatch}
                            helperText={confirmHelper}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            edge="end"
                                            onClick={() => setShowConfirmPw((prev) => !prev)}
                                            tabIndex={-1}
                                        >
                                            {showConfirmPw ? <Visibility /> : <VisibilityOff />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />


                        {/* 이름 */}
                        <TextField
                            id="username"
                            type="text"
                            name="username"
                            placeholder="이름"
                            required
                            fullWidth
                            variant="outlined"
                            sx={inputSx}
                            value={username}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                            onBlur={() => setNameError(validateName(username))}
                            error={!!nameError}
                            helperText={nameError || " "}
                        />

                        <Box
                            sx={{
                                mt: 0.5,
                                mb: 2,
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 0.6,
                                backgroundColor: "#fff",
                                px: 1.5,
                                py: 0.7,
                            }}
                        >
                            <FormControlLabel
                                sx={{
                                    m: 0,
                                    "& .MuiFormControlLabel-label": { fontWeight: 700 },
                                }}
                                control={<Checkbox checked={agree.all} onChange={toggleAll} size="small" />}
                                label="약관 전체 동의"
                            />

                            <Divider sx={{ my: 0.5 }} />

                            <FormControlLabel
                                sx={{ m: 0 }}
                                control={<Checkbox checked={agree.age} onChange={toggleOne("age")} size="small" />}
                                label="만 14세 이상입니다.(필수)"
                            />

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    mt: -0.7,
                                }}
                            >
                                <FormControlLabel
                                    sx={{ m: 0 }}
                                    control={
                                        <Checkbox checked={agree.terms} onChange={toggleOne("terms")} size="small" />
                                    }
                                    label="서비스 이용약관 동의(필수)"
                                />
                                <Link
                                    component="button"
                                    type="button"
                                    onClick={openTermsDialog}
                                    underline="none"
                                    sx={{ fontSize: "0.9rem", fontWeight: 600 }}
                                >
                                    보기 ＞
                                </Link>
                            </Box>

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    mt: -0.7,
                                }}
                            >
                                <FormControlLabel
                                    sx={{ m: 0 }}
                                    control={
                                        <Checkbox checked={agree.privacy} onChange={toggleOne("privacy")} size="small" />
                                    }
                                    label="개인정보 수집 및 이용 동의(필수)"
                                />
                                <Link
                                    component="button"
                                    type="button"
                                    onClick={openPrivacyDialog}
                                    underline="none"
                                    sx={{ fontSize: "0.9rem", fontWeight: 600 }}
                                >
                                    보기 ＞
                                </Link>
                            </Box>
                        </Box>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disableElevation
                            sx={{
                                ...primaryBtnSx,
                                opacity: canSubmit ? 1 : 0.35,
                            }}
                            disabled={!canSubmit}
                        >
                            회원가입
                        </Button>
                    </Box>
                </Box>
            </SignInContainer>

            {/* Success Dialog */}
            {/* <Dialog
                open={openSuccessDialog}
                onClose={handleSuccessDialogClose}
                aria-labelledby="signup-success-dialog-title"
                aria-describedby="signup-success-dialog-description"
            >
                <DialogTitle id="signup-success-dialog-title">{"회원가입 완료"}</DialogTitle>
                <DialogContent>
                    <Typography id="signup-success-dialog-description">
                        회원가입이 성공적으로 완료되었습니다.<br />
                        로그인 페이지로 이동합니다.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleSuccessDialogClose} autoFocus>
                        확인
                    </Button>
                </DialogActions>
            </Dialog> */}
            {/* 약관 */}
            <Dialog
                open={openPolicy}
                onClose={closePolicyDialog}
                fullScreen={fullScreen}
                scroll="paper"
                fullWidth
                maxWidth="sm"
                aria-labelledby="policy-dialog-title"
            >
                <DialogTitle id="policy-dialog-title" sx={{ fontWeight: 900, textAlign: "center" }}>
                    {policy.title}
                </DialogTitle>

                <DialogContent dividers>
                    <Box
                        sx={{
                            whiteSpace: "pre-line",
                            fontSize: 14,
                            lineHeight: 1.7,
                            color: "text.primary",
                        }}
                    >
                        {policy.body}
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={closePolicyDialog}>닫기</Button>
                </DialogActions>
            </Dialog>
        </AppTheme>
    );
}