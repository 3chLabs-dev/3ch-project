// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { formatLeagueDate } from "../utils/dateUtils";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
    Box,
    Stack,
    Typography,
    Card,
    CardContent,
    Button,
    Select,
    MenuItem,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

import { useAppDispatch, useAppSelector } from "../app/hooks";
import { useGetLeaguesQuery } from "../features/league/leagueApi";
import type { LeagueListItem } from "../features/league/leagueApi";
import { useGetMyGroupsQuery } from "../features/group/groupApi";
import { setPreferredGroupId } from "../features/league/leagueCreationSlice";
// import LeagueFilterDialog from "../components/LeagueFilterDialog.tsx";
import GuestHome from "../components/GuestHome.tsx";

const SPORT_EMOJI: Record<string, string> = {
    "탁구": "🏓",
    "배드민턴": "🏸",
    "테니스": "🎾",
};

// type LeagueStatus = "scheduled" | "active" | "completed";

export default function Home() {
    const dispatch = useAppDispatch();

    const token = useAppSelector((state) => state.auth.token);
    const user = useAppSelector((state) => state.auth.user);
    const preferredGroupId = useAppSelector((state) => state.leagueCreation.preferredGroupId);
    const isLoggedIn = !!token;
    const navigate = useNavigate();

    const { data: groupData } = useGetMyGroupsQuery(undefined, {
        skip: !isLoggedIn,
        refetchOnMountOrArgChange: true,
    });
    const groups = useMemo(() => groupData?.groups ?? [], [groupData]);
    const hasGroups = groups.length > 0;
    const isAdmin = useMemo(
        () => groups.some((g) => g.role === "owner" || g.role === "admin"),
        [groups],
    );

    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const defaultGroupId = useMemo(() => {
        if (!hasGroups) return null;
        if (preferredGroupId && groups.some((g) => g.id === preferredGroupId)) {
            return preferredGroupId;
        }
        return groups[0].id;
    }, [groups, hasGroups, preferredGroupId]);
    const effectiveSelectedGroupId =
        selectedGroupId && groups.some((g) => g.id === selectedGroupId)
            ? selectedGroupId
            : defaultGroupId;
    const selectedGroup = effectiveSelectedGroupId
        ? groups.find((g) => g.id === effectiveSelectedGroupId) ?? null
        : null;

    useEffect(() => {
        if (!effectiveSelectedGroupId) return;
        if (preferredGroupId === effectiveSelectedGroupId) return;
        dispatch(setPreferredGroupId(effectiveSelectedGroupId));
    }, [dispatch, effectiveSelectedGroupId, preferredGroupId]);

    const { data: leagueData, isLoading: leagueLoading } = useGetLeaguesQuery(
        effectiveSelectedGroupId ? { group_id: effectiveSelectedGroupId } : undefined,
        { skip: !isLoggedIn || !effectiveSelectedGroupId, refetchOnMountOrArgChange: true }
    );


    const activeLeagues = useMemo(() => {
        const leagues = leagueData?.leagues ?? [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return leagues.filter((league) => {
            if (!league.start_date) return false;

            const startAt = new Date(league.start_date);
            return league.status === "active" && startAt >= now;
        });
    }, [leagueData]);

    const scheduledLeagues = useMemo(() => {
        const leagues = leagueData?.leagues ?? [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return leagues.filter((league) => {
            if (!league.start_date) return false;

            const startAt = new Date(league.start_date);
            return league.status === "draft" && startAt >= now;
        });
    }, [leagueData]);

    if (!user) {
        return (<GuestHome />)
    }
    return (
        <Box>
        <Stack spacing={2.5} sx={{mb: 2}}>
            {/* 사용자명 + 클럽 선택 */}
            {isLoggedIn && (
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.2}>
                        <Box
                            sx={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                bgcolor: "#FAAA47",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Typography fontSize={13} fontWeight={900} color="#000000" lineHeight={1}>
                                {selectedGroup?.division || "-"}
                            </Typography>
                        </Box>
                        <Typography variant="h5" fontWeight={900} lineHeight={1.1}>
                            {user?.name || user?.email || "우리리그"}
                        </Typography>
                    </Stack>
                    {hasGroups && groups.length > 1 && (
                        <Select
                            value={effectiveSelectedGroupId ?? ""}
                            onChange={(e: SelectChangeEvent<string>) => {
                                const nextGroupId = e.target.value;
                                setSelectedGroupId(nextGroupId || null);
                                dispatch(setPreferredGroupId(nextGroupId || null));
                            }}
                            size="small"
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
                            {groups.map((g) => (
                                <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                            ))}
                        </Select>
                    )}
                </Stack>
            )}

            {/* 로그인/클럽 카드 */}
            {!isLoggedIn ? (
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
            ) : selectedGroup ? (
                <Card
                    elevation={2}
                    sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                >
                    <CardContent sx={{ py: 2.2, px: 2.5, "&:last-child": { pb: 2.2 } }}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            {/* 아이콘 */}
                            <Box
                                sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: "50%",
                                    bgcolor: "#EC4899",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <Typography sx={{ fontSize: 24, lineHeight: 1 }}>
                                    {selectedGroup.sport ? (SPORT_EMOJI[selectedGroup.sport] ?? "🏓") : "🏓"}
                                </Typography>
                            </Box>

                            {/* 클럽 정보 */}
                            <Stack spacing={0.4} flex={1} minWidth={0}>
                                <Typography fontWeight={800} fontSize={16} lineHeight={1.3}>
                                    {selectedGroup.name}
                                </Typography>
                                <Typography color="text.secondary" fontWeight={600} fontSize={13} lineHeight={1.3}>
                                    {[selectedGroup.region_city, selectedGroup.region_district]
                                        .filter(Boolean)
                                        .join(" ") || `멤버 ${selectedGroup.member_count}명`}
                                </Typography>
                            </Stack>

                            {/* 자세히보기 버튼 */}
                            <Button
                                component={RouterLink}
                                to={`/club/${selectedGroup.club_code ?? selectedGroup.id}/manage`}
                                variant="outlined"
                                size="small"
                                sx={{
                                    borderRadius: 1,
                                    fontWeight: 700,
                                    fontSize: 12,
                                    px: 1.5,
                                    py: 0.6,
                                    flexShrink: 0,
                                    borderColor: "#E5E7EB",
                                    color: "#374151",
                                    "&:hover": {
                                        borderColor: "#D1D5DB",
                                        bgcolor: "#F9FAFB",
                                    },
                                }}
                            >
                                자세히보기
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            ) : (
                <SoftCard>
                    <Stack alignItems="center" spacing={1.2}>
                        <Typography fontWeight={800}>환영합니다!</Typography>
                        <Typography color="text.secondary" fontWeight={700}>
                            클럽 없음
                        </Typography>
                    </Stack>
                </SoftCard>
            )}
            </Stack>
            
        <Box sx={{ mx: -2}}>
            <Stack spacing={2.5}>
            {/* 진행중 리그 대회 */}
            <Box
                sx={{
                    mt: 3,
                    px: 2,
                    py: 2,
                    // borderRadius: 0.6,
                    backgroundColor: "#DBEAFE",
                }}
            >
                <SectionHeader
                    title="진행중인 리그·대회"
                />
                {!isLoggedIn || !hasGroups ? (
                    <Box sx={{ mt: 2, mb: 2, py: 2, }}>
                        <SoftCard>
                        <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                            {!isLoggedIn ? "로그인 후 확인할 수 있습니다." : "클럽에 가입하면 진행중 일정을 확인할 수 있습니다."}
                        </Typography>
                        </SoftCard>
                    </Box>
                ) : leagueLoading ? (
                    <Box sx={{ mt: 2, mb: 2, px: 2, py: 2, }}>
                        <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                            로딩 중...
                        </Typography>
                    </Box>
                ) : activeLeagues.length > 0 ? (
                        <Box sx={{ mt: 2, mb: 2, py: 2, }}>
                    <Stack spacing={1}>
                        {activeLeagues.map((league) => (
                            <LeagueCard key={league.id} league={league} goToMatches />
                        ))}
                    </Stack>
                        </Box>
                ) : (
                    <Box sx={{ mt: 2, mb: 2, py: 2, }}>
                        <SoftCard>
                        <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                            개설된 리그·대회가 없습니다.
                        </Typography>
                        </SoftCard>
                    </Box>
                )}

            </Box>
            {/* 다음 리그 대회 */}
            <Box
                sx={{
                    mt: 3,
                    px: 2,
                    py: 2,
                    // borderRadius: 0.6,
                    // backgroundColor: "#DBEAFE",
                }}
            >
                <SectionHeader
                    title="다음 리그·대회"
                />
                {!isLoggedIn || !hasGroups ? (
                    <Box sx={{ mt: 2, mb: 2, py: 2, }}>
                        <SoftCard>
                        <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                            {!isLoggedIn ? "로그인 후 확인할 수 있습니다." : "클럽에 가입하면 일정을 확인할 수 있습니다."}
                        </Typography>
                        </SoftCard>
                    </Box>
                ) : leagueLoading ? (
                    <Box sx={{ mt: 2, mb: 2, px: 2, py: 2, }}>
                        <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                            로딩 중...
                        </Typography>
                    </Box>
                ) : scheduledLeagues.length > 0 ? (
                        <Box sx={{ mt: 1, mb: 1, py: 1, }}>
                    <Stack spacing={2}>
                        {scheduledLeagues.map((league) => (
                            <LeagueCard key={league.id} league={league} />
                        ))}
                    </Stack>
                        </Box>
                ) : (
                    <Box sx={{ mt: 2, mb: 2, py: 2, }}>
                        <SoftCard>
                        <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                            개설된 리그·대회가 없습니다.
                        </Typography>
                        </SoftCard>
                    </Box>
                )}

                {isLoggedIn && isAdmin && (
                    <Button
                        component={RouterLink}
                        to="/league"
                        variant="contained"
                        fullWidth
                        sx={{ borderRadius: 1, fontWeight: 700, mt: 1 }}
                    >
                        리그·대회 일정 전체보기
                    </Button>
                )}
            </Box>


            <Box sx={{ mx: -2 }}>
                <Box
                    sx={{
                        mt: 3,
                        px: 2,
                        py: 2,
                        // borderRadius: 0.6,
                        backgroundColor: "#DBEAFE",
                    }}
                >
                    <Typography
                        sx={{
                            mt: 3,
                            mb: 1.2,
                            textAlign: "center",
                            fontSize: 24,
                            fontWeight: 800,
                            color: "#111827",
                        }}
                    >
                        우리리그와 함께 해보세요
                    </Typography>

                    <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => navigate("/mypage/inquiry")}
                        sx={{
                            mb: 3,
                            height: 40,
                            borderRadius: 9999,
                            backgroundColor: "#FFFFFF",
                            borderColor: "#60A5FA",
                            color: "#2563EB",
                            fontWeight: 700,
                            "&:hover": {
                                borderColor: "#3B82F6",
                                backgroundColor: "#F8FAFC",
                            },
                        }}
                    >
                        제휴 문의
                    </Button>
                </Box>
            </Box>
        </Stack>
        </Box>

        </Box>
    );
}

function SectionHeader({ title }: { title: string }) {
    return (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
            <Typography variant="subtitle1" fontWeight={900} fontSize={19}>
                {title}
            </Typography>
            {/* <IconButton size="small">
                <TuneIcon fontSize="small" />
            </IconButton> */}
        </Stack>
    );
}


function LeagueCard({ league, goToMatches = false,}: { league: LeagueListItem; goToMatches?: boolean; }) {
    const navigate = useNavigate();

        const targetPath = goToMatches
        ? `/league/${league.league_code ?? league.id}/matches`
        : `/league/${league.league_code ?? league.id}`;
    return (
        <Card
            elevation={2}
            onClick={() => navigate(targetPath)}
            sx={{  borderRadius: 0.6, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer" 
            }}
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
            <CardContent sx={{
                py: 2.5,
                px: 2,
                minHeight: 80,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                "&:last-child": { pb: 2.5 },
            }}>
                {children}
            </CardContent>
        </Card>
    );
}



