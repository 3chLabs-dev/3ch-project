import { useState } from "react";
import { Box, Button, Collapse, Divider, Typography } from "@mui/material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { adminLogout } from "../../features/admin/adminSlice";

const MAIN_MENU = [
  { label: "회원 관리",   path: "/admin/member"     },
  { label: "클럽 관리",   path: "/admin/club"       },
  { label: "리그 관리",   path: "/admin/league"     },
  { label: "대회 관리",   path: "/admin/tournament" },
  { label: "추첨 관리",   path: "/admin/draw"       },
];

const BOARD_MENU = [
  { label: "공지사항",         path: "/admin/board/notice"  },
  { label: "FAQ",              path: "/admin/board/faq"     },
  { label: "문의사항",         path: "/admin/board/inquiry" },
  { label: "이용약관",         path: "/admin/board/terms"   },
  { label: "개인정보처리방침", path: "/admin/board/privacy" },
];

function SideMenuItem({ label, active, depth = 0, onClick }: {
  label: string; active: boolean; depth?: number; onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex", alignItems: "center", gap: 1.2,
        pl: depth === 1 ? 3.5 : 2, pr: 2, py: depth === 1 ? 1 : 1.2,
        cursor: "pointer",
        bgcolor: active ? "#EEF2FF" : "transparent",
        borderRight: active ? "3px solid #2F80ED" : "3px solid transparent",
        "&:hover": { bgcolor: "#F9FAFB" },
      }}
    >
      <Box sx={{
        width: depth === 1 ? 5 : 7,
        height: depth === 1 ? 5 : 7,
        borderRadius: "50%",
        bgcolor: active ? "#2F80ED" : depth === 1 ? "#E5E7EB" : "#D1D5DB",
        flexShrink: 0,
      }} />
      <Typography sx={{
        fontSize: depth === 1 ? 12 : 13,
        fontWeight: active ? 800 : 600,
        color: active ? "#2F80ED" : depth === 1 ? "#6B7280" : "#374151",
      }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function AdminShell() {
  const dispatch   = useAppDispatch();
  const navigate   = useNavigate();
  const location   = useLocation();
  const user       = useAppSelector((s) => s.admin.user);

  const isBoardActive = BOARD_MENU.some((item) => location.pathname === item.path);
  const [boardOpen, setBoardOpen] = useState(isBoardActive);

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
        <Box sx={{ width: 176, bgcolor: "#fff", borderRight: "1px solid #E5E7EB", pt: 2, flexShrink: 0, overflowY: "auto" }}>
          {MAIN_MENU.map((item) => (
            <SideMenuItem
              key={item.path}
              label={item.label}
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}

          <Divider sx={{ my: 1.5, mx: 2 }} />

          {/* 게시판 관리 토글 헤더 */}
          <Box
            onClick={() => setBoardOpen((v) => !v)}
            sx={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              px: 2, py: 1.2, cursor: "pointer",
              bgcolor: isBoardActive ? "#EEF2FF" : "transparent",
              borderRight: isBoardActive ? "3px solid #2F80ED" : "3px solid transparent",
              "&:hover": { bgcolor: "#F9FAFB" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: isBoardActive ? "#2F80ED" : "#D1D5DB", flexShrink: 0 }} />
              <Typography sx={{ fontSize: 13, fontWeight: isBoardActive ? 800 : 600, color: isBoardActive ? "#2F80ED" : "#374151" }}>
                게시판 관리
              </Typography>
            </Box>
            {boardOpen
              ? <ExpandLessIcon sx={{ fontSize: 16, color: "#9CA3AF" }} />
              : <ExpandMoreIcon sx={{ fontSize: 16, color: "#9CA3AF" }} />
            }
          </Box>

          {/* 게시판 서브 메뉴 */}
          <Collapse in={boardOpen} timeout="auto">
            {BOARD_MENU.map((item) => (
              <SideMenuItem
                key={item.path}
                label={item.label}
                active={location.pathname === item.path}
                depth={1}
                onClick={() => navigate(item.path)}
              />
            ))}
          </Collapse>
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
