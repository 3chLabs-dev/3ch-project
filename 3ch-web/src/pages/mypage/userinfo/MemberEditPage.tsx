import { useEffect, useMemo, useState, useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { useNavigate } from "react-router-dom";
import AppTheme from "../../shared-theme/AppTheme";
import axios from "axios";

import { useAppSelector } from "../../../app/hooks";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const inputSx = {
    "& .MuiInputBase-input": {
        fontSize: "0.98rem",
        py: 1.25,
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
        padding: "6px",
    },
};

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
    py: 1.2,
    fontSize: "1rem",
    fontWeight: 700,
    textTransform: "none",
    ...forceSolid("#4A90E2", "#3C7FCC", "#fff"),
};

/** =========================
 *  Validation (SignUp 기준)
 *  ========================= */
const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,12}$/;

const validateName = (v: string): string => {
    if (!v) return "이름을 입력해주세요.";
    return "";
};

const validatePw = (v: string): string => {
    if (!v) return "비밀번호를 입력해주세요.";
    if (!pwRegex.test(v)) return "숫자+영문+특수기호를 모두 포함한 8~12자로 입력해주세요.";
    return "";
};

const validateConfirm = (pw: string, cpw: string): string => {
    if (!cpw) return "비밀번호 확인을 입력해주세요.";
    if (pw !== cpw) return "비밀번호가 일치하지 않습니다.";
    return "";
};

export default function MemberEditPage() {
    const navigate = useNavigate();

    const checkedRef = useRef(false);
    
    // ✅ Redux에서 user/token 가져오기
    const token = useAppSelector((state) => state.auth.token);
    const user = useAppSelector((state) => state.auth.user);
    
    const email = user?.email ?? "";
    const originalName = user?.name ?? "";
    
    const provider = user?.auth_provider ?? "local";
    const isLocal = provider === "local";
    
    //로컬유저 비번 체크 없이 들어올시 체크 페이지로 돌리기
    useEffect(() => {
        if (!user || checkedRef.current) return;

        checkedRef.current = true;

        console.log("넘어와ㅏ서", sessionStorage.getItem("member_edit_verified"));
        if (isLocal) {
            const ok = sessionStorage.getItem("member_edit_verified") === "true";
            if (!ok) navigate("/member/password-check", { replace: true });
        }
        sessionStorage.removeItem("member_edit_verified");
    }, [user, isLocal, navigate]);

    const [name, setName] = useState<string>("");
    const [newPw, setNewPw] = useState<string>("");
    const [confirmPw, setConfirmPw] = useState<string>("");

    const [nameError, setNameError] = useState<string>("");
    const [pwError, setPwError] = useState<string>("");
    const [confirmError, setConfirmError] = useState<string>("");
    const [apiError, setApiError] = useState<string>("");

    const [isLoading, setIsLoading] = useState<boolean>(false);

    // 비번보기
    const [showPw, setShowPw] = useState<boolean>(false);
    const [showConfirmPw, setShowConfirmPw] = useState<boolean>(false);

    // 이름값 초기 세팅
    useEffect(() => {
        setName(originalName || "");
    }, [originalName]);
    const isMatch = Boolean(newPw && confirmPw && newPw === confirmPw);

    const confirmHelper = useMemo(() => {
        if (!confirmPw) return " ";
        if (isMatch) return "비밀번호가 일치합니다.";
        return confirmError || " ";
    }, [confirmPw, confirmError, isMatch]);

    // ✅ 변경 감지
    const nameChanged = useMemo(
        () => name.trim() !== (originalName || "").trim(),
        [name, originalName]
    );

    const pwTouched = useMemo(
        () => Boolean(newPw.trim() || confirmPw.trim()),
        [newPw, confirmPw]
    );

    // - LOCAL: 이름 변경 or 비번 입력 시작 시 활성 가능(단, 비번은 두 필드 통과해야 최종 활성)
    // - SOCIAL: 이름 변경만 가능
    const canSubmit = useMemo(() => {
        const hasChange = isLocal ? (nameChanged || pwTouched) : nameChanged;
        if (!hasChange) return false;
        if (isLoading) return false;

        // 이름 검증(바꿨을 때만)
        if (nameChanged) {
            const nMsg = validateName(name);
            if (nMsg) return false;
        }

        // 비번 검증(LOCAL + 비번을 건드렸을 때만) -> 두 필드 통과 + 일치까지
        if (isLocal && pwTouched) {
            const pMsg = validatePw(newPw);
            const cMsg = validateConfirm(newPw, confirmPw);
            if (pMsg || cMsg || !isMatch) return false;
        }

        // 이미 떠있는 에러가 있으면 막기
        const noErrors = !nameError && !pwError && !confirmError;
        return Boolean(noErrors);
    }, [
        isLocal,
        nameChanged,
        pwTouched,
        isLoading,
        name,
        newPw,
        confirmPw,
        isMatch,
        nameError,
        pwError,
        confirmError,
    ]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setApiError("");

        const hasChange = isLocal ? (nameChanged || pwTouched) : nameChanged;
        if (!hasChange) return;

        // 변경한 것만 검증
        const nMsg = nameChanged ? validateName(name) : "";
        const pMsg = (isLocal && pwTouched) ? validatePw(newPw) : "";
        const cMsg = (isLocal && pwTouched) ? validateConfirm(newPw, confirmPw) : "";

        setNameError(nMsg);
        setPwError(pMsg);
        setConfirmError(cMsg);

        if (nMsg || pMsg || cMsg) return;
        if (isLocal && pwTouched && !isMatch) return;

        setIsLoading(true);
        try {
            // ✅ payload: 바뀐 것만 보냄 (요구사항: 안 바꾸면 요청 X)
            const payload: { name?: string; password?: string } = {};

            if (nameChanged) payload.name = name.trim();
            if (isLocal && pwTouched) payload.password = newPw;

            await axios.put(`${apiBaseUrl}/member`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            sessionStorage.removeItem("member_edit_verified");
            navigate("/my", { replace: true });
        } catch (error) {
            console.error(error);
            setApiError("회원정보 수정 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AppTheme>
            <CssBaseline enableColorScheme />

            <Box sx={{ px: 2, pt: 2, width: "100%", maxWidth: 420, mx: "auto", minHeight: "100dvh" }}>
                {/* 헤더 */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <IconButton onClick={() => navigate(-1)} sx={{ p: 0.5 }}>
                        <ArrowBackIosNewIcon />
                    </IconButton>
                    <Typography sx={{ fontSize: 18, fontWeight: 900 }}>회원정보 수정</Typography>
                </Box>

                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                    {apiError && (
                        <Typography color="error" variant="body2" sx={{ textAlign: "center", mb: 1 }}>
                            {apiError}
                        </Typography>
                    )}

                    {/* 아이디(이메일) - 수정 불가 */}
                    <Typography sx={{ fontSize: 14, fontWeight: 900, mb: 0.7 }}>아이디</Typography>
                    <TextField
                        value={email}
                        fullWidth
                        disabled
                        sx={{
                            ...inputSx,
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 0.6,
                                backgroundColor: "#d9d9d9",
                            },
                            "& .MuiInputBase-input.Mui-disabled": {
                                WebkitTextFillColor: "#111",
                            },
                        }}
                    />

                    {/* LOCAL일 때만 비번 섹션 노출 */}
                    {isLocal && (
                        <>
                            {/* 비밀번호 변경 */}
                            <Typography sx={{ mt: 2.5, fontSize: 14, fontWeight: 900, mb: 0.7 }}>비밀번호 변경</Typography>
                            <TextField
                                placeholder="숫자+영문+특수기호를 모두 포함한 8~12자"
                                type={showPw ? "text" : "password"}
                                fullWidth
                                sx={inputSx}
                                value={newPw}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const v = e.target.value;
                                    setNewPw(v);
                                    if (pwError) setPwError(validatePw(v));
                                    if (confirmPw) setConfirmError(validateConfirm(v, confirmPw));
                                }}
                                onBlur={() => {
                                    if (newPw.trim()) setPwError(validatePw(newPw));
                                }}
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
                            <Typography sx={{ mt: 1.8, fontSize: 14, fontWeight: 900, mb: 0.7 }}>비밀번호 확인</Typography>
                            <TextField
                                placeholder="숫자+영문+특수기호를 모두 포함한 8~12자"
                                type={showConfirmPw ? "text" : "password"}
                                fullWidth
                                sx={{
                                    ...inputSx,
                                    ...(isMatch ? { "& .MuiFormHelperText-root": { color: "success.main" } } : {}),
                                }}
                                value={confirmPw}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const v = e.target.value;
                                    setConfirmPw(v);
                                    setConfirmError(validateConfirm(newPw, v));
                                }}
                                onBlur={() => {
                                    if (confirmPw.trim()) setConfirmError(validateConfirm(newPw, confirmPw));
                                }}
                                error={!!confirmError && !isMatch}
                                helperText={confirmHelper}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton edge="end" onClick={() => setShowConfirmPw((prev) => !prev)} tabIndex={-1}>
                                                {showConfirmPw ? <Visibility /> : <VisibilityOff />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </>
                    )}

                    {/* 이름 */}
                    <Typography sx={{ mt: 1.8, fontSize: 14, fontWeight: 900, mb: 0.7 }}>
                        이름 <span style={{ color: "#d32f2f" }}>*</span>
                    </Typography>
                    <TextField
                        placeholder="이름"
                        fullWidth
                        sx={inputSx}
                        value={name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                        onBlur={() => {
                            if (nameChanged) setNameError(validateName(name));
                            else setNameError("");
                        }}
                        error={!!nameError}
                        helperText={nameError || " "}
                    />

                    {/* 회원탈퇴(회색) */}
                    <Typography
                        sx={{ mt: 2, fontSize: 13, color: "text.disabled", fontWeight: 800, cursor: "pointer" }}
                        onClick={() => navigate("/member/withdraw")}
                    >
                        회원탈퇴
                    </Typography>

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        disableElevation
                        sx={{ ...primaryBtnSx, mt: 5, opacity: canSubmit ? 1 : 0.35 }}
                        disabled={!canSubmit}
                    >
                        수정
                    </Button>
                </Box>
            </Box>
        </AppTheme>
    );
}
