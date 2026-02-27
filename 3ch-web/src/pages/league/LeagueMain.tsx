import React, { useMemo } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setStep, setGroupId, setPreferredGroupId } from "../../features/league/leagueCreationSlice";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useGetLeaguesQuery } from "../../features/league/leagueApi";
import type { LeagueListItem } from "../../features/league/leagueApi";
import {
  Stack, Typography, Card, CardContent, Button, IconButton,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { formatLeagueDate } from "../../utils/dateUtils";

export default function LeagueMainBody() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const preferredGroupId = useAppSelector((s) => s.leagueCreation.preferredGroupId);
  const isLoggedIn = !!token;

  const { data } = useGetMyGroupsQuery(undefined, {
    skip: !isLoggedIn,
    refetchOnMountOrArgChange: true,
  });
  const myGroups = useMemo(() => data?.groups ?? [], [data]);

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

  const canCreate =
    isLoggedIn &&
    !!selectedGroup &&
    (selectedGroup.role === "owner" || selectedGroup.role === "admin");

  const handleCreateNewLeague = () => {
    if (!canCreate || !selectedGroup) return;
    dispatch(setGroupId(selectedGroup.id));
    dispatch(setPreferredGroupId(selectedGroup.id));
    dispatch(setStep(1));
  };

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

      {/* 리그 일정 */}
      <SectionHeader title="리그 일정" />

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
        <Stack spacing={1}>
          {leagues.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </Stack>
      ) : (
        <SoftCard>
          <Typography textAlign="center" color="text.secondary" fontWeight={700}>
            개설된 리그가 없습니다.
          </Typography>
        </SoftCard>
      )}

      {canCreate && (
        <Button
          fullWidth variant="contained" disableElevation
          onClick={handleCreateNewLeague}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          신규 생성
        </Button>
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
      onClick={() => navigate(`/league/${league.id}`)}
      sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer" }}
    >
      <CardContent sx={{ py: 1.8, px: 2.5, "&:last-child": { pb: 1.8 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight={700} fontSize={15}>
            {formatLeagueDate(league.start_date)}
          </Typography>
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
