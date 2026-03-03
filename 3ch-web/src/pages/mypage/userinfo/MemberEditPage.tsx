import { useEffect, useMemo, useState, useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate } from "react-router-dom";
import AppTheme from "../../shared-theme/AppTheme";
import axios from "axios";
import { useDispatch } from "react-redux"
import { styled } from "@mui/material/styles";
import Stack from "@mui/material/Stack";

import { setUser, logout } from "../../../features/auth/authSlice";
import { baseApi } from "../../../features/api/baseApi";
import { useAppSelector } from "../../../app/hooks";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

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
    paddingTop: "0px",
    paddingBottom: "2px",
    fontSize: "1rem",
    fontWeight: 700,
    textTransform: "none",
    ...forceSolid("#4A90E2", "#3C7FCC", "#fff"),
};

/** =========================
 *  Validation (MemberEdit 기준)
 *  ========================= */
const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,12}$/;

const validateName = (v: string): string => {
    if (!v.trim()) return "이름을 입력해주세요.";
    return "";
};

// ✅ 비어있으면 통과, 값이 있을 때만 형식 검사
const validatePw = (v: string): string => {
    if (!v) return "";
    if (!pwRegex.test(v))
        return "숫자+영문+특수기호를 모두 포함한 8~12자로 입력해주세요.";
    return "";
};

// ✅ 둘 다 비어있으면 통과
const validateConfirm = (pw: string, cpw: string): string => {
    if (!pw && !cpw) return "";
    if (pw !== cpw) return "비밀번호가 일치하지 않습니다.";
    return "";
};

export default function MemberEditPage() {
    const navigate = useNavigate();
    const checkedRef = useRef(false);
    const dispatch = useDispatch();

    const token = useAppSelector((state) => state.auth.token);
    const user = useAppSelector((state) => state.auth.user);

    const email = user?.email ?? "";
    const originalName = user?.name ?? "";

    const provider = user?.auth_provider ?? "local";
    const isLocal = provider === "local";

    useEffect(() => {
        if (!user || checkedRef.current) return;

        checkedRef.current = true;

        if (isLocal) {
            const ok = sessionStorage.getItem("member_edit_verified") === "true";
            if (!ok) navigate("/mypage/member/password-check", { replace: true });
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

    const [showPw, setShowPw] = useState<boolean>(false);
    const [showConfirmPw, setShowConfirmPw] = useState<boolean>(false);

    // 회원탈퇴
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [ownedGroups, setOwnedGroups] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        setName(originalName || "");
    }, [originalName]);

    const isMatch = Boolean(newPw && confirmPw && newPw === confirmPw);

    const confirmHelper = useMemo(() => {
        if (!confirmPw) return " ";
        if (isMatch) return "비밀번호가 일치합니다.";
        return confirmError || " ";
    }, [confirmPw, confirmError, isMatch]);

    const nameChanged = useMemo(
        () => name.trim() !== (originalName || "").trim(),
        [name, originalName]
    );

    const pwTouched = useMemo(
        () => Boolean(newPw.trim() || confirmPw.trim()),
        [newPw, confirmPw]
    );

    const canSubmit = useMemo(() => {
        const hasChange = isLocal ? (nameChanged || pwTouched) : nameChanged;
        if (!hasChange) return false;
        if (isLoading) return false;

        if (nameChanged) {
            if (validateName(name)) return false;
        }

        if (isLocal && pwTouched) {
            if (validatePw(newPw)) return false;
            if (validateConfirm(newPw, confirmPw)) return false;
        }

        return true;
    }, [
        isLocal,
        nameChanged,
        pwTouched,
        isLoading,
        name,
        newPw,
        confirmPw,
    ]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setApiError("");

        const hasChange = isLocal ? (nameChanged || pwTouched) : nameChanged;
        if (!hasChange) return;

        const nMsg = nameChanged ? validateName(name) : "";
        const pMsg = (isLocal && pwTouched) ? validatePw(newPw) : "";
        const cMsg = (isLocal && pwTouched) ? validateConfirm(newPw, confirmPw) : "";

        setNameError(nMsg);
        setPwError(pMsg);
        setConfirmError(cMsg);

        if (nMsg || pMsg || cMsg) return;

        setIsLoading(true);

        try {
            const payload: { name?: string; password?: string } = {};

            if (nameChanged) payload.name = name.trim();
            if (isLocal && pwTouched) payload.password = newPw;

            await axios.put(`${apiBaseUrl}/auth/member`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            // ✅ 최신 사용자 정보 다시 받아오기
            const meRes = await axios.get(`${apiBaseUrl}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const updatedUser = meRes.data?.user;
            if (!updatedUser) {
                throw new Error("NO_USER_FROM_ME");
            }

            localStorage.setItem("user", JSON.stringify(updatedUser));
            dispatch(setUser(updatedUser));

            sessionStorage.removeItem("member_edit_verified");
            navigate("/mypage", { replace: true });

        } catch (error) {
            console.error(error);
            setApiError("회원정보 수정 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDeleteDialog = async () => {
        try {
            const res = await axios.get(`${apiBaseUrl}/auth/member/owned-groups`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setOwnedGroups(res.data?.groups ?? []);
        } catch {
            setOwnedGroups([]);
        }
        setDeletePassword("");
        setDeleteError("");
        setDeleteDialogOpen(true);
    };

    const handleDeleteAccount = async () => {
        setDeleteError("");
        if (isLocal && !deletePassword) {
            setDeleteError("비밀번호를 입력해주세요.");
            return;
        }
        setDeleteLoading(true);
        try {
            await axios.delete(`${apiBaseUrl}/auth/member`, {
                headers: { Authorization: `Bearer ${token}` },
                data: isLocal ? { password: deletePassword } : undefined,
            });
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            dispatch(logout());
            dispatch(baseApi.util.resetApiState());
            navigate("/", { replace: true });
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            const code = error?.response?.data?.error;
            if (code === "INVALID_CREDENTIALS") setDeleteError("비밀번호가 올바르지 않습니다.");
            else setDeleteError("탈퇴 처리 중 오류가 발생했습니다.");
        } finally {
            setDeleteLoading(false);
        }
    };

    return (


        <Box sx={{ mx: "auto", mt: "-4px" }}>
            {/* 헤더 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <IconButton onClick={() => navigate(-1)} sx={{ p: 0 }}>
                    <ChevronLeftIcon sx={{ fontSize: 28 }} />
                </IconButton>
                <Typography sx={{ fontSize: 20, fontWeight: 900 }}>회원정보 수정</Typography>
            </Box>
            <AppTheme>
                <CssBaseline enableColorScheme />
                <SignInContainer direction="column" justifyContent="flex-start">

                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 0 }}>
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
                                <Typography sx={{ mt: 1, fontSize: 14, fontWeight: 900, mb: 0.7 }}>비밀번호 변경</Typography>
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
                                <Typography sx={{ mt: 1, fontSize: 14, fontWeight: 900, mb: 0.7 }}>비밀번호 확인</Typography>
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
                        <Typography sx={{ mt: 1.5, fontSize: 14, fontWeight: 900, mb: 0.7 }}>
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
                            sx={{ mt: 1, fontSize: 13, color: "text.disabled", fontWeight: 800, cursor: "pointer" }}
                            onClick={handleOpenDeleteDialog}
                        >
                            회원탈퇴
                        </Typography>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disableElevation
                            sx={{ ...primaryBtnSx, mt: 2, opacity: canSubmit ? 1 : 0.35 }}
                            disabled={!canSubmit}
                        >
                            수정
                        </Button>
                    </Box>
                </SignInContainer>
            </AppTheme>

            {/* 회원탈퇴 다이얼로그 */}
            <Dialog open={deleteDialogOpen} onClose={() => !deleteLoading && setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ fontWeight: 800 }}>회원탈퇴</DialogTitle>
                <DialogContent>
                    {ownedGroups.length > 0 && (
                        <DialogContentText sx={{ mb: isLocal ? 2 : 0, color: "error.main", fontSize: 13 }}>
                            클럽장으로 있는 <b>{ownedGroups.map(g => g.name).join(", ")}</b> 클럽이 함께 삭제됩니다.
                        </DialogContentText>
                    )}
                    <DialogContentText sx={{ mb: isLocal ? 2 : 0, fontSize: 13 }}>
                        탈퇴하면 계정과 모든 데이터가 삭제됩니다.<br />정말 탈퇴하시겠습니까?
                    </DialogContentText>
                    {isLocal && (
                        <TextField
                            label="비밀번호 확인"
                            type="password"
                            fullWidth
                            size="small"
                            value={deletePassword}
                            onChange={e => setDeletePassword(e.target.value)}
                            error={!!deleteError}
                            helperText={deleteError || " "}
                            autoComplete="current-password"
                        />
                    )}
                    {!isLocal && deleteError && (
                        <DialogContentText sx={{ color: "error.main", fontSize: 13 }}>{deleteError}</DialogContentText>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>취소</Button>
                    <Button onClick={handleDeleteAccount} color="error" disabled={deleteLoading}>
                        {deleteLoading ? "처리 중..." : "탈퇴하기"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
