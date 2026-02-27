import { Box, Button, Typography } from "@mui/material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { adminLogout } from "../../features/admin/adminSlice";

const MENU_ITEMS = [
  { label: "회원 관리", path: "/admin/member" },
  { label: "클럽 관리", path: "/admin/club"   },
  { label: "리그 관리", path: "/admin/league" },
  { label: "대회 관리", path: "/admin/tournament" },
  { label: "추첨 관리", path: "/admin/draw"   },
];

export default function AdminShell() {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = useAppSelector((s) => s.admin.user);

  const handleLogout = () => {
    dispatch(adminLogout());
    navigate("/admin/login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F3F4F6", display: "flex", flexDirection: "column" }}>
      {/* 헤더 */}
      <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #E5E7EB", px: 3, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer" }} onClick={() => navigate("/admin")}>
          <Box component="img" src="/192_EN_우리리그.png" alt="우리리그" sx={{ height: 32 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>관리자페이지</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {user && <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 700 }}>{user.name ?? user.email}</Typography>}
          <Button variant="outlined" size="small" onClick={handleLogout} sx={{ fontWeight: 700, borderRadius: 1, fontSize: 12 }}>
            로그아웃
          </Button>
        </Box>
      </Box>

      {/* 바디 */}
      <Box sx={{ display: "flex", flex: 1 }}>
        {/* 사이드바 */}
        <Box sx={{ width: 160, bgcolor: "#fff", borderRight: "1px solid #E5E7EB", pt: 2, flexShrink: 0 }}>
          {MENU_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Box
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.2,
                  px: 2, py: 1.2, cursor: "pointer",
                  bgcolor: active ? "#EEF2FF" : "transparent",
                  borderRight: active ? "3px solid #2F80ED" : "3px solid transparent",
                  "&:hover": { bgcolor: "#F9FAFB" },
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: active ? "#2F80ED" : "#D1D5DB", flexShrink: 0 }} />
                <Typography sx={{ fontSize: 13, fontWeight: active ? 800 : 600, color: active ? "#2F80ED" : "#374151" }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* 콘텐츠 */}
        <Box sx={{ flex: 1, p: 3 }}>
          <Box sx={{ bgcolor: "#fff", borderRadius: 2, minHeight: 480, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
