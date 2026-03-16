import React, { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setStep, setGroupId, setPreferredGroupId } from "../../features/league/leagueCreationSlice";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useGetLeaguesQuery } from "../../features/league/leagueApi";
import type { LeagueListItem } from "../../features/league/leagueApi";
import {
  Stack, Typography, Card, CardContent, Button, IconButton, Box
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { formatLeagueDate } from "../../utils/dateUtils";
import LeagueFilterDialog from "../../components/LeagueFilterDialog.tsx";

type LeagueStatus = "scheduled" | "active" | "completed";

export default function LeagueMainBody() {
  const dispatch = useAppDispatch();
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

  // 필터 조건
  const filteredLeagues = useMemo(() => {
    const leagues = leagueData?.leagues ?? [];
    const now = new Date();

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
