import { Box, Button, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { adminLogout } from "../../features/admin/adminSlice";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.admin.user);

  const handleLogout = () => {
    dispatch(adminLogout());
    navigate("/admin/login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F3F4F6", p: 4 }}>
      <Box sx={{ maxWidth: 960, mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
          <Box>
            <Typography sx={{ fontSize: 22, fontWeight: 900 }}>관리자 대시보드</Typography>
            {user && (
              <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 700 }}>
                {user.name ?? user.email}
              </Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            onClick={handleLogout}
            sx={{ fontWeight: 700, borderRadius: 1 }}
          >
            로그아웃
          </Button>
        </Box>

        <Typography sx={{ color: "#9CA3AF", fontWeight: 700 }}>
          관리 기능을 이곳에 추가하세요.
        </Typography>
      </Box>
    </Box>
  );
}
