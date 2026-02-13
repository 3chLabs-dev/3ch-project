import React, { useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setStep, setGroupId, setPreferredGroupId } from "../../features/league/leagueCreationSlice";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useGetLeaguesQuery } from "../../features/league/leagueApi";
import type { LeagueListItem } from "../../features/league/leagueApi";
import {
  Box, Stack, Typography, Card, CardContent, Button,
  Select, MenuItem,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

export default function LeagueMainBody() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const preferredGroupId = useAppSelector((s) => s.leagueCreation.preferredGroupId);
  const isLoggedIn = !!token;

  const { data } = useGetMyGroupsQuery(undefined, { skip: !isLoggedIn });
  const myGroups = useMemo(() => data?.groups ?? [], [data]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const defaultGroupId = useMemo(() => {
    if (myGroups.length === 0) return null;
    if (preferredGroupId && myGroups.some((g) => g.id === preferredGroupId)) {
      return preferredGroupId;
    }
    return myGroups[0].id;
  }, [myGroups, preferredGroupId]);
  const effectiveSelectedGroupId =
    selectedGroupId && myGroups.some((g) => g.id === selectedGroupId)
      ? selectedGroupId
      : defaultGroupId;
  const selectedGroup = effectiveSelectedGroupId
    ? myGroups.find((g) => g.id === effectiveSelectedGroupId) ?? null
    : null;

  // Fetch leagues for the selected group
  const { data: leagueData, isLoading: leagueLoading } = useGetLeaguesQuery(
    effectiveSelectedGroupId ? { group_id: effectiveSelectedGroupId } : undefined,
    { skip: !isLoggedIn || !effectiveSelectedGroupId }
  );
  const leagues = useMemo(() => leagueData?.leagues ?? [], [leagueData]);

  const hasExistingRally = false;

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
    <Stack spacing={2.0}>
      {/* 타이틀 + 모임 선택 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={900}>
          리그 일정
        </Typography>
        {isLoggedIn && myGroups.length > 1 && (
          <Select
            value={effectiveSelectedGroupId ?? ""}
            onChange={(e: SelectChangeEvent<string>) => {
              const nextGroupId = e.target.value;
              setSelectedGroupId(nextGroupId || null);
              dispatch(setPreferredGroupId(nextGroupId || null));
            }}
            size="small"
            displayEmpty
            sx={{
              borderRadius: 1,
              height: 32,
              fontSize: "0.85rem",
              fontWeight: 700,
              bgcolor: "#EEF2FF",
              "& .MuiSelect-select": { py: 0.5, px: 1.5 },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#C7D2FE" },
            }}
          >
            <MenuItem value="">
              <em>모임 선택</em>
            </MenuItem>
            {myGroups.map((g) => (
              <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
            ))}
          </Select>
        )}
      </Stack>

      {/* 리그 일정 카드 */}
      {(isLoggedIn && myGroups.length > 0) && (
        <>
          {leagueLoading ? (
            <SoftCard>
              <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                로딩 중...
              </Typography>
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
        </>
      )}

      {/* 신규 생성 */}
      {canCreate && (
        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={handleCreateNewLeague}
          sx={{
            borderRadius: 1,
            fontWeight: 700,
          }}
        >
          신규 생성하기
        </Button>
      )}

      <Box>
        <Typography variant="h6" fontWeight={900}>
          대회 일정
        </Typography>
      </Box>

      {/* 대회 일정 카드 */}
      <SoftCard>
        {hasExistingRally ? (
          <Typography fontWeight={700}>개설된 대회 목록…</Typography>
        ) : (
          <Typography textAlign="center" color="text.secondary" fontWeight={700}>
            개설된 대회가 없습니다.
          </Typography>
        )}
      </SoftCard>

      <Button
        fullWidth
        variant="contained"
        disableElevation
        sx={{
          borderRadius: 1,
          fontWeight: 700,
        }}
      >
        신규 생성하기
      </Button>
    </Stack>
  );
}

function formatLeagueDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const day = days[d.getDay()];
  return `${yyyy}-${mm}-${dd}(${day})`;
}

function LeagueCard({ league }: { league: LeagueListItem }) {
  return (
    <Card
      elevation={2}
      sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
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
    <Card
      elevation={2}
      sx={{
        borderRadius: 1,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <CardContent
        sx={{
          py: 2.5,
          px: 2,
          minHeight: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          "&:last-child": { pb: 2.5 },
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
}
