import React, { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setPreferredGroupId } from "../../features/league/leagueCreationSlice";
import { resetRenewalLeagueCreation, setRenewalGroupId, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useGetLeaguesQuery, useGetMyLeagueInvitationsQuery, useRespondLeagueInvitationMutation } from "../../features/league/leagueApi";
import type { LeagueListItem } from "../../features/league/leagueApi";
import {
  Stack, Typography, Card, CardContent, Button, IconButton, Box, Chip
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { formatLeagueDateTime } from "../../utils/dateUtils";
import AdFitBanner from "../../components/AdFitBanner";
import LeagueFilterDialog from "../../components/LeagueFilterDialog.tsx";
import { LOCAL_DEV_GROUP, isLocalDevToken } from "../../utils/localDevAuth";

type LeagueStatus = "scheduled" | "active" | "completed";

export default function LeagueMainBody() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const preferredGroupId = useAppSelector((s) => s.leagueCreation.preferredGroupId);
  const isLoggedIn = !!token;

  //리그 필터
  const [filterOpen, setFilterOpen] = useState(false);
  const [leagueFilterStart, setLeagueFilterStart] = useState("");
  const [leagueFilterEnd, setLeagueFilterEnd] = useState("");
  const [leagueFilterStatus, setLeagueFilterStatus] = useState<LeagueStatus[]>([
    "scheduled",
    "active",
  ]);

  const { data } = useGetMyGroupsQuery(undefined, {
    skip: !isLoggedIn,
    refetchOnMountOrArgChange: true,
  });
  const myGroups = useMemo(() => {
    const serverGroups = data?.groups ?? [];
    if (serverGroups.length > 0) return serverGroups;
    return isLocalDevToken(token) ? [LOCAL_DEV_GROUP] : [];
  }, [data, token]);

  const effectiveGroupId = useMemo(() => {
    if (!myGroups.length) return null;
    if (preferredGroupId && myGroups.some((g) => g.id === preferredGroupId)) return preferredGroupId;
    return myGroups[0].id;
  }, [myGroups, preferredGroupId]);

  const selectedGroup = effectiveGroupId
    ? myGroups.find((g) => g.id === effectiveGroupId) ?? null
    : null;

  const { data: leagueData, isLoading: leagueLoading } = useGetLeaguesQuery(
    effectiveGroupId ? { group_id: effectiveGroupId } : undefined,
    { skip: !isLoggedIn || !effectiveGroupId, refetchOnMountOrArgChange: true }
  );
  const leagues = useMemo(() => leagueData?.leagues ?? [], [leagueData]);
  const { data: invitationData } = useGetMyLeagueInvitationsQuery(undefined, { skip: !isLoggedIn, refetchOnMountOrArgChange: true });
  const [respondInvitation] = useRespondLeagueInvitationMutation();
  const invitations = invitationData?.invitations ?? [];
  const visibleInvitations = useMemo(
    () => invitations.filter((invitation) => (
      invitation.invited_group_id === effectiveGroupId || invitation.host_group_id === effectiveGroupId
    )),
    [effectiveGroupId, invitations],
  );

  const canCreate =
    isLoggedIn &&
    !!selectedGroup &&
    (selectedGroup.role === "owner" || selectedGroup.role === "admin");

  const handleCreateNewLeague = () => {
    if (!canCreate || !selectedGroup) return;
    dispatch(resetRenewalLeagueCreation());
    dispatch(setRenewalGroupId(selectedGroup.id));
    dispatch(setPreferredGroupId(selectedGroup.id));
    dispatch(setRenewalStep(1));
    navigate("/league/new");
  };

  // 필터 조건
  const filteredLeagues = useMemo(() => {
    const leagues = leagueData?.leagues ?? [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return leagues.filter((league) => {
      if (!league.start_date) return false;

      const startAt = new Date(league.start_date);
      const dateOnly = league.start_date.slice(0, 10);

      if (leagueFilterStart && dateOnly < leagueFilterStart) return false;
      if (leagueFilterEnd && dateOnly > leagueFilterEnd) return false;
      if (leagueFilterStatus.length === 0) return true;

      const isScheduled = league.status === "draft" && startAt >= now;
      const isActive = league.status === "active" && startAt >= now;
      const isCompleted = league.status === "completed" || startAt < now;

      if (isScheduled && leagueFilterStatus.includes("scheduled")) return true;
      if (isActive && leagueFilterStatus.includes("active")) return true;
      if (isCompleted && leagueFilterStatus.includes("completed")) return true;

      return false;
    });
  }, [leagueData, leagueFilterStart, leagueFilterEnd, leagueFilterStatus]);


  return (
    <Stack spacing={2.5}>
      {/* 로그인 유도 */}
      {!isLoggedIn && (
        <SoftCard>
          <Stack alignItems="center" spacing={1.2}>
            <Typography fontWeight={800}>로그인을 해주세요.</Typography>
            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              size="medium"
              sx={{ px: 3, borderRadius: 1 }}
            >
              로그인
            </Button>
          </Stack>
        </SoftCard>
      )}

      <AdFitBanner
        unitId="DAN-IYkpUS32ZIhq866m"
        width={320}
        height={50}
        sx={{ pt: 0.5 }}
      />

      {/* 리그 일정 */}
      <LeagueSectionHeader
        title="리그 일정"
        onFilterClick={leagueData && leagueData.leagues.length > 0 ? () => setFilterOpen(true) : undefined}
      />

      {!isLoggedIn || !myGroups.length ? (
        <SoftCard>
          <Typography textAlign="center" color="text.secondary" fontWeight={700}>
            {!isLoggedIn ? "로그인 후 확인할 수 있습니다." : "가입된 클럽이 없습니다."}
          </Typography>
        </SoftCard>
      ) : leagueLoading ? (
        <SoftCard>
          <Typography textAlign="center" color="text.secondary" fontWeight={700}>로딩 중...</Typography>
        </SoftCard>
      ) : leagues.length > 0 ? (
        filteredLeagues.length > 0 ? (
          <Stack spacing={1}>
            {filteredLeagues.map((league) => (
              <LeagueCard key={league.id} league={league} />
            ))}
          </Stack>
        ) : (
          <SoftCard>
            <Typography textAlign="center" color="text.secondary" fontWeight={700}>
              조건에 맞는 리그가 없습니다.
            </Typography>
          </SoftCard>
        )
      ) : (
        <SoftCard>
          <Typography textAlign="center" color="text.secondary" fontWeight={700}>
            개설된 리그가 없습니다.
          </Typography>
        </SoftCard>
      )}
      <LeagueFilterDialog
        key={filterOpen ? "open" : "closed"}
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        startDate={leagueFilterStart}
        endDate={leagueFilterEnd}
        status={leagueFilterStatus}
        onApply={({ startDate, endDate, status }) => {
          setLeagueFilterStart(startDate);
          setLeagueFilterEnd(endDate);
          setLeagueFilterStatus(status);
        }}
      />

      {canCreate && (
        <Stack spacing={1}>
          <Button
            fullWidth variant="contained" disableElevation
            onClick={handleCreateNewLeague}
            sx={{ borderRadius: 1, fontWeight: 700 }}
          >
            신규 생성
          </Button>
        </Stack>
      )}

      {isLoggedIn && visibleInvitations.length > 0 && (
        <>
          <LeagueSectionHeader title="초대된 리그" />
          <Stack spacing={1}>
            {visibleInvitations.map((invitation) => (
              <Card key={invitation.invitation_id} elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography sx={{ fontWeight: 800 }}>{invitation.title ?? invitation.name}</Typography>
                    {[invitation.host_group_name, ...(invitation.invited_group_names ?? [])]
                      .filter((name, index, names): name is string => Boolean(name) && name !== invitation.invited_group_name && names.indexOf(name) === index)
                      .map((name) => <Chip key={name} label={name} size="small" sx={{ height: 21, bgcolor: "#F3E8FF", color: "#7C3AED", fontSize: 11, fontWeight: 800 }} />)}
                  </Stack>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{invitation.host_group_name} · {formatLeagueDateTime(invitation.start_date)}</Typography>
                  {invitation.invitation_status === "pending" && (invitation.my_role === "owner" || invitation.my_role === "admin") ? (
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Button fullWidth variant="outlined" onClick={() => respondInvitation({ invitationId: invitation.invitation_id, status: "declined" })}>거절</Button>
                      <Button fullWidth variant="contained" disableElevation onClick={() => respondInvitation({ invitationId: invitation.invitation_id, status: "accepted" })}>수락</Button>
                    </Stack>
                  ) : (
                    <Button fullWidth variant="outlined" sx={{ mt: 1.5 }} onClick={() => navigate(`/league/${invitation.league_code ?? invitation.id}`)}>리그 보기</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      )}

      {/* 대회 일정 */}
      <SectionHeader title="대회 일정" />

      <SoftCard>
        <Typography textAlign="center" color="text.secondary" fontWeight={700}>
          {!isLoggedIn ? "로그인 후 확인할 수 있습니다." : "개설된 대회가 없습니다."}
        </Typography>
      </SoftCard>

      {isLoggedIn && (
        <Button
          fullWidth variant="contained" disableElevation
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          신규 생성
        </Button>
      )}
    </Stack>
  );
}

type LeagueSectionHeaderProps = {
  title: string;
  onFilterClick?: () => void;
};

function LeagueSectionHeader({ title, onFilterClick }: LeagueSectionHeaderProps) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
      <Typography variant="subtitle1" fontWeight={900}>
        {title}
      </Typography>
      {onFilterClick ? (
        <IconButton size="small" onClick={onFilterClick} sx={{ width: 32, height: 32 }}>
          <TuneIcon fontSize="small" />
        </IconButton>
      ) : (
        <Box sx={{ width: 32, height: 32 }} />
      )}
    </Stack>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
      <Typography variant="subtitle1" fontWeight={900}>
        {title}
      </Typography>
      <IconButton size="small">
        <TuneIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function LeagueCard({ league }: { league: LeagueListItem }) {
  const navigate = useNavigate();
  return (
    <Card
      elevation={2}
      onClick={() => navigate(`/league/${league.league_code ?? league.id}`)}
      sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer" }}
    >
      <CardContent sx={{ py: 1.8, px: 2.5, "&:last-child": { pb: 1.8 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography fontWeight={700} fontSize={15}>{league.title}</Typography>
              {(league.invited_group_names ?? []).map((name) => <Chip key={name} label={name} size="small" sx={{ height: 21, bgcolor: "#F3E8FF", color: "#7C3AED", fontSize: 11, fontWeight: 800 }} />)}
            </Stack>
            <Typography fontSize={12} color="text.secondary">
              {formatLeagueDateTime(league.start_date)}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {league.participant_count} / {league.recruit_count}명
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SoftCard({ children }: { children: React.ReactNode }) {
  return (
    <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <CardContent sx={{
        minHeight: 80,
        py: 2.5, px: 2,
        display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
        "&:last-child": { pb: 2.5 },
      }}>
        {children}
      </CardContent>
    </Card>
  );
}
