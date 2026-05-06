import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useGetGroupRankingDetailQuery } from "../../features/group/groupApi";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function formatStreak(streak: number) {
  if (streak > 0) return `W${streak}`;
  if (streak < 0) return `L${Math.abs(streak)}`;
  return "-";
}

export default function GroupMemberRankingDetailPage() {
  const { id: groupId = "", userId = "" } = useParams<{ id: string; userId: string }>();
  const navigate = useNavigate();
  const memberId = Number(userId);
  const { data, isLoading } = useGetGroupRankingDetailQuery(
    { groupId, memberId },
    { skip: !groupId || !memberId },
  );

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
        <Typography color="text.secondary"> 상세 순위를 불러올 수 없습니다.</Typography>
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
          상세 순위
        </Typography>
      </Stack>

      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <CardContent sx={{ py: 2.5, px: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            {data.member.division && (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 36,
                  minWidth: 36,
                  px: 0.8,
                  borderRadius: "999px",
                  bgcolor: "#FAAA47",
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#000000",
                }}
              >
                {data.member.division}
              </Box>
            )}
            <Typography fontWeight={900} fontSize={20}>
              {data.member.name}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <MetricCard label="현재 순위" value={data.ranking.rank ? `${data.ranking.rank}위` : "-"} />
            <MetricCard label="레이팅" value={`${data.ranking.rating}`} />
            <MetricCard label="최근 흐름" value={formatStreak(data.ranking.streak)} />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <MetricCard label="전적" value={`${data.ranking.wins}승 ${data.ranking.losses}패`} />
            <MetricCard label="승률" value={`${data.ranking.win_rate}%`} />
            <MetricCard label="최근 경기" value={formatDate(data.ranking.last_match_at)} />
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <CardContent sx={{ py: 2.5, px: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Typography fontWeight={800} fontSize={15} sx={{ mb: 1.5 }}>
            최근 레이팅 변동
          </Typography>

          {data.recent_events.length === 0 ? (
            <Typography color="text.secondary" fontSize={14}>
              아직 반영된 경기 기록이 없습니다.
            </Typography>
          ) : (
            <Stack divider={<Divider />}>
              {data.recent_events.map((event, index) => (
                <Stack key={`${event.league_match_id ?? "event"}-${index}`} direction="row" alignItems="center" sx={{ py: 1.2 }}>
                  <Box flex={1}>
                    <Typography fontWeight={700} fontSize={14}>
                      {event.opponent_name ? `${event.opponent_name}전` : "경기 결과"}
                    </Typography>
                    <Typography sx={{ mt: 0.3, fontSize: 12, color: "text.secondary" }}>
                      {event.result === "win" ? "승리" : "패배"} · {event.match_type === "tournament" ? "토너먼트" : "리그"} · {formatDate(event.created_at)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", minWidth: 88 }}>
                    <Typography
                      fontWeight={900}
                      fontSize={16}
                      color={event.delta >= 0 ? "#16A34A" : "#DC2626"}
                    >
                      {formatDelta(event.delta)}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
                      {event.before_rating} → {event.after_rating}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: "#F9FAFB",
        borderRadius: 1,
        px: 1.2,
        py: 1.3,
        textAlign: "center",
      }}
    >
      <Typography fontWeight={900} fontSize={17}>
        {value}
      </Typography>
      <Typography sx={{ mt: 0.2, fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
  );
}
