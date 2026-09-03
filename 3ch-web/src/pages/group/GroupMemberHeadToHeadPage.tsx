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
import { useGetGroupMemberHeadToHeadQuery } from "../../features/group/groupApi";

function formatDate(value?: string | null) {
  return value ? value.slice(0, 10) : "-";
}

export default function GroupMemberHeadToHeadPage() {
  const { id: groupId, userId } = useParams<{ id: string; userId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useGetGroupMemberHeadToHeadQuery(
    { groupId: groupId ?? "", userId: Number(userId) },
    { skip: !groupId || !userId },
  );

  if (isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  }

  if (!data) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">상대전적을 불러올 수 없습니다.</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2.5} sx={{ pb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={() => navigate(-1)} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h6" fontWeight={900} flex={1}>상대전적</Typography>
      </Stack>

      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <CardContent sx={{ py: 2.2, px: 2.3, "&:last-child": { pb: 2.2 } }}>
          <Typography fontWeight={900} fontSize={17}>
            <Box component="span" sx={{ color: "#2563EB" }}>{data.requester.name}</Box>
            <Box component="span" sx={{ color: "text.secondary", mx: 0.7 }}>vs</Box>
            <Box component="span">{data.opponent.name}</Box>
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
            <Chip label={`${data.summary.matches_played}경기`} sx={{ fontWeight: 800 }} />
            <Chip label={`${data.summary.wins}승`} sx={{ bgcolor: "#E8F5E9", color: "#1B5E20", fontWeight: 800 }} />
            <Chip label={`${data.summary.losses}패`} sx={{ bgcolor: "#F3F4F6", color: "#4B5563", fontWeight: 800 }} />
          </Stack>
        </CardContent>
      </Card>

      {data.matches.length === 0 ? (
        <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <CardContent sx={{ py: 4, px: 2, "&:last-child": { pb: 4 } }}>
            <Typography textAlign="center" color="text.secondary" fontWeight={700}>
              리그에서 맞붙은 단식 경기 기록이 없습니다.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.2}>
          {data.matches.map((match) => {
            const requesterWon = match.winner === "requester";
            return (
              <Card key={match.match_id} elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <CardContent sx={{ py: 1.9, px: 2, "&:last-child": { pb: 1.9 } }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Box flex={1} minWidth={0}>
                      <Typography fontWeight={900} fontSize={15}>{match.league_name}</Typography>
                      <Typography sx={{ mt: 0.35, fontSize: 12, color: "text.secondary", fontWeight: 600 }}>
                        {formatDate(match.match_date)}
                      </Typography>
                      <MatchScoreLine
                        requesterName={data.requester.name}
                        opponentName={data.opponent.name}
                        requesterScore={match.requester_score}
                        opponentScore={match.opponent_score}
                        requesterWon={requesterWon}
                      />
                      <Box sx={{ mt: 1, p: 1, border: "1px solid #E5E7EB", borderRadius: 1.5, bgcolor: "#F9FAFB" }}>
                        <Stack direction="row" alignItems="center" spacing={0.6} useFlexGap flexWrap="wrap">
                          {match.round_label && (
                            <Typography sx={{ mr: 0.25, fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                              {match.round_label}
                            </Typography>
                          )}
                          {match.stage !== "리그" && <ProgramMetaChip label={match.stage} tone="stage" />}
                          <ProgramMetaChip label={match.event_type} tone="event" />
                          <ProgramMetaChip label={match.format} tone="format" />
                          <ProgramMetaChip label={match.match_rule} tone="rule" />
                        </Stack>
                      </Box>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

const metaChipColors = {
  stage: { bgcolor: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  event: { bgcolor: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  format: { bgcolor: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  rule: { bgcolor: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
} as const;

function ProgramMetaChip({ label, tone }: { label: string; tone: keyof typeof metaChipColors }) {
  const colors = metaChipColors[tone];
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 22,
        fontSize: 11,
        fontWeight: 800,
        bgcolor: colors.bgcolor,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    />
  );
}

function MatchScoreLine({
  requesterName,
  opponentName,
  requesterScore,
  opponentScore,
  requesterWon,
}: {
  requesterName: string;
  opponentName: string;
  requesterScore: number;
  opponentScore: number;
  requesterWon: boolean;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      spacing={1.1}
      sx={{
        mt: 1.15,
        px: 1.25,
        py: 1,
        borderRadius: 1.5,
        bgcolor: "#F9FAFB",
        border: "1px solid #E5E7EB",
      }}
    >
      <Typography noWrap sx={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: 13, fontWeight: 900, color: requesterWon ? "#15803D" : "#374151" }}>
        {requesterName}
      </Typography>
      <Typography sx={{ minWidth: 20, textAlign: "center", fontSize: 21, lineHeight: 1, fontWeight: 900, color: requesterWon ? "#15803D" : "#111827" }}>
        {requesterScore}
      </Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#94A3B8" }}>vs</Typography>
      <Typography sx={{ minWidth: 20, textAlign: "center", fontSize: 21, lineHeight: 1, fontWeight: 900, color: requesterWon ? "#111827" : "#15803D" }}>
        {opponentScore}
      </Typography>
      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 900, color: requesterWon ? "#374151" : "#15803D" }}>
        {opponentName}
      </Typography>
    </Stack>
  );
}
