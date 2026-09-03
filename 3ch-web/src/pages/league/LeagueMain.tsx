import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setPreferredGroupId } from "../../features/league/leagueCreationSlice";
import { resetRenewalLeagueCreation, setRenewalGroupId, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";
import { useGetGroupRankingSeasonsQuery, useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useGetDiscoverLeaguesQuery, useGetMyGroupLeaguesQuery, useGetMyLeagueInvitationsQuery, useRespondLeagueInvitationMutation } from "../../features/league/leagueApi";
import type { LeagueListItem } from "../../features/league/leagueApi";
import {
  Stack, Typography, Card, CardContent, Button, IconButton, Box, Chip, Divider, MenuItem, TextField
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { formatLeagueDateTime } from "../../utils/dateUtils";
import AdFitBanner from "../../components/AdFitBanner";
import LeagueFilterDialog from "../../components/LeagueFilterDialog.tsx";
import { getLocalDevProfileByToken } from "../../utils/localDevAuth";
import LeagueCalendarDialog from "../../components/LeagueCalendarDialog";
import { getLeagueClubColor } from "../../features/league/leagueScheduleColors";

type LeagueStatus = "scheduled" | "active" | "completed";

export default function LeagueMainBody() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const preferredGroupId = useAppSelector((s) => s.leagueCreation.preferredGroupId);
  const isLoggedIn = !!token;

  //리그 필터
  const [filterOpen, setFilterOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedScheduleGroupIds, setSelectedScheduleGroupIds] = useState<string[]>([]);
  const [selectedScheduleSeasonId, setSelectedScheduleSeasonId] = useState("");
  const [leagueFilterStart, setLeagueFilterStart] = useState("");
  const [leagueFilterEnd, setLeagueFilterEnd] = useState("");
  const [leagueFilterStatus, setLeagueFilterStatus] = useState<LeagueStatus[]>([
    "scheduled",
    "active",
  ]);
  const [visibleLeagueCounts, setVisibleLeagueCounts] = useState<Record<string, number>>({});

  const { data } = useGetMyGroupsQuery(undefined, {
    skip: !isLoggedIn,
    refetchOnMountOrArgChange: true,
  });
  const myGroups = useMemo(() => {
    const serverGroups = data?.groups ?? [];
    if (serverGroups.length > 0) return serverGroups;
    const localProfile = getLocalDevProfileByToken(token);
    return localProfile ? [localProfile.group] : [];
  }, [data, token]);

  const effectiveGroupId = useMemo(() => {
    if (!myGroups.length) return null;
    if (preferredGroupId && myGroups.some((g) => g.id === preferredGroupId)) return preferredGroupId;
    return myGroups[0].id;
  }, [myGroups, preferredGroupId]);

  const selectedGroup = effectiveGroupId
    ? myGroups.find((g) => g.id === effectiveGroupId) ?? null
    : null;

  const singleScheduleGroupId = selectedScheduleGroupIds.length === 1
    ? selectedScheduleGroupIds[0]
    : "";
  const { data: scheduleSeasonData } = useGetGroupRankingSeasonsQuery(singleScheduleGroupId, {
    skip: !singleScheduleGroupId,
  });
  const scheduleSeasons = scheduleSeasonData?.seasons ?? [];
  const selectedScheduleSeason = useMemo(() => {
    if (!singleScheduleGroupId || scheduleSeasons.length === 0) return null;
    return scheduleSeasons.find((season) => season.id === selectedScheduleSeasonId)
      ?? scheduleSeasons.find((season) => season.is_display_default)
      ?? scheduleSeasons.find((season) => {
        const today = new Date().toISOString().slice(0, 10);
        return season.start_date <= today && season.end_date >= today;
      })
      ?? scheduleSeasons[0];
  }, [scheduleSeasons, selectedScheduleSeasonId, singleScheduleGroupId]);

  useEffect(() => {
    if (selectedScheduleGroupIds.length !== 1) setSelectedScheduleSeasonId("");
  }, [selectedScheduleGroupIds]);

  const { data: leagueData, isLoading: leagueLoading } = useGetMyGroupLeaguesQuery(
    undefined,
    { skip: !isLoggedIn || !myGroups.length, refetchOnMountOrArgChange: true }
  );
  const leagues = useMemo(() => leagueData?.leagues ?? [], [leagueData]);
  const { data: discoverData, isLoading: discoverLoading } = useGetDiscoverLeaguesQuery({ limit: 20 });
  const premiumLeagues = useMemo(() => (discoverData?.leagues ?? []).filter((league) => league.premium_enabled), [discoverData]);
  const nearbyLeagues = useMemo(() => (discoverData?.leagues ?? []).filter((league) => !league.premium_enabled), [discoverData]);
  const calendarGroups = useMemo(() => {
    const groups: Array<{ id: string; name: string }> = myGroups.map(({ id, name }) => ({ id, name }));
    (discoverData?.leagues ?? []).forEach((league) => {
      if (league.group_id && !groups.some((group) => group.id === league.group_id)) {
        groups.push({ id: league.group_id, name: league.group_name ?? "주변 클럽" });
      }
    });
    return groups;
  }, [discoverData, myGroups]);
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
    (selectedGroup.role === "owner"
      || (selectedGroup.role === "admin" && selectedGroup.management_permissions?.league === true));

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
      if (selectedScheduleGroupIds.length > 0 && (!league.group_id || !selectedScheduleGroupIds.includes(league.group_id))) return false;

      if (selectedScheduleSeason) {
        const leagueStart = league.start_date.slice(0, 10);
        const leagueEnd = (league.end_date || league.start_date).slice(0, 10);
        if (leagueStart > selectedScheduleSeason.end_date || leagueEnd < selectedScheduleSeason.start_date) return false;
      }

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
    }).sort((a, b) => {
      const startDifference = new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      if (startDifference !== 0) return startDifference;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [leagueData, leagueFilterStart, leagueFilterEnd, leagueFilterStatus, selectedScheduleGroupIds, selectedScheduleSeason]);

  const leaguesByGroup = useMemo(() => myGroups.map((group) => ({
    group,
    leagues: filteredLeagues.filter((league) => league.group_id === group.id),
  })).filter((section) => section.leagues.length > 0), [filteredLeagues, myGroups]);

  const scheduleGroupIds = useMemo(() => myGroups.map((group) => group.id), [myGroups]);

  const toggleScheduleGroup = (groupId: string) => {
    setVisibleLeagueCounts({});
    setSelectedScheduleGroupIds((current) => {
      if (current.length === 0) return [groupId];
      const next = current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId];
      return next.length === myGroups.length ? [] : next;
    });
  };


  return (
    <Stack spacing={2.5}>
      {/* 로그인 유도 */}
      {!isLoggedIn && (
        <SoftCard>
          <Stack alignItems="center" spacing={1.2}>
            <Typography fontWeight={800}>로그인을 해주세요.</Typography>
            <Stack direction="row" spacing={1}>
              <Button component={RouterLink} to="/demo/league" variant="outlined" size="medium" sx={{ px: 2, borderRadius: 1, fontWeight: 800 }}>
                리그 둘러보기
              </Button>
              <Button component={RouterLink} to="/login" variant="contained" size="medium" sx={{ px: 3, borderRadius: 1 }}>
                로그인
              </Button>
            </Stack>
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
        onCalendarClick={leagues.length > 0 || (discoverData?.leagues.length ?? 0) > 0 ? () => setCalendarOpen(true) : undefined}
        seasonControl={singleScheduleGroupId && scheduleSeasons.length > 0 && selectedScheduleSeason ? (
          <TextField
            select
            size="small"
            value={selectedScheduleSeason.id}
            onChange={(event) => {
              setSelectedScheduleSeasonId(event.target.value);
              setVisibleLeagueCounts({});
            }}
            inputProps={{ "aria-label": "리그 일정 시즌 선택" }}
            SelectProps={{
              renderValue: (value) => {
                const season = scheduleSeasons.find((item) => item.id === value);
                return <Box component="span" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{season?.name ?? "시즌 선택"}</Box>;
              },
            }}
            sx={{
              width: { xs: 142, sm: 190 },
              minWidth: 0,
              "& .MuiOutlinedInput-root": { height: 36, borderRadius: 1.5, fontSize: 13, fontWeight: 800 },
              "& .MuiSelect-select": { minWidth: 0, pr: "30px !important" },
            }}
          >
            {scheduleSeasons.map((season) => (
              <MenuItem key={season.id} value={season.id}>{season.name}</MenuItem>
            ))}
          </TextField>
        ) : undefined}
      />

      {isLoggedIn && visibleInvitations.length > 0 && (
        <Card
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 2.5,
            border: "1px solid #E7D7B5",
            background: "linear-gradient(145deg, #FFFDF8 0%, #FFF8E8 100%)",
            boxShadow: "0 8px 24px rgba(120,86,35,0.12)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: "0 0 auto 0",
              height: 5,
              background: "repeating-linear-gradient(135deg, #2563EB 0 12px, #FFF 12px 20px, #E11D48 20px 32px, #FFF 32px 40px)",
            },
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pt: 2.2, pb: 1.25 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: "#FFF", border: "1px solid #E7D7B5", display: "grid", placeItems: "center", boxShadow: "0 3px 8px rgba(120,86,35,0.1)" }}>
              <MailOutlineIcon sx={{ color: "#9A6A14", fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontSize={16} fontWeight={950} color="#3F2D18">초대된 리그</Typography>
              <Typography fontSize={11.5} color="#8A7355">클럽에 도착한 리그 초대장입니다.</Typography>
            </Box>
            <Chip label={`${visibleInvitations.length}건`} size="small" sx={{ height: 24, bgcolor: "#7C3AED", color: "#fff", fontWeight: 900 }} />
          </Stack>
          <Stack spacing={1} sx={{ px: 1.5, pb: 1.5 }}>
            {visibleInvitations.map((invitation) => (
              <Card key={invitation.invitation_id} elevation={0} sx={{ borderRadius: 1.8, border: "1px dashed #D7B875", bgcolor: "rgba(255,255,255,0.92)", boxShadow: "0 4px 12px rgba(120,86,35,0.08)" }}>
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
                      <Button fullWidth variant="outlined" onClick={() => respondInvitation({ invitationId: invitation.invitation_id, status: "declined" })} sx={{ borderRadius: 1.2, fontWeight: 800 }}>거절</Button>
                      <Button fullWidth variant="contained" disableElevation onClick={() => respondInvitation({ invitationId: invitation.invitation_id, status: "accepted" })} sx={{ borderRadius: 1.2, fontWeight: 900 }}>초대 수락</Button>
                    </Stack>
                  ) : (
                    <Button fullWidth variant="outlined" sx={{ mt: 1.5 }} onClick={() => navigate(`/league/${invitation.league_code ?? invitation.id}`)}>리그 보기</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Card>
      )}

      {isLoggedIn && myGroups.length > 0 && leagues.length > 0 && (
        <Stack spacing={1}>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip
            label="전체 클럽"
            onClick={() => {
              setSelectedScheduleGroupIds([]);
              setVisibleLeagueCounts({});
            }}
            color={selectedScheduleGroupIds.length === 0 ? "primary" : "default"}
            variant={selectedScheduleGroupIds.length === 0 ? "filled" : "outlined"}
            sx={{ fontWeight: 800 }}
          />
          {myGroups.map((group) => {
            const selected = selectedScheduleGroupIds.includes(group.id);
            const color = getLeagueClubColor(group.id, scheduleGroupIds);
            return (
              <Chip
                key={group.id}
                label={group.name}
                onClick={() => toggleScheduleGroup(group.id)}
                variant={selected ? "filled" : "outlined"}
                sx={{
                  fontWeight: 800,
                  bgcolor: selected ? color : "transparent",
                  color: selected ? "#fff" : color,
                  borderColor: color,
                  "&:hover": { bgcolor: selected ? color : `${color}14` },
                }}
              />
            );
          })}
          </Stack>
        </Stack>
      )}

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
          <Stack spacing={2}>
            {leaguesByGroup.map(({ group, leagues: groupLeagues }) => {
              const color = getLeagueClubColor(group.id, scheduleGroupIds);
              const visibleCount = visibleLeagueCounts[group.id] ?? 5;
              const hasMore = visibleCount < groupLeagues.length;
              return (
                <Stack key={group.id} spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, flex: "0 0 auto" }} />
                    <Typography fontSize={14} fontWeight={900}>{group.name}</Typography>
                    <Typography fontSize={12} color="text.secondary">{groupLeagues.length}개</Typography>
                    <Divider sx={{ flex: 1 }} />
                  </Stack>
                  {groupLeagues.slice(0, visibleCount).map((league) => (
                    <LeagueCard key={league.id} league={league} color={color} />
                  ))}
                  {hasMore && (
                    <Button
                      variant="outlined"
                      endIcon={<ExpandMoreIcon sx={{ fontSize: 19 }} />}
                      onClick={() => setVisibleLeagueCounts((current) => ({
                        ...current,
                        [group.id]: visibleCount + 5,
                      }))}
                      sx={{
                        alignSelf: "center",
                        minWidth: 124,
                        bgcolor: "#FFFFFF",
                        borderColor: "#2F80ED",
                        color: "#2F80ED",
                        borderRadius: 1.5,
                        fontWeight: 800,
                        "& .MuiButton-endIcon": { ml: 0.25 },
                        "&:hover": {
                          bgcolor: "#F5F9FF",
                          borderColor: "#1D6FDB",
                        },
                      }}
                    >
                      더보기
                    </Button>
                  )}
                </Stack>
              );
            })}
          </Stack>
        ) : (
          <SoftCard>
            <Stack alignItems="center" spacing={1.5}>
              <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                조건에 맞는 리그가 없습니다.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setLeagueFilterStatus(["scheduled", "active", "completed"]);
                  setVisibleLeagueCounts({});
                }}
                sx={{
                  minWidth: 148,
                  bgcolor: "#FFFFFF",
                  borderColor: "#2F80ED",
                  color: "#2F80ED",
                  borderRadius: 1.5,
                  fontWeight: 800,
                  "&:hover": {
                    bgcolor: "#F5F9FF",
                    borderColor: "#1D6FDB",
                  },
                }}
              >
                종료된 리그 보기
              </Button>
            </Stack>
          </SoftCard>
        )
      ) : (
        <SoftCard>
          <Typography textAlign="center" color="text.secondary" fontWeight={700}>
            개설된 리그가 없습니다.
          </Typography>
        </SoftCard>
      )}

      {premiumLeagues.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 1 }}>
            <Typography component="span" sx={{ fontSize: 17, lineHeight: 1 }}>👑</Typography>
            <Typography fontSize={14} fontWeight={950} color="#6D28D9">프리미엄 일정</Typography>
            <Typography fontSize={11.5} color="text.secondary">클럽 프로모션으로 소개되는 일정입니다.</Typography>
          </Stack>
          <Stack spacing={1}>
            {premiumLeagues.slice(0, 8).map((league) => <PremiumLeagueCard key={league.id} league={league} />)}
          </Stack>
        </Box>
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
          setVisibleLeagueCounts({});
        }}
      />
      <LeagueCalendarDialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        groups={calendarGroups}
        leagues={[...leagues, ...(discoverData?.leagues ?? [])]}
      />

      {(discoverLoading || nearbyLeagues.length > 0) && (
        <>
          <LeagueSectionHeader title="내 주변 일정" />
          {discoverLoading ? (
            <SoftCard><Typography color="text.secondary" fontWeight={700}>주변 일정을 찾는 중...</Typography></SoftCard>
          ) : (
            <Stack spacing={1}>
              {nearbyLeagues.slice(0, 8).map((league) => <LeagueCard key={league.id} league={league} />)}
            </Stack>
          )}
        </>
      )}

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
  onCalendarClick?: () => void;
  seasonControl?: React.ReactNode;
};

function LeagueSectionHeader({ title, onFilterClick, onCalendarClick, seasonControl }: LeagueSectionHeaderProps) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
      <Typography variant="subtitle1" fontWeight={900}>
        {title}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
        {seasonControl}
        {onCalendarClick && <IconButton size="small" onClick={onCalendarClick} aria-label="달력으로 보기" sx={{ width: 32, height: 32 }}><CalendarMonthIcon fontSize="small" /></IconButton>}
        {onFilterClick && <IconButton size="small" onClick={onFilterClick} aria-label="일정 필터" sx={{ width: 32, height: 32 }}><TuneIcon fontSize="small" /></IconButton>}
        {!onCalendarClick && !onFilterClick && <Box sx={{ width: 32, height: 32 }} />}
      </Stack>
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

function LeagueCard({ league, color }: { league: LeagueListItem; color?: string }) {
  const navigate = useNavigate();
  return (
    <Card
      elevation={2}
      onClick={() => navigate(`/league/${league.league_code ?? league.id}`)}
      sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer", borderLeft: color ? `4px solid ${color}` : undefined }}
    >
      <CardContent sx={{ py: 1.8, px: 2.5, "&:last-child": { pb: 1.8 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography fontWeight={700} fontSize={15}>{league.title}</Typography>
              {league.premium_enabled && (
                <Chip
                  label="👑 프리미엄"
                  size="small"
                  sx={{
                    height: 22,
                    bgcolor: "#6D28D9",
                    color: "#FFF2A8",
                    border: "1px solid #E2BE4F",
                    fontSize: 10.5,
                    fontWeight: 950,
                    "& .MuiChip-label": { px: 0.8 },
                  }}
                />
              )}
              {(league.invited_group_names ?? []).map((name) => <Chip key={name} label={name} size="small" sx={{ height: 21, bgcolor: "#F3E8FF", color: "#7C3AED", fontSize: 11, fontWeight: 800 }} />)}
            </Stack>
            <Typography fontSize={12} color="text.secondary">
              {formatLeagueDateTime(league.start_date)}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {league.recruit_count > 0
              ? `${league.participant_count} / ${league.recruit_count}명`
              : `${league.participant_count}명`}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function PremiumLeagueCard({ league, compact = false }: { league: LeagueListItem; compact?: boolean }) {
  const navigate = useNavigate();
  const region = [league.region_city, league.region_district].filter(Boolean).join(" ");
  return (
    <Card
      onClick={() => navigate(`/league/${league.league_code ?? league.id}`)}
      sx={{
        cursor: "pointer",
        borderRadius: 2,
        border: "1px solid #E2BE4F",
        background: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 62%, #9333EA 100%)",
        boxShadow: "0 10px 26px rgba(91,33,182,0.3)",
      }}
    >
      <CardContent sx={{ p: compact ? 1.6 : 2, "&:last-child": { pb: compact ? 1.6 : 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.7 }}>
              <Typography component="span" sx={{ fontSize: 15, lineHeight: 1 }}>👑</Typography>
              <Typography sx={{ color: "#FFE38A", fontSize: 10.5, fontWeight: 950, letterSpacing: 1 }}>PREMIUM</Typography>
            </Stack>
            <Typography sx={{ color: "#fff", fontSize: 15, fontWeight: 950 }} noWrap>{league.title ?? league.name}</Typography>
            <Typography sx={{ color: "#F3E8FF", fontSize: 11.5, mt: 0.45 }}>
              {[league.group_name, region, league.distance_km != null ? `${Number(league.distance_km).toFixed(1)}km` : null].filter(Boolean).join(" · ")}
            </Typography>
            <Typography sx={{ color: "#E9D5FF", fontSize: 11.5, fontWeight: 700, mt: 0.3 }}>{formatLeagueDateTime(league.start_date)}</Typography>
          </Box>
          <Chip label={league.recruit_count > 0 && league.participant_count >= league.recruit_count ? "모집 마감" : "모집 중"} size="small" sx={{ bgcolor: "#FFE38A", color: "#4C1D75", border: "1px solid #FFF0B8", fontWeight: 900 }} />
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
