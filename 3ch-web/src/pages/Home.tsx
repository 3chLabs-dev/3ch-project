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
    IconButton,
    Select,
    MenuItem,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";

import { useAppDispatch, useAppSelector } from "../app/hooks";
import { useGetLeaguesQuery } from "../features/league/leagueApi";
import type { LeagueListItem } from "../features/league/leagueApi";
import { useGetMyGroupsQuery } from "../features/group/groupApi";
import { setPreferredGroupId } from "../features/league/leagueCreationSlice";
import LeagueFilterDialog from "../components/LeagueFilterDialog.tsx";

const SPORT_EMOJI: Record<string, string> = {
    "탁구": "🏓",
    "배드민턴": "🏸",
    "테니스": "🎾",
};

export default function Home() {
    const dispatch = useAppDispatch();

    const token = useAppSelector((state) => state.auth.token);
    const user = useAppSelector((state) => state.auth.user);
    const preferredGroupId = useAppSelector((state) => state.leagueCreation.preferredGroupId);
    const isLoggedIn = !!token;

    const [filterOpen, setFilterOpen] = useState(false);


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

    return (
        <Stack spacing={2.5}>
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

            {/* 리그 일정 */}
            <LeagueSectionHeader
                title="리그 일정"
                onFilterClick={leagueData && leagueData.leagues.length > 0 ? () => setFilterOpen(true) : undefined}
            />
            {!isLoggedIn || !hasGroups ? (
                <SoftCard>
                    <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                        {!isLoggedIn ? "로그인 후 확인할 수 있습니다." : "클럽에 가입하면 리그 일정을 확인할 수 있습니다."}
                    </Typography>
                </SoftCard>
            ) : leagueLoading ? (
                <SoftCard>
                    <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                        로딩 중...
                    </Typography>
                </SoftCard>
            ) : leagueData && leagueData.leagues.length > 0 ? (
                <Stack spacing={1}>
                    {leagueData.leagues.map((league) => (
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
            <LeagueFilterDialog
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
            />

            {isLoggedIn && isAdmin && (
                <Button
                    component={RouterLink}
                    to="/league"
                    variant="contained"
                    fullWidth
                    sx={{ borderRadius: 1, fontWeight: 700 }}
                >
                    신규 생성
                </Button>
            )}

            {/* 대회 일정 */}
            <SectionHeader title="대회 일정" />
            <SoftCard>
                <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                    {!isLoggedIn ? "로그인 후 확인할 수 있습니다." : !hasGroups ? "클럽에 가입하면 대회 일정을 확인할 수 있습니다." : "개설된 대회가 없습니다."}
                </Typography>
            </SoftCard>
            {isLoggedIn && (
                <Button
                    variant="contained"
                    fullWidth
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
