import React, { useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setStep, setGroupId } from "../../features/league/leagueCreationSlice";
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
  const isLoggedIn = !!token;

  const { data } = useGetMyGroupsQuery(undefined, { skip: !isLoggedIn });
  const adminGroups = useMemo(
    () => (data?.groups ?? []).filter((g) => g.role === "owner" || g.role === "admin"),
    [data],
  );

  const autoGroupId = adminGroups.length === 1 ? adminGroups[0].id : "";
  const [manualGroupId, setManualGroupId] = useState("");
  const selectedGroupId = adminGroups.length === 1 ? autoGroupId : manualGroupId;

  // Fetch leagues for the selected group
  const { data: leagueData, isLoading: leagueLoading } = useGetLeaguesQuery(
    selectedGroupId ? { group_id: selectedGroupId } : undefined,
    { skip: !isLoggedIn || !selectedGroupId }
  );
  const leagues = useMemo(() => leagueData?.leagues ?? [], [leagueData]);

  const hasExistingRally = false;

  const canCreate = isLoggedIn && adminGroups.length > 0 && selectedGroupId !== "";

  const handleCreateNewLeague = () => {
    if (!canCreate) return;
    dispatch(setGroupId(selectedGroupId));
    dispatch(setStep(1));
  };

  return (
    <Stack spacing={2.0}>
      {/* 타이틀 + 모임 선택 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={900}>
          리그 일정
        </Typography>
        {isLoggedIn && adminGroups.length > 1 && (
          <Select
            value={selectedGroupId}
            onChange={(e: SelectChangeEvent<string>) => setManualGroupId(e.target.value)}
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
            {adminGroups.map((g) => (
              <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
            ))}
          </Select>
        )}
      </Stack>

      {/* 리그 일정 카드 */}
      {(!isLoggedIn || adminGroups.length > 0) && (
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
      {isLoggedIn && adminGroups.length > 0 && (
        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={handleCreateNewLeague}
          disabled={!canCreate}
          sx={{
            borderRadius: 1,
            py: 1.2,
            fontWeight: 900,
          }}
        >
          신규 생성하기
        </Button>
      )}

      {/* 권한 없음 메시지 */}
      {isLoggedIn && adminGroups.length === 0 && (
        <SoftCard>
          <Typography textAlign="center" color="text.secondary" fontWeight={700} fontSize={14}>
            모임장 또는 운영진만 리그를 개설할 수 있습니다.
          </Typography>
        </SoftCard>
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
          py: 1.2,
          fontWeight: 900,
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
