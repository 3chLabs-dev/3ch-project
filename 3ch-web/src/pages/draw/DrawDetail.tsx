import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useGetDrawDetailQuery } from "../../features/draw/drawApi";

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}(${wd}) ${h}:${min}`;
}

export default function DrawDetail() {
  const { leagueId, drawId } = useParams<{ leagueId: string; drawId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useGetDrawDetailQuery(
    { leagueId: leagueId ?? "", drawId: drawId ?? "" },
    { skip: !leagueId || !drawId },
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Stack spacing={2} sx={{ pt: 4, textAlign: "center" }}>
        <Typography color="error" fontWeight={700}>추첨 정보를 불러올 수 없습니다.</Typography>
      </Stack>
    );
  }

  const { draw, prizes } = data;

  return (
    <Stack spacing={2.2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate(`/draw/${leagueId}`, { replace: true })} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={900} fontSize={20} noWrap>{draw.name}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {formatDate(draw.created_at)}
          </Typography>
        </Box>
      </Stack>

      {prizes.length === 0 ? (
        <Card elevation={2} sx={{ borderRadius: 1 }}>
          <CardContent sx={{ py: 3, textAlign: "center", "&:last-child": { pb: 3 } }}>
            <Typography color="text.secondary" fontWeight={700}>경품이 없습니다.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {prizes.map((prize, idx) => (
            <Card key={prize.id} elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              <CardContent sx={{ py: 1.5, px: 1.8, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Chip
                    label={`${idx + 1}`}
                    size="small"
                    sx={{ height: 22, fontWeight: 800, bgcolor: "#EEF2FF", color: "#2F80ED" }}
                  />
                  <Typography fontWeight={900} fontSize={15} sx={{ flex: 1 }}>
                    {prize.prize_name}
                  </Typography>
                  <Chip
                    label={`${prize.quantity}명`}
                    size="small"
                    sx={{ height: 22, fontWeight: 700 }}
                  />
                </Stack>

                <Divider sx={{ mb: 1 }} />

                {!prize.winners || prize.winners.length === 0 ? (
                  <Typography color="text.secondary" fontSize={13} fontWeight={700}>
                    당첨자 없음
                  </Typography>
                ) : (
                  <Stack spacing={0.7}>
                    {prize.winners.map((w, wi) => (
                      <Stack key={w.id} direction="row" alignItems="center" spacing={1}>
                        <Chip
                          label={`${wi + 1}위`}
                          size="small"
                          sx={{ height: 22, fontWeight: 800, minWidth: 36 }}
                        />
                        {w.participant_division && (
                          <Chip
                            label={w.participant_division}
                            size="small"
                            sx={{ height: 22, fontWeight: 700 }}
                          />
                        )}
                        <Typography fontWeight={800} fontSize={15}>
                          {w.participant_name}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
