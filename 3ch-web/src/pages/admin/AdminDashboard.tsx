import { useState, useEffect } from "react";
import { Box, Card, CardContent, CircularProgress, Typography } from "@mui/material";
import { BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";
import { useAppSelector } from "../../app/hooks";

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

export default function AdminDashboard() {
  const token = useAppSelector((s) => s.admin.token) ?? "";
  const [stats, setStats]     = useState<Stats | null>(null);
  const [trend, setTrend]     = useState<TrendRow[]>([]);
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 480 }}>
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
