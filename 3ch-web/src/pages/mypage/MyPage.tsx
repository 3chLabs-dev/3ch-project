import { Box, Typography, Button, Stack, Divider } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import { useNavigate } from "react-router-dom";

export default function MyPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const user = useSelector((state: any) => state.auth.user);
    const token = useSelector((state: any) => state.auth.token);

    const displayName = user?.name || user?.email || "사용자";

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        dispatch(logout());
        navigate("/", { replace: true }); // 원하는 곳으로
    };

    return (
        <Box>
            {/* 상단: 유저 이름만 */}
            <Typography variant="h6" fontWeight={900}>
                {token ? displayName : "로그인이 필요합니다"}
            </Typography>

            <Divider sx={{ my: 2 }} />

            {/* 아래: 나중에 약관/설정 넣을 자리 */}
            <Stack spacing={1.2}>
                <Typography color="text.secondary">
                    (임시) 약관/설정 영역은 추후 작업
                </Typography>
            </Stack>

            {/* 맨 아래 로그아웃 */}
            {token && (
                <Box sx={{ mt: 6 }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        onClick={handleLogout}
                        sx={{ borderRadius: 2, py: 1.2, fontWeight: 800 }}
                    >
                        로그아웃
                    </Button>
                </Box>
            )}
        </Box>
    );
}