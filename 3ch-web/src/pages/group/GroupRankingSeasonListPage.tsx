import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  useDeleteGroupRankingSeasonMutation,
  useGetGroupDetailQuery,
  useGetGroupRankingSeasonsQuery,
} from "../../features/group/groupApi";
import GroupRankingSeasonDialog from "./GroupRankingSeasonDialog";

function seasonStatus(startDate: string, endDate: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return { label: "예정", color: "default" as const };
  if (today > endDate) return { label: "종료", color: "default" as const };
  return { label: "진행 중", color: "primary" as const };
}

export default function GroupRankingSeasonListPage() {
  const { id: groupId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>();
  const { data, isLoading } = useGetGroupRankingSeasonsQuery(groupId, { skip: !groupId });
  const { data: groupData } = useGetGroupDetailQuery(groupId, { skip: !groupId });
  const [deleteSeason, { isLoading: isDeleting }] = useDeleteGroupRankingSeasonMutation();
  const canManage = groupData?.myRole === "owner"
    || (groupData?.myRole === "admin" && groupData.myPermissions?.ranking === true);

  const openSeason = (seasonId?: string) => {
    setSelectedSeasonId(seasonId);
    setDialogOpen(true);
  };

  const removeSeason = async (seasonId: string, seasonName: string) => {
    if (!window.confirm(`${seasonName}을 삭제하시겠습니까?\n경기 결과는 삭제되지 않습니다.`)) return;
    await deleteSeason({ groupId, seasonId }).unwrap();
  };

  return (
    <Stack spacing={2.25} sx={{ pb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton size="small" onClick={() => navigate(`/club/${groupId}/ranking`)} aria-label="순위로 돌아가기">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900} flex={1}>순위 시즌 설정</Typography>
      </Stack>

      {canManage && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openSeason()}
          sx={{ alignSelf: "flex-start", borderRadius: 1.5, fontWeight: 800 }}
        >
          시즌 생성
        </Button>
      )}

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : (
        <Stack spacing={1.2}>
          {data?.seasons.map((season) => {
            const status = seasonStatus(season.start_date, season.end_date);
            return (
              <Card
                key={season.id}
                elevation={1}
                onClick={() => openSeason(season.id)}
                sx={{ borderRadius: 2, px: 2, py: 1.5, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.07)" }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.35 }}>
                      <Typography fontWeight={900} noWrap>● {season.name}</Typography>
                      <Chip label={status.label} size="small" color={status.color} />
                      {season.is_display_default && <Chip label="기본" size="small" color="primary" variant="outlined" sx={{ bgcolor: "#fff" }} />}
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                      {season.start_date} ~ {season.end_date}
                    </Typography>
                    {season.auto_renew && <Typography sx={{ mt: 0.25, fontSize: 11.5, color: "primary.main", fontWeight: 700 }}>자동 연장</Typography>}
                  </Box>
                  {canManage && !season.is_default && (
                    <IconButton
                      size="small"
                      color="error"
                      disabled={isDeleting}
                      aria-label={`${season.name} 삭제`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeSeason(season.id, season.name);
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                  <ChevronRightIcon sx={{ color: "text.disabled" }} />
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}

      <GroupRankingSeasonDialog
        open={dialogOpen}
        groupId={groupId}
        seasonId={selectedSeasonId}
        onClose={() => {
          setDialogOpen(false);
          setSelectedSeasonId(undefined);
        }}
        onCreated={(seasonId) => setSelectedSeasonId(seasonId)}
      />
    </Stack>
  );
}
