import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import { useAppSelector } from "../../app/hooks";
import { useGetSportRankingQuery } from "../../features/user/userApi";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function formatStreak(streak: number) {
  if (streak > 0) return `W${streak}`;
  if (streak < 0) return `L${Math.abs(streak)}`;
  return "-";
}

function decodeSport(rawSport: string) {
  try {
    return decodeURIComponent(rawSport);
  } catch {
    return rawSport;
  }
}

export default function SportRankingPage() {
  const { sport: rawSport = "" } = useParams<{ sport: string }>();
  const sport = useMemo(() => decodeSport(rawSport), [rawSport]);
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useGetSportRankingQuery(
    { sport },
    { skip: !token || !sport },
  );

  if (!token) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">로그인 후 랭킹을 확인할 수 있습니다.</Typography>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">종목 랭킹 정보를 불러올 수 없습니다.</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2.5} sx={{ pb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900} flex={1}>
          {data.sport} 개인 랭킹
        </Typography>
      </Stack>

      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <CardContent sx={{ py: 2.5, px: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Stack direction="row" spacing={1}>
            <SummaryCard label="내 순위" value={data.my_ranking?.rank ? `${data.my_ranking.rank}위` : "-"} />
            <SummaryCard label="랭킹 참여" value={`${data.summary.ranked_count}명`} />
            <SummaryCard label="반영 경기" value={`${data.summary.match_count}경기`} />
          </Stack>
          <Typography sx={{ mt: 1.5, fontSize: 12, color: "text.secondary", fontWeight: 600 }}>
            마지막 계산: {formatDate(data.summary.updated_at)}
          </Typography>
        </CardContent>
      </Card>

      {data.my_ranking && (
        <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <CardContent sx={{ py: 2.2, px: 2.2, "&:last-child": { pb: 2.2 } }}>
            <Typography fontWeight={900} fontSize={15}>
              내 랭킹 요약
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.4 }}>
              <SummaryCard label="레이팅" value={`${data.my_ranking.rating}`} />
              <SummaryCard label="전적" value={`${data.my_ranking.wins}승 ${data.my_ranking.losses}패`} />
              <SummaryCard label="흐름" value={formatStreak(data.my_ranking.streak)} />
            </Stack>
            <Typography sx={{ mt: 1.2, fontSize: 12, color: "text.secondary", fontWeight: 600 }}>
              {user?.name ?? "내 계정"}의 최근 경기일: {formatDate(data.my_ranking.last_match_at)}
            </Typography>
          </CardContent>
        </Card>
      )}

      {data.my_recent_events.length > 0 && (
        <Stack spacing={1}>
          <Typography fontWeight={900} fontSize={16}>
            내 최근 랭킹 변동
          </Typography>
          {data.my_recent_events.map((event) => (
            <Card key={`${event.league_match_id}-${event.created_at}`} elevation={1} sx={{ borderRadius: 1 }}>
              <CardContent sx={{ py: 1.5, px: 1.8, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography fontWeight={800} fontSize={13}>
                    {event.result === "win" ? "승리" : "패배"}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                    vs {event.opponent_name ?? "상대 미상"}
                  </Typography>
                  <Box sx={{ ml: "auto" }}>
                    <Typography
                      fontWeight={900}
                      fontSize={13}
                      color={event.delta >= 0 ? "#2563EB" : "#DC2626"}
                    >
                      {event.delta >= 0 ? `+${event.delta}` : event.delta}
                    </Typography>
                  </Box>
                </Stack>
                <Typography sx={{ mt: 0.5, fontSize: 12, color: "text.secondary" }}>
                  {event.group_name ?? "클럽 미상"} · {formatDate(event.created_at)} · {event.before_rating} → {event.after_rating}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Stack spacing={1}>
        <Typography fontWeight={900} fontSize={16}>
          전체 순위
        </Typography>
        {data.rankings.length === 0 ? (
          <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <CardContent sx={{ py: 4, px: 2, "&:last-child": { pb: 4 } }}>
              <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                아직 반영된 랭킹 경기가 없습니다.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          data.rankings.map((row) => {
            const isMine = row.member_id === user?.id;
            return (
              <Card
                key={row.member_id}
                elevation={2}
                sx={{
                  borderRadius: 1,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  bgcolor: isMine ? "#EFF6FF" : "#FFF",
                  border: isMine ? "1px solid #BFDBFE" : "1px solid transparent",
                }}
              >
                <CardContent sx={{ py: 1.8, px: 2, "&:last-child": { pb: 1.8 } }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        bgcolor: row.rank && row.rank <= 3 ? "#FEF3C7" : "#F3F4F6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: row.rank && row.rank <= 3 ? "#B45309" : "#6B7280",
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {row.rank ?? "-"}
                    </Box>

                    <Box flex={1} minWidth={0}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {row.rank === 1 && <EmojiEventsOutlinedIcon sx={{ color: "#F59E0B", fontSize: 18 }} />}
                        <Typography fontWeight={800} fontSize={15} noWrap>
                          {row.name}
                        </Typography>
                        {isMine && (
                          <Typography sx={{ fontSize: 11, color: "#2563EB", fontWeight: 800 }}>
                            나
                          </Typography>
                        )}
                      </Stack>
                      <Typography sx={{ mt: 0.5, fontSize: 12, color: "text.secondary", fontWeight: 600 }}>
                        {row.wins}승 {row.losses}패 · 승률 {row.win_rate}% · 최근 {formatStreak(row.streak)}
                      </Typography>
                    </Box>

                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography fontWeight={900} fontSize={18} color="#2563EB">
                        {row.rating}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
                        레이팅
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          })
        )}
      </Stack>
    </Stack>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: "#F9FAFB",
        borderRadius: 1,
        px: 1.2,
        py: 1.4,
        textAlign: "center",
      }}
    >
      <Typography fontWeight={900} fontSize={18}>
        {value}
      </Typography>
      <Typography sx={{ mt: 0.25, fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
  );
}
