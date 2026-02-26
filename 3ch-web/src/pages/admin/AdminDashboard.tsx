import { useState, useEffect } from "react";
import { Box, Button, Card, CardContent, CircularProgress, Typography } from "@mui/material";
import { BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { adminLogout } from "../../features/admin/adminSlice";
import { useNavigate } from "react-router-dom";

type MenuKey = "dashboard" | "member" | "group" | "league" | "match" | "draw";

const MENU_ITEMS: { key: MenuKey; label: string }[] = [
  { key: "member", label: "회원 관리" },
  { key: "group",  label: "모임 관리" },
  { key: "league", label: "리그 관리" },
  { key: "match",  label: "대회 관리" },
  { key: "draw",   label: "추첨 관리" },
];

type Stats = {
  member_count: number;
  withdrawn_count: number;
  league_count: number;
  group_count: number;
  match_count: number;
  draw_count: number;
  payment_count: number;
};

type TrendRow = {
  day: string;
  member_cnt: number;
  league_cnt: number;
  group_cnt: number;
  draw_cnt: number;
};

const STAT_CARDS: {
  key: keyof Stats;
  label: string;
  color: string;
  trendKey?: keyof TrendRow;
}[] = [
  { key: "member_count",    label: "회원가입수", color: "#2F80ED", trendKey: "member_cnt" },
  { key: "withdrawn_count", label: "회원탈퇴수", color: "#EB5757" },
  { key: "league_count",    label: "리그생성수", color: "#27AE60", trendKey: "league_cnt" },
  { key: "group_count",     label: "클럽생성수", color: "#F2994A", trendKey: "group_cnt"  },
  { key: "match_count",     label: "대회생성수", color: "#15ff00" },
  { key: "draw_count",      label: "추첨생성수", color: "#9B51E0", trendKey: "draw_cnt"   },
  { key: "payment_count",   label: "결제건수",  color: "#56CCF2" },
];

function MiniBarChart({ data, color, trendKey }: { data: TrendRow[]; color: string; trendKey: keyof TrendRow }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Bar dataKey={trendKey as string} fill={color} radius={[2, 2, 0, 0]} />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #E5E7EB", padding: "2px 8px" }}
          labelFormatter={(v) => v.toString().slice(5)}
          formatter={(v: number | undefined) => [v ?? 0, ""]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Dashboard({ token }: { token: string }) {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [trend, setTrend]   = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setStats(data.stats);
          setTrend(data.trend ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2.5, color: "#1F2937" }}>대시보드</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
        {STAT_CARDS.map(({ key, label, color, trendKey }) => (
          <Card key={key} elevation={0} sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>
            <CardContent sx={{ py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", mb: 0.5 }}>{label}</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900, color, mb: trendKey ? 1 : 0 }}>
                {stats?.[key] ?? 0}
              </Typography>
              {trendKey && trend.length > 0 && (
                <MiniBarChart data={trend} color={color} trendKey={trendKey} />
              )}
              {!trendKey && (
                <Typography sx={{ fontSize: 11, color: "#9CA3AF", mt: 0.5 }}>추세 데이터 없음</Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

function ContentArea({ menu, token }: { menu: MenuKey; token: string }) {
  if (menu === "dashboard") return <Dashboard token={token} />;
  const label = MENU_ITEMS.find((m) => m.key === menu)?.label ?? "";
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <Typography sx={{ fontSize: 24, fontWeight: 900, color: "#6B7280" }}>{label}</Typography>
    </Box>
  );
}

export default function AdminDashboard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user  = useAppSelector((s) => s.admin.user);
  const token = useAppSelector((s) => s.admin.token) ?? "";
  const [activeMenu, setActiveMenu] = useState<MenuKey>("dashboard");

  const handleLogout = () => {
    dispatch(adminLogout());
    navigate("/admin/login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F3F4F6", display: "flex", flexDirection: "column" }}>
      {/* 상단 헤더 */}
      <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #E5E7EB", px: 3, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer" }}
          onClick={() => setActiveMenu("dashboard")}
        >
          <Box component="img" src="/192_EN_우리리그.png" alt="우리리그" sx={{ height: 32 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>관리자페이지</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {user && (
            <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 700 }}>
              {user.name ?? user.email}
            </Typography>
          )}
          <Button variant="outlined" size="small" onClick={handleLogout}
            sx={{ fontWeight: 700, borderRadius: 1, fontSize: 12 }}>
            로그아웃
          </Button>
        </Box>
      </Box>

      {/* 바디: 사이드바 + 콘텐츠 */}
      <Box sx={{ display: "flex", flex: 1 }}>
        {/* 사이드바 */}
        <Box sx={{ width: 160, bgcolor: "#fff", borderRight: "1px solid #E5E7EB", pt: 2, flexShrink: 0 }}>
          {MENU_ITEMS.map((item) => (
            <Box
              key={item.key}
              onClick={() => setActiveMenu(item.key)}
              sx={{
                display: "flex", alignItems: "center", gap: 1.2,
                px: 2, py: 1.2, cursor: "pointer",
                bgcolor: activeMenu === item.key ? "#EEF2FF" : "transparent",
                borderRight: activeMenu === item.key ? "3px solid #2F80ED" : "3px solid transparent",
                "&:hover": { bgcolor: "#F9FAFB" },
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: activeMenu === item.key ? "#2F80ED" : "#D1D5DB", flexShrink: 0 }} />
              <Typography sx={{ fontSize: 13, fontWeight: activeMenu === item.key ? 800 : 600, color: activeMenu === item.key ? "#2F80ED" : "#374151" }}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* 콘텐츠 영역 */}
        <Box sx={{ flex: 1, p: 3 }}>
          <Box sx={{ bgcolor: "#fff", borderRadius: 2, height: "100%", minHeight: 480, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <ContentArea menu={activeMenu} token={token} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
