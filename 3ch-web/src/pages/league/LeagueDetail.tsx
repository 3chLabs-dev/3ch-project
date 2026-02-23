import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Divider,
  CircularProgress,
  TextField,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import IosShareIcon from "@mui/icons-material/IosShare";
import {
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery,
  useUpdateParticipantMutation,
  useUpdateLeagueMutation,
} from "../../features/league/leagueApi";

function formatDate(iso: string) {
  const d = new Date(iso);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}(${days[d.getDay()]})`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function parseLocation(description?: string) {
  if (!description) return "-";
  return description.startsWith("장소: ") ? description.slice(4) : description;
}

const infoRowSx = {
  display: "grid",
  gridTemplateColumns: "72px 1fr",
  alignItems: "center",
  py: 0.7,
};

const labelSx = { fontSize: 13, fontWeight: 700, color: "#6B7280" };
const valueSx = { fontSize: 13, fontWeight: 700 };

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");

  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id ?? "", {
    skip: !id,
  });
  const { data: participantData, isLoading: participantsLoading } = useGetLeagueParticipantsQuery(
    id ?? "",
    { skip: !id },
  );

  const [updateParticipant] = useUpdateParticipantMutation();
  const [updateLeague, { isLoading: starting }] = useUpdateLeagueMutation();

  const league = leagueData?.league;
  const participants = participantData?.participants ?? [];

  const handleToggle = (
    participantId: string,
    field: "paid" | "arrived" | "after",
    current: boolean,
  ) => {
    if (!id) return;
    updateParticipant({
      leagueId: id,
      participantId,
      updates: { [field]: !current },
    });
  };

  const handleStart = () => {
    if (!id) return;
    updateLeague({ id, updates: { status: "active" } });
  };

  if (leagueLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!league) {
    return (
      <Box sx={{ pt: 4, textAlign: "center" }}>
        <Typography fontWeight={700} color="text.secondary">
          리그 정보를 불러올 수 없습니다.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography fontWeight={900} fontSize={18} sx={{ flex: 1 }}>
          리그 상세
        </Typography>
        <IconButton size="small">
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small">
          <IosShareIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* 리그 정보 */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: 1,
          border: "1px solid #E5E7EB",
          px: 2,
          py: 1,
          mb: 2.5,
        }}
      >
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>날 짜</Typography>
          <Typography sx={valueSx}>{formatDate(league.start_date)}</Typography>
        </Box>
        <Divider sx={{ borderColor: "#F3F4F6" }} />
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>시 간</Typography>
          <Typography sx={valueSx}>{formatTime(league.start_date)}</Typography>
        </Box>
        <Divider sx={{ borderColor: "#F3F4F6" }} />
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>장 소</Typography>
          <Typography sx={valueSx}>{parseLocation(league.description)}</Typography>
        </Box>
        <Divider sx={{ borderColor: "#F3F4F6" }} />
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>유 형</Typography>
          <Typography sx={valueSx}>{league.type}</Typography>
        </Box>
        {league.format && (
          <>
            <Divider sx={{ borderColor: "#F3F4F6" }} />
            <Box sx={infoRowSx}>
              <Typography sx={labelSx}>방 식</Typography>
              <Typography sx={valueSx}>{league.format}</Typography>
            </Box>
          </>
        )}
        {league.rules && (
          <>
            <Divider sx={{ borderColor: "#F3F4F6" }} />
            <Box sx={infoRowSx}>
              <Typography sx={labelSx}>규 칙</Typography>
              <Typography sx={valueSx}>{league.rules}</Typography>
            </Box>
          </>
        )}
      </Box>

      {/* 참가자 */}
      <Box sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
          <Typography fontWeight={900} fontSize={16}>
            참가자
          </Typography>
          <Typography fontSize={13} fontWeight={700} color="text.secondary">
            {participants.length}명
          </Typography>
        </Stack>

        <Box
          sx={{
            bgcolor: "#fff",
            borderRadius: 1,
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {/* 헤더 행 */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 130px",
              px: 1.5,
              py: 0.8,
              bgcolor: "#F9FAFB",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>부수</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>이름</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>상태</Typography>
          </Box>

          {participantsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : participants.length === 0 ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <Typography fontSize={13} fontWeight={700} color="text.secondary">
                참가자가 없습니다.
              </Typography>
            </Box>
          ) : (
            participants.map((p, idx) => (
              <Box
                key={p.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr 130px",
                  alignItems: "center",
                  px: 1.5,
                  py: 0.9,
                  borderTop: idx === 0 ? "none" : "1px solid #F3F4F6",
                }}
              >
                {/* 부수 */}
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 22,
                      px: 1,
                      borderRadius: 999,
                      bgcolor: "#E5E7EB",
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#111827",
                      minWidth: 28,
                    }}
                  >
                    {p.division || "-"}
                  </Box>
                </Box>

                {/* 이름 */}
                <Typography fontWeight={800} fontSize={14} sx={{ textAlign: "center" }}>
                  {p.name}
                </Typography>

                {/* 상태 버튼 */}
                <Stack direction="row" spacing={0.5} justifyContent="center">
                  {(
                    [
                      { key: "paid", label: "입금", value: p.paid },
                      { key: "arrived", label: "도착", value: p.arrived },
                      { key: "after", label: "뒷풀이", value: p.after },
                    ] as const
                  ).map(({ key, label, value }) => (
                    <Box
                      key={key}
                      onClick={() => handleToggle(p.id, key, value)}
                      sx={{
                        height: 24,
                        px: 0.8,
                        borderRadius: 0.6,
                        border: `1px solid ${value ? "#27AE60" : "#D1D5DB"}`,
                        bgcolor: value ? "#ECFDF5" : "#F9FAFB",
                        color: value ? "#16A34A" : "#9CA3AF",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        "&:hover": { opacity: 0.8 },
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))
          )}
        </Box>

        {/* 대진표 생성하기 */}
        <Button
          fullWidth
          variant="contained"
          disableElevation
          sx={{
            mt: 1.5,
            borderRadius: 1,
            height: 40,
            fontWeight: 700,
            bgcolor: "#87B8FF",
            "&:hover": { bgcolor: "#79AEFF" },
          }}
          onClick={() => {/* TODO */}}
        >
          대진표 생성하기
        </Button>
      </Box>

      {/* 안내사항 */}
      <Box sx={{ mb: 2.5 }}>
        <Typography fontWeight={900} fontSize={16} sx={{ mb: 1 }}>
          안내사항
        </Typography>
        <TextField
          multiline
          rows={3}
          fullWidth
          placeholder="안내사항을 입력하세요"
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 1,
              bgcolor: "#fff",
              fontSize: 13,
            },
          }}
        />
      </Box>

      {/* 리그 시작 */}
      <Button
        fullWidth
        variant="contained"
        disableElevation
        onClick={handleStart}
        disabled={starting || league.status === "active"}
        sx={{
          borderRadius: 1,
          height: 40,
          fontWeight: 700,
          fontSize: 14,
          bgcolor: "#2F80ED",
          "&:hover": { bgcolor: "#256FD1" },
          "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" },
        }}
      >
        {league.status === "active" ? "리그 진행 중" : "리그 시작"}
      </Button>
    </Box>
  );
}
