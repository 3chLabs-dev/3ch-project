// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { formatLeagueDateTime } from "../utils/dateUtils";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
    Box,
    Chip,
    Stack,
    Typography,
    Card,
    CardContent,
    Button,
    Divider,
    IconButton,
    Select,
    MenuItem,
} from "@mui/material";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import SportsOutlinedIcon from "@mui/icons-material/SportsOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import type { SelectChangeEvent } from "@mui/material";

import { useAppDispatch, useAppSelector } from "../app/hooks";
import { useGetPreferencesQuery, useGetHomeSummaryQuery } from "../features/user/userApi";
import type { MyGroupItem, MyMatchItem, MyWinItem } from "../features/user/userApi";
import { useGetLeaguesQuery } from "../features/league/leagueApi";
import type { LeagueListItem } from "../features/league/leagueApi";
import { useGetGroupRankingQuery, useGetMyGroupsQuery, useUpdateMyGroupPreferencesMutation } from "../features/group/groupApi";
import { setPreferredGroupId } from "../features/league/leagueCreationSlice";
import LeagueFilterDialog from "../components/LeagueFilterDialog.tsx";
import AdFitBanner from "../components/AdFitBanner";
import GuestHome from "../components/GuestHome.tsx";
import ClubSelectionDialog from "../components/ClubSelectionDialog";

const SPORT_EMOJI: Record<string, string> = {
    "탁구": "🏓",
    "배드민턴": "🏸",
    "테니스": "🎾",
};

type LeagueStatus = "scheduled" | "active" | "completed";
type SummaryFilter = { startDate: string; endDate: string; status: LeagueStatus[] };

const DEFAULT_SUMMARY_FILTER: SummaryFilter = {
    startDate: "",
    endDate: "",
    status: ["scheduled", "active"],
};

function matchesSummaryFilter(
    item: { league_start_date: string | null; league_status: string },
    filter: SummaryFilter,
) {
    if (!item.league_start_date) return false;
    const dateOnly = item.league_start_date.slice(0, 10);
    if (filter.startDate && dateOnly < filter.startDate) return false;
    if (filter.endDate && dateOnly > filter.endDate) return false;
    if (filter.status.length === 0) return true;

    const startAt = new Date(item.league_start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const status: LeagueStatus = item.league_status === "completed" || startAt < today
        ? "completed"
        : item.league_status === "draft"
            ? "scheduled"
            : "active";
    return filter.status.includes(status);
}

export default function Home() {
    const dispatch = useAppDispatch();

    const token = useAppSelector((state) => state.auth.token);
    const user = useAppSelector((state) => state.auth.user);
    const preferredGroupId = useAppSelector((state) => state.leagueCreation.preferredGroupId);
    const isLoggedIn = !!token;
    const navigate = useNavigate();

    const { data: preferences } = useGetPreferencesQuery(undefined, { skip: !isLoggedIn });

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
    const [clubSelectionOpen, setClubSelectionOpen] = useState(false);
    const [updateGroupPreferences, { isLoading: isSavingGroupPreferences }] = useUpdateMyGroupPreferencesMutation();
    const [summaryFilterTarget, setSummaryFilterTarget] = useState<"groups" | "matches" | null>(null);
    const [groupFilter, setGroupFilter] = useState<SummaryFilter>(DEFAULT_SUMMARY_FILTER);
    const [matchFilter, setMatchFilter] = useState<SummaryFilter>(DEFAULT_SUMMARY_FILTER);
    const [visibleGroupCount, setVisibleGroupCount] = useState(10);
    const [visibleMatchCount, setVisibleMatchCount] = useState(10);
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
    const { data: clubRankingData, isLoading: isClubRankingLoading } = useGetGroupRankingQuery(
        { groupId: effectiveSelectedGroupId ?? "" },
        { skip: !isLoggedIn || !effectiveSelectedGroupId, refetchOnMountOrArgChange: true },
    );
    const myClubRanking = clubRankingData?.rankings.find((row) => row.member_id === Number(user?.id));
    const clubTop3 = clubRankingData?.rankings
        .filter((row) => row.rank != null && row.rank <= 3)
        .slice(0, 3) ?? [];

    useEffect(() => {
        if (!effectiveSelectedGroupId) return;
        if (preferredGroupId === effectiveSelectedGroupId) return;
        dispatch(setPreferredGroupId(effectiveSelectedGroupId));
    }, [dispatch, effectiveSelectedGroupId, preferredGroupId]);

    const { data: leagueData, isLoading: leagueLoading } = useGetLeaguesQuery(
        effectiveSelectedGroupId ? { group_id: effectiveSelectedGroupId } : undefined,
        { skip: !isLoggedIn || !effectiveSelectedGroupId, refetchOnMountOrArgChange: true }
    );

    const showSummary = isLoggedIn && (preferences?.show_group || preferences?.show_game || preferences?.show_win);
    const { data: homeSummary, isError: isHomeSummaryError } = useGetHomeSummaryQuery(
        { groupId: effectiveSelectedGroupId },
        { skip: !showSummary || !effectiveSelectedGroupId, refetchOnMountOrArgChange: true }
    );

    const filteredGroups = useMemo(
        () => (homeSummary?.my_groups ?? []).filter((item) => matchesSummaryFilter(item, groupFilter)),
        [groupFilter, homeSummary?.my_groups],
    );
    const filteredMatches = useMemo(
        () => (homeSummary?.my_matches ?? []).filter((item) =>
            item.program_block_type === "SINGLES"
            && matchesSummaryFilter(item, matchFilter)
        ),
        [homeSummary?.my_matches, matchFilter],
    );

    useEffect(() => {
        setVisibleGroupCount(10);
        setVisibleMatchCount(10);
    }, [effectiveSelectedGroupId]);

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
            {isLoggedIn && (
                <AdFitBanner
                    unitId="DAN-wqLH9vJ3WU5v6jE4"
                    width={320}
                    height={50}
                    sx={{ pt: 1 }}
                />
            )}
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
                                if (nextGroupId === "__club_selection__") {
                                    setClubSelectionOpen(true);
                                    return;
                                }
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
                            <Divider />
                            <MenuItem value="__club_selection__" sx={{ fontWeight: 800, color: "primary.main" }}>
                                클럽 선택
                            </MenuItem>
                        </Select>
                    )}
                </Stack>
            )}

            <ClubSelectionDialog
                open={clubSelectionOpen}
                groups={groups}
                saving={isSavingGroupPreferences}
                onClose={() => setClubSelectionOpen(false)}
                onSave={async (orderedGroupIds, primaryGroupId) => {
                    await updateGroupPreferences({ orderedGroupIds, primaryGroupId }).unwrap();
                    setSelectedGroupId(primaryGroupId);
                    dispatch(setPreferredGroupId(primaryGroupId));
                    setClubSelectionOpen(false);
                }}
            />

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
                        <Divider sx={{ my: 1.4 }} />
                        {isClubRankingLoading ? (
                            <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                                클럽 레이팅을 불러오는 중...
                            </Typography>
                        ) : (
                            <Stack spacing={0.7}>
                                <Typography sx={{ fontSize: 11.5, color: "text.secondary", fontWeight: 600 }}>
                                    {myClubRanking?.rank
                                        ? `내 순위 ${myClubRanking.rank}위 · 레이팅 ${myClubRanking.rating}`
                                        : "아직 클럽 순위가 없습니다."}
                                </Typography>
                                {clubTop3.length > 0 && (
                                    <Stack direction="row" spacing={0.55} useFlexGap flexWrap="wrap">
                                        {clubTop3.map((row) => (
                                            <Box
                                                key={row.member_id}
                                                sx={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 0.35,
                                                    px: 0.65,
                                                    py: 0.25,
                                                    borderRadius: 999,
                                                    bgcolor: "#F9FAFB",
                                                }}
                                            >
                                                <EmojiEventsOutlinedIcon sx={{ fontSize: 11.5, color: "#F59E0B" }} />
                                                <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#374151" }}>
                                                    {row.rank}위 {row.name}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}
                            </Stack>
                        )}
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

            {/* 나의 조 편성·팀 편성 */}
            {isLoggedIn && preferences?.show_group && (
                <Box sx={{ mt: 3, px: 2, py: 2, backgroundColor: "#F5F3FF" }}>
                    <SectionHeader
                        title="나의 조 편성·팀 편성"
                        icon={<GridViewOutlinedIcon sx={{ fontSize: 18, color: "#6366F1", mr: 0.5 }} />}
                        onFilterClick={() => setSummaryFilterTarget("groups")}
                    />
                    <Box sx={{ mt: 2, mb: 1 }}>
                        {isHomeSummaryError ? (
                            <SoftCard>
                                <Typography textAlign="center" color="error.main" fontWeight={700}>
                                    편성 정보를 불러오지 못했습니다.
                                </Typography>
                            </SoftCard>
                        ) : !homeSummary || filteredGroups.length === 0 ? (
                            <SoftCard>
                                <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                                    조건에 맞는 조·팀 편성이 없습니다.
                                </Typography>
                            </SoftCard>
                        ) : (
                            <Stack spacing={1}>
                                {filteredGroups.slice(0, visibleGroupCount).map((item) => (
                                    <MyGroupCard key={item.league_id} item={item} navigate={navigate} />
                                ))}
                                {filteredGroups.length > visibleGroupCount && (
                                    <MoreButton onClick={() => setVisibleGroupCount((count) => count + 10)} />
                                )}
                            </Stack>
                        )}
                    </Box>
                </Box>
            )}

            {/* 나의 경기 */}
            {isLoggedIn && preferences?.show_game && (
                <Box sx={{ mt: 3, px: 2, py: 2, backgroundColor: "#EFF6FF" }}>
                    <SectionHeader
                        title="나의 경기"
                        icon={<SportsOutlinedIcon sx={{ fontSize: 18, color: "#2F80ED", mr: 0.5 }} />}
                        onFilterClick={() => setSummaryFilterTarget("matches")}
                    />
                    <Box sx={{ mt: 2, mb: 1 }}>
                        {isHomeSummaryError ? (
                            <SoftCard>
                                <Typography textAlign="center" color="error.main" fontWeight={700}>
                                    경기 정보를 불러오지 못했습니다.
                                </Typography>
                            </SoftCard>
                        ) : !homeSummary || filteredMatches.length === 0 ? (
                            <SoftCard>
                                <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                                    조건에 맞는 경기가 없습니다.
                                </Typography>
                            </SoftCard>
                        ) : (
                            <Stack spacing={1}>
                                {filteredMatches.slice(0, visibleMatchCount).map((item) => (
                                    <MyMatchCard key={item.match_id} item={item} navigate={navigate} />
                                ))}
                                {filteredMatches.length > visibleMatchCount && (
                                    <MoreButton onClick={() => setVisibleMatchCount((count) => count + 10)} />
                                )}
                            </Stack>
                        )}
                    </Box>
                </Box>
            )}

            {/* 나의 당첨내역 */}
            {isLoggedIn && preferences?.show_win && (
                <Box sx={{ mt: 3, px: 2, py: 2, backgroundColor: "#FFFBEB" }}>
                    <SectionHeader
                        title="나의 당첨내역"
                        icon={<EmojiEventsOutlinedIcon sx={{ fontSize: 18, color: "#D97706", mr: 0.5 }} />}
                    />
                    <Box sx={{ mt: 2, mb: 1 }}>
                        {!homeSummary || homeSummary.my_wins.length === 0 ? (
                            <SoftCard>
                                <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                                    당첨 내역이 없습니다.
                                </Typography>
                            </SoftCard>
                        ) : (
                            <Stack spacing={1}>
                                {homeSummary.my_wins.map((item, idx) => (
                                    <MyWinCard key={idx} item={item} navigate={navigate} />
                                ))}
                            </Stack>
                        )}
                    </Box>
                </Box>
            )}

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
                            fontSize: 14,
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

        <LeagueFilterDialog
            key={`${summaryFilterTarget ?? "closed"}-${summaryFilterTarget === "groups" ? JSON.stringify(groupFilter) : JSON.stringify(matchFilter)}`}
            open={summaryFilterTarget !== null}
            onClose={() => setSummaryFilterTarget(null)}
            startDate={(summaryFilterTarget === "groups" ? groupFilter : matchFilter).startDate}
            endDate={(summaryFilterTarget === "groups" ? groupFilter : matchFilter).endDate}
            status={(summaryFilterTarget === "groups" ? groupFilter : matchFilter).status}
            onApply={(filter) => {
                if (summaryFilterTarget === "groups") {
                    setGroupFilter(filter);
                    setVisibleGroupCount(10);
                } else if (summaryFilterTarget === "matches") {
                    setMatchFilter(filter);
                    setVisibleMatchCount(10);
                }
            }}
        />

        </Box>
    );
}

function SectionHeader({ title, icon, onFilterClick }: { title: string; icon?: React.ReactNode; onFilterClick?: () => void }) {
    return (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
            <Stack direction="row" alignItems="center">
                {icon}
                <Typography variant="subtitle1" fontWeight={900} fontSize={19}>
                    {title}
                </Typography>
            </Stack>
            {onFilterClick && (
                <IconButton size="small" onClick={onFilterClick} aria-label={`${title} 필터`}>
                    <TuneIcon fontSize="small" />
                </IconButton>
            )}
        </Stack>
    );
}

function MoreButton({ onClick }: { onClick: () => void }) {
    return (
        <Button
            fullWidth
            variant="text"
            onClick={onClick}
            sx={{ mt: 0.5, color: "text.secondary", fontWeight: 800 }}
        >
            더보기
        </Button>
    );
}

function getLeagueProgressPath(id: string, format?: string | null) {
    if (format === "4인 리그 (OMR)") return `/league/${id}/omr`;
    if (format === "OCR 텍스트 인식") return `/league/${id}/ocr`;
    return `/league/${id}/matches`;
}

function MyGroupCard({ item, navigate }: { item: MyGroupItem; navigate: (path: string) => void }) {
    const assignments = [
        ...(item.group_assignments ?? []).map((label) => ({ label, kind: "group" as const })),
        ...(item.team_assignments ?? []).map((label) => ({ label, kind: "team" as const })),
    ];

    return (
        <Card
            elevation={2}
            onClick={() => {
                navigate(`/league/${item.league_code ?? item.league_id}`);
            }}
            sx={{ borderRadius: 0.6, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer" }}
        >
            <CardContent sx={{ py: 1.6, px: 2.5, "&:last-child": { pb: 1.6 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography fontWeight={700} fontSize={14} noWrap flex={1} mr={1}>
                        {item.league_name}
                    </Typography>
                    <Stack direction="row" spacing={0.6} flexShrink={0}>
                        {assignments.map(({ label, kind }) => (
                            <Chip
                                key={`${kind}-${label}`}
                                label={label}
                                size="small"
                                sx={{
                                    bgcolor: kind === "group" ? "#EEF2FF" : "#FDF2F8",
                                    color: kind === "group" ? "#6366F1" : "#DB2777",
                                    fontWeight: 700,
                                    fontSize: 12,
                                }}
                            />
                        ))}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

function MyMatchCard({ item, navigate }: { item: MyMatchItem; navigate: (path: string) => void }) {
    const statusLabel = item.status === "done" ? "종료" : item.status === "playing" ? "진행중" : "대기";
    const statusColor = item.status === "playing" ? "#16A34A" : "#6B7280";
    const leagueBase = item.league_code ?? item.league_id;
    const matchPath = item.program_round
        ? `/league/${leagueBase}/program/matches?program=1&round=${item.program_round}`
        : `/league/${leagueBase}/matches`;

    return (
        <Card
            elevation={2}
            onClick={() => navigate(matchPath)}
            sx={{ borderRadius: 0.6, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer" }}
        >
            <CardContent sx={{ py: 1.6, px: 2.5, "&:last-child": { pb: 1.6 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Stack flex={1} minWidth={0}>
                        <Typography fontWeight={700} fontSize={13} color="text.secondary" noWrap>
                            {item.league_name}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.8} mt={0.4}>
                            <Typography fontWeight={800} fontSize={14}>
                                {item.participant_name || "나"}
                            </Typography>
                            <Typography fontWeight={700} fontSize={12} color="text.secondary">vs</Typography>
                            <Typography fontWeight={700} fontSize={14}>
                                {item.opponent_name ?? "?"}
                                {item.program_block_type === "SINGLES" && item.opponent_division
                                    ? ` (${item.opponent_division})`
                                    : ""}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Stack alignItems="flex-end" spacing={0.3}>
                        <Typography fontSize={11} fontWeight={700} sx={{ color: statusColor }}>
                            {statusLabel}
                        </Typography>
                        <Typography fontSize={13} fontWeight={700} color="text.secondary">
                            {item.match_order}번 경기
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

function MyWinCard({ item, navigate }: { item: MyWinItem; navigate: (path: string) => void }) {
    return (
        <Card
            elevation={2}
            onClick={() => navigate(`/league/${item.league_code ?? item.league_id}`)}
            sx={{ borderRadius: 0.6, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer" }}
        >
            <CardContent sx={{ py: 1.6, px: 2.5, "&:last-child": { pb: 1.6 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack flex={1} minWidth={0}>
                        <Typography fontWeight={700} fontSize={13} color="text.secondary" noWrap>
                            {item.league_name} · {item.draw_name}
                        </Typography>
                        <Typography fontWeight={800} fontSize={14} mt={0.3}>
                            {item.prize_name}
                        </Typography>
                    </Stack>
                    <Chip
                        label="당첨"
                        size="small"
                        sx={{ bgcolor: "#FEF3C7", color: "#D97706", fontWeight: 700, fontSize: 12 }}
                    />
                </Stack>
            </CardContent>
        </Card>
    );
}

function LeagueCard({ league, goToMatches = false,}: { league: LeagueListItem; goToMatches?: boolean; }) {
    const navigate = useNavigate();
    const base = league.league_code ?? league.id;

    const targetPath = goToMatches
        ? getLeagueProgressPath(base, league.format)
        : `/league/${base}`;
    return (
        <Card
            elevation={2}
            onClick={() => navigate(targetPath)}
            sx={{  borderRadius: 0.6, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer"
            }}
        >
            <CardContent sx={{ py: 1.8, px: 2.5, "&:last-child": { pb: 1.8 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box minWidth={0}>
                        <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                            <Typography fontWeight={700} fontSize={15}>
                                {league.title || league.name}
                            </Typography>
                            {(league.invited_group_names ?? []).map((name) => (
                                <Chip
                                    key={name}
                                    label={name}
                                    size="small"
                                    sx={{ height: 21, bgcolor: "#F3E8FF", color: "#7C3AED", fontSize: 11, fontWeight: 800 }}
                                />
                            ))}
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


