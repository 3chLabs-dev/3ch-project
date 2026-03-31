import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, IconButton, Stack, Typography, Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  useGetLeagueQuery,
  useGetLeagueMatchesQuery,
  useDeleteAllLeagueMatchesMutation,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { formatLeagueDate } from "../../utils/dateUtils";

const ADVANCEMENT_LABEL: Record<string, string> = {
  "upper-only":  "상위 진출",
  "upper-lower": "상·하위 진출",
};

const SEEDING_LABEL: Record<string, string> = {
  manual: "수동",
  seed:   "시드",
  random: "랜덤",
};

function getBracketSizeLabel(matchLabel: string | null | undefined): string {
  return matchLabel ?? "";
}

export default function LeagueTournamentList() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id!);
  const { data: matchesData, isLoading: matchesLoading } = useGetLeagueMatchesQuery(id!);
  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(
    leagueData?.league?.group_id ?? "",
    { skip: !leagueData?.league?.group_id },
  );
  const [deleteAllMatches, { isLoading: isDeleting }] = useDeleteAllLeagueMatchesMutation();

  const [confirmOpen, setConfirmOpen] = useState(false);

  const league = leagueData?.league;
  const matches = matchesData?.matches ?? [];

  const hasTournament = matches.some((m) => m.bracket);
  const r1Match = matches.find((m) => m.round_number === 1 && m.bracket === "upper");
  const bracketSizeLabel = getBracketSizeLabel(r1Match?.match_label);
  const advancementLabel = ADVANCEMENT_LABEL[league?.tournament_advancement ?? ""] ?? "";
  const seedingLabel = SEEDING_LABEL[league?.tournament_seeding ?? ""] ?? "";

  const canManage = !groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin");

  const handleDelete = async () => {
    setConfirmOpen(false);
    await deleteAllMatches({ leagueId: id! });
  };

  const isLoading = leagueLoading || matchesLoading || groupLoading;

  // 비관리자 + 대진표 있음 → 바로 브래킷으로 이동
  useEffect(() => {
    if (!isLoading && !canManage && hasTournament) {
      navigate(`/league/${id}/tournament/bracket`, { replace: true });
    }
  }, [isLoading, canManage, hasTournament, id, navigate]);

  if (isLoading || (!canManage && hasTournament)) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", pb: 8 }}>

      {/* ── 헤더 ── */}
      <Stack direction="row" alignItems="center" sx={{ px: 1, pt: 1.5, pb: 1 }}>
        <IconButton size="small" onClick={() => navigate(-1)} sx={{ mr: 0.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: 17, fontWeight: 900, flex: 1 }}>
          토너먼트 대진표
        </Typography>
        {canManage && !hasTournament && (
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            onClick={() => navigate(`/league/${id}/tournament/new`)}
            sx={{
              borderRadius: "20px", fontSize: 12, fontWeight: 700,
              px: 1.5, height: 32, textTransform: "none", boxShadow: "none",
              bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            생성
          </Button>
        )}
      </Stack>

      {/* ── 리그 정보 칩 ── */}
      {league && (
        <Stack direction="row" spacing={0.75} sx={{ px: 2, pb: 2, flexWrap: "wrap" }}>
          <Chip
            label={formatLeagueDate(league.start_date)}
            size="small"
            sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F1F5F9", color: "#475569", height: 24 }}
          />
          {league.type && (
            <Chip
              label={league.type}
              size="small"
              sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F1F5F9", color: "#475569", height: 24 }}
            />
          )}
          {league.rules && (
            <Chip
              label={league.rules}
              size="small"
              sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F1F5F9", color: "#475569", height: 24 }}
            />
          )}
        </Stack>
      )}

      <Box sx={{ px: 2 }}>
        {/* ── 대진표 카드 ── */}
        {hasTournament && league ? (
          <Box
            sx={{
              bgcolor: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}
          >
            {/* 카드 상단 컬러 바 */}
            <Box sx={{ height: 4, bgcolor: "#2563EB", borderRadius: "8px 8px 0 0" }} />

            <Box sx={{ px: 2.5, pt: 2, pb: 2 }}>
              {/* 아이콘 + 제목 */}
              <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: 2,
                  bgcolor: "#EFF6FF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <AccountTreeOutlinedIcon sx={{ fontSize: 20, color: "#2563EB" }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>
                    {league.type} 토너먼트
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#94A3B8", mt: 0.2 }}>
                    {formatLeagueDate(league.start_date)}
                  </Typography>
                </Box>
              </Stack>

              {/* 태그 */}
              <Stack direction="row" spacing={0.75} flexWrap="wrap" mb={2}>
                {bracketSizeLabel && (
                  <Chip
                    label={bracketSizeLabel}
                    size="small"
                    sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#EFF6FF", color: "#2563EB", height: 22, border: "1px solid #BFDBFE" }}
                  />
                )}
                {advancementLabel && (
                  <Chip
                    label={advancementLabel}
                    size="small"
                    sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F5F3FF", color: "#7C3AED", height: 22, border: "1px solid #DDD6FE" }}
                  />
                )}
                {seedingLabel && (
                  <Chip
                    label={`편성: ${seedingLabel}`}
                    size="small"
                    sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F0FDF4", color: "#16A34A", height: 22, border: "1px solid #BBF7D0" }}
                  />
                )}
              </Stack>

              {/* 액션 버튼 */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  disableElevation
                  endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
                  onClick={() => navigate(`/league/${id}/tournament/bracket`)}
                  sx={{
                    flex: 1, height: 40, fontWeight: 700, fontSize: 13,
                    borderRadius: 1.5, textTransform: "none", boxShadow: "none",
                    bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" },
                  }}
                >
                  대진표 보기
                </Button>
                {canManage && (
                  <>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/league/${id}/tournament/new?force=true`)}
                      sx={{
                        width: 40, height: 40, border: "1px solid #E5E7EB",
                        borderRadius: 1.5, color: "#6B7280",
                        "&:hover": { bgcolor: "#F9FAFB" },
                      }}
                    >
                      <EditOutlinedIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setConfirmOpen(true)}
                      disabled={isDeleting}
                      sx={{
                        width: 40, height: 40, border: "1px solid #FEE2E2",
                        borderRadius: 1.5, color: "#EF4444",
                        "&:hover": { bgcolor: "#FFF5F5" },
                      }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </>
                )}
              </Stack>
            </Box>
          </Box>
        ) : (
          /* ── 빈 상태 ── */
          <Box
            sx={{
              bgcolor: "#fff",
              border: "1.5px dashed #E5E7EB",
              borderRadius: 2,
              py: 6,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
            }}
          >
            <Box sx={{
              width: 52, height: 52, borderRadius: "50%",
              bgcolor: "#F1F5F9",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AccountTreeOutlinedIcon sx={{ fontSize: 26, color: "#94A3B8" }} />
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                대진표가 없습니다
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#9CA3AF", mt: 0.3 }}>
                {canManage ? "토너먼트 대진표를 생성해 주세요." : "아직 대진표가 생성되지 않았습니다."}
              </Typography>
            </Box>
            {canManage && (
              <Button
                variant="contained"
                disableElevation
                startIcon={<AddIcon />}
                onClick={() => navigate(`/league/${id}/tournament/new`)}
                sx={{
                  mt: 0.5, borderRadius: 1.5, fontWeight: 700, fontSize: 13,
                  textTransform: "none", boxShadow: "none",
                  bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" },
                }}
              >
                토너먼트 생성
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* ── 삭제 확인 다이얼로그 ── */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>대진표 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>
            생성된 대진표를 삭제하면 모든 경기 기록이 사라집니다. 계속하시겠습니까?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ color: "text.secondary", fontWeight: 700 }}>
            취소
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            disableElevation
            sx={{ bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" }, fontWeight: 700, borderRadius: 1 }}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
