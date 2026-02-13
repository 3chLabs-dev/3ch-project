import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  IconButton,
  Divider,
  Collapse,
  Chip,
  CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useAppSelector } from "../../app/hooks";
import { useGetLeaguesQuery, useGetLeagueParticipantsQuery, useUpdateParticipantMutation } from "../../features/league/leagueApi";
import type { LeagueParticipantItem } from "../../features/league/leagueApi";
import ParticipantDetailDialog from "../league/ParticipantDetailDialog";
import type { Participant } from "../../features/league/leagueCreationSlice";

export default function GroupLeagueManage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const isLoggedIn = !!token;

  const [expandedLeagueId, setExpandedLeagueId] = useState<string | null>(null);
  const [participantDetailOpen, setParticipantDetailOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<{ leagueId: string; participant: LeagueParticipantItem } | null>(null);

  const { data: leagueData } = useGetLeaguesQuery(
    id ? { group_id: id } : undefined,
    { skip: !isLoggedIn || !id }
  );
  const leagues = leagueData?.leagues ?? [];

  const { data: participantData, isLoading: isLoadingParticipants, refetch: refetchParticipants } = useGetLeagueParticipantsQuery(
    expandedLeagueId ?? "",
    { skip: !expandedLeagueId }
  );
  const participants = participantData?.participants ?? [];

  const [updateParticipant] = useUpdateParticipantMutation();

  const handleToggleLeague = (leagueId: string) => {
    setExpandedLeagueId((prev) => (prev === leagueId ? null : leagueId));
  };

  const handleOpenParticipantDetail = (leagueId: string, participant: LeagueParticipantItem) => {
    setSelectedParticipant({ leagueId, participant });
    setParticipantDetailOpen(true);
  };

  const handleCloseParticipantDetail = () => {
    setParticipantDetailOpen(false);
    setSelectedParticipant(null);
  };

  const handleSaveParticipant = async (updated: Participant) => {
    if (!selectedParticipant) return;
    try {
      await updateParticipant({
        leagueId: selectedParticipant.leagueId,
        participantId: selectedParticipant.participant.id,
        updates: {
          division: updated.division,
          name: updated.name,
          paid: updated.paid,
          arrived: updated.arrived,
          footPool: updated.footPool,
        },
      }).unwrap();
      await refetchParticipants();
      handleCloseParticipantDetail();
    } catch (error) {
      console.error("Failed to update participant:", error);
    }
  };

  const formatLeagueDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const day = days[d.getDay()];
    return `${yyyy}-${mm}-${dd}(${day})`;
  };

  if (!isLoggedIn) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>로그인이 필요합니다.</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2.5} sx={{ pb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={() => navigate(`/group/${id}/manage`)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900} flex={1}>
          리그 관리
        </Typography>
      </Stack>

      {leagues.length > 0 ? (
        <Stack spacing={1}>
          {leagues.map((league) => (
            <Card key={league.id} elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Box
                  onClick={() => handleToggleLeague(league.id)}
                  sx={{ px: 2.5, py: 1.8, cursor: "pointer", "&:hover": { bgcolor: "#F9FAFB" } }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box flex={1}>
                      <Typography fontWeight={700} fontSize={15}>
                        {formatLeagueDate(league.start_date)}
                      </Typography>
                      <Typography fontSize={12} color="text.secondary" fontWeight={600}>
                        {league.type} · {league.participant_count} / {league.recruit_count}명
                      </Typography>
                    </Box>
                    <IconButton size="small">
                      {expandedLeagueId === league.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Stack>
                </Box>

                <Collapse in={expandedLeagueId === league.id} timeout="auto" unmountOnExit>
                  <Divider />
                  <Box sx={{ px: 2.5, py: 2 }}>
                    <Typography fontSize={13} fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
                      참가자 목록
                    </Typography>

                    {isLoadingParticipants ? (
                      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : participants.length > 0 ? (
                      <Stack spacing={0.8}>
                        {participants.map((participant) => (
                          <Box
                            key={participant.id}
                            onClick={() => handleOpenParticipantDetail(league.id, participant)}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              px: 1.5,
                              py: 1,
                              borderRadius: 1,
                              bgcolor: "#F9FAFB",
                              cursor: "pointer",
                              "&:hover": { bgcolor: "#F3F4F6" },
                            }}
                          >
                            {participant.division && (
                              <Chip
                                label={participant.division}
                                size="small"
                                sx={{ height: 20, fontSize: 11, fontWeight: 800 }}
                              />
                            )}
                            <Typography fontWeight={700} fontSize={14} flex={1}>
                              {participant.name}
                            </Typography>
                            <Stack direction="row" spacing={0.5}>
                              {participant.paid && <Chip label="입금" size="small" color="success" sx={{ height: 20, fontSize: 10 }} />}
                              {participant.arrived && <Chip label="도착" size="small" color="primary" sx={{ height: 20, fontSize: 10 }} />}
                              {participant.foot_pool && <Chip label="뒷풀이" size="small" color="secondary" sx={{ height: 20, fontSize: 10 }} />}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography fontSize={13} color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                        참가자가 없습니다.
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <CardContent sx={{ py: 2.5, textAlign: "center" }}>
            <Typography color="text.secondary" fontWeight={700}>
              개설된 리그가 없습니다.
            </Typography>
          </CardContent>
        </Card>
      )}

      {selectedParticipant && (
        <ParticipantDetailDialog
          key={selectedParticipant.participant.id}
          open={participantDetailOpen}
          participant={{
            division: selectedParticipant.participant.division || "",
            name: selectedParticipant.participant.name,
            paid: selectedParticipant.participant.paid,
            arrived: selectedParticipant.participant.arrived,
            footPool: selectedParticipant.participant.foot_pool,
          }}
          onClose={handleCloseParticipantDetail}
          onSave={handleSaveParticipant}
        />
      )}
    </Stack>
  );
}

