import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useGetGroupMemberLeagueHistoryQuery } from "../../features/group/groupApi";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function getStageLabel(item: {
  has_league_stage: boolean;
  has_tournament_stage: boolean;
}) {
  if (item.has_league_stage && item.has_tournament_stage) return "리그 + 대회";
  if (item.has_tournament_stage) return "대회";
  return "리그";
}

function getStatusLabel(status?: string | null) {
  if (status === "active") return "진행중";
  if (status === "completed") return "종료";
  if (status === "draft") return "준비중";
  return status ?? "-";
}

export default function GroupMemberLeagueHistoryPage() {
  const { id: groupId, userId } = useParams<{ id: string; userId: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useGetGroupMemberLeagueHistoryQuery(
    { groupId: groupId ?? "", userId: Number(userId) },
    { skip: !groupId || !userId },
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
        <Typography color="text.secondary">참여내역을 불러올 수 없습니다.</Typography>
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
          리그·대회 참여내역
        </Typography>
      </Stack>

      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <CardContent sx={{ py: 2, px: 2.2, "&:last-child": { pb: 2 } }}>
          <Typography fontWeight={900} fontSize={15}>
            {data.member.name}
          </Typography>
          <Typography sx={{ mt: 0.4, fontSize: 12, color: "text.secondary" }}>
            총 {data.histories.length}개의 리그·대회 참여기록
          </Typography>
        </CardContent>
      </Card>

      {data.histories.length === 0 ? (
        <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <CardContent sx={{ py: 4, px: 2, "&:last-child": { pb: 4 } }}>
            <Typography textAlign="center" color="text.secondary" fontWeight={700}>
              아직 참여한 리그·대회가 없습니다.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.1}>
          {data.histories.map((item) => (
            <Card
              key={item.league_id}
              elevation={2}
              onClick={() => navigate(`/league/${item.league_id}`)}
              sx={{
                borderRadius: 1,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                cursor: "pointer",
                "&:hover": { bgcolor: "#F9FAFB" },
              }}
            >
              <CardContent sx={{ py: 1.7, px: 1.9, "&:last-child": { pb: 1.7 } }}>
                <Stack direction="row" alignItems="center" spacing={1.2}>
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.5, flexWrap: "wrap" }}>
                      <Typography fontWeight={900} fontSize={15} noWrap>
                        {item.league_name}
                      </Typography>
                      <Chip
                        size="small"
                        label={getStageLabel(item)}
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: "#EEF2FF",
                          color: "#4338CA",
                        }}
                      />
                    </Stack>

                    <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>
                      {formatDate(item.start_date)} · {item.format || item.type || "-"} · {getStatusLabel(item.status)}
                    </Typography>

                    <Typography sx={{ mt: 0.45, fontSize: 12, color: "#374151", fontWeight: 700 }}>
                      {item.matches_played}경기 · {item.wins}승 {item.losses}패
                      {item.division ? ` · ${item.division}` : ""}
                    </Typography>
                  </Box>

                  <ChevronRightIcon sx={{ color: "text.secondary" }} />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
