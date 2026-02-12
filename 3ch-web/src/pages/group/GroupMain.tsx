import { useState, useMemo } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
    Box,
    Stack,
    Typography,
    Card,
    CardContent,
    Chip,
    IconButton,
    TextField,
    Button,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAppSelector } from "../../app/hooks";
import { useGetMyGroupsQuery, useSearchGroupsQuery, useJoinGroupMutation } from "../../features/group/groupApi";
import type { Group } from "../../features/group/groupApi";
import { isGroupAdmin } from "../../utils/permissions";

const SPORT_EMOJI: Record<string, string> = {
    "탁구": "\uD83C\uDFD3",
    "배드민턴": "\uD83C\uDFF8",
    "테니스": "\uD83C\uDFBE",
};

const SPORT_FILTERS = ["탁구", "배드민턴", "스포츠"];

export default function GroupMain() {
    const token = useAppSelector((s) => s.auth.token);
    const isLoggedIn = !!token;

    const { data, isLoading } = useGetMyGroupsQuery(undefined, { skip: !isLoggedIn });
    const myGroups = useMemo(() => data?.groups ?? [], [data]);

    const [groupSearch, setGroupSearch] = useState("");
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

    // 내 모임들의 지역을 기반으로 추천 검색
    const myRegionCity = useMemo(() => {
        const firstWithRegion = myGroups.find((g) => g.region_city);
        return firstWithRegion?.region_city ?? "";
    }, [myGroups]);

    const searchParams = useMemo(() => ({
        q: groupSearch || undefined,
        region_city: !groupSearch && myRegionCity ? myRegionCity : undefined,
        limit: 10,
    }), [groupSearch, myRegionCity]);

    const { data: searchData, isLoading: searchLoading } = useSearchGroupsQuery(
        searchParams,
        { skip: !isLoggedIn },
    );
    const recommendedGroups = searchData?.groups ?? [];

    return (
        <Stack spacing={2.5}>
            {/* 가입한 모임 */}
            <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
                    가입한 모임
                </Typography>

                {!isLoggedIn ? (
                    <EmptyCard text="로그인 후 확인할 수 있습니다." />
                ) : isLoading ? (
                    <EmptyCard text="로딩 중..." />
                ) : myGroups.length > 0 ? (
                    <Stack spacing={1}>
                        {myGroups.map((g) => (
                            <GroupCard key={g.id} group={g} />
                        ))}
                    </Stack>
                ) : (
                    <EmptyCard text="가입한 모임이 없습니다." />
                )}
            </Box>

            {isLoggedIn && (
                <Button
                    component={RouterLink}
                    to="/group/create"
                    variant="contained"
                    fullWidth
                    sx={{ borderRadius: 1, fontWeight: 700 }}
                >
                    모임 생성
                </Button>
            )}

            {/* AI 모임 추천 */}
            <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                        AI 모임 추천
                    </Typography>
                    <IconButton size="small">
                        <SettingsIcon fontSize="small" />
                    </IconButton>
                </Stack>

                <Stack direction="row" spacing={0.8} sx={{ mb: 1.5 }}>
                    {SPORT_FILTERS.map((f) => (
                        <Chip
                            key={f}
                            label={f}
                            size="small"
                            onClick={() => setSelectedFilter(selectedFilter === f ? null : f)}
                            sx={{
                                fontWeight: 700,
                                fontSize: 12,
                                bgcolor: selectedFilter === f ? "#111827" : "#F3F4F6",
                                color: selectedFilter === f ? "#fff" : "#374151",
                                "&:hover": {
                                    bgcolor: selectedFilter === f ? "#111827" : "#E5E7EB",
                                },
                            }}
                        />
                    ))}
                </Stack>

                {/* 모임 검색 */}
                <Stack direction="row" spacing={0.8} sx={{ mb: 1.5 }}>
                    <TextField
                        placeholder="모임 검색"
                        size="small"
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        fullWidth
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 1,
                                bgcolor: "#F9FAFB",
                                height: 38,
                            },
                            "& .MuiOutlinedInput-input": {
                                py: 0.8,
                                fontSize: "0.9rem",
                            },
                        }}
                    />
                </Stack>

                {searchLoading ? (
                    <EmptyCard text="검색 중..." />
                ) : recommendedGroups.length > 0 ? (
                    <Stack spacing={1}>
                        {recommendedGroups.map((g) => (
                            <RecommendedGroupCard key={g.id} group={g} />
                        ))}
                    </Stack>
                ) : (
                    <EmptyCard text={groupSearch ? "검색 결과가 없습니다." : "추천 모임이 없습니다."} />
                )}
            </Box>
        </Stack>
    );
}

function GroupCard({ group }: { group: Group }) {
    const navigate = useNavigate();
    const emoji = SPORT_EMOJI["탁구"] ?? "\u26BD";
    const region = [group.region_city, group.region_district].filter(Boolean).join(" ");
    const canManage = isGroupAdmin(group);

    return (
        <Card
            elevation={2}
            sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
        >
            <CardContent sx={{ py: 1.6, px: 2, "&:last-child": { pb: 1.6 } }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Typography sx={{ fontSize: 28, lineHeight: 1 }}>{emoji}</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 15, flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                        {group.name}
                    </Typography>
                    {region && (
                        <Chip
                            label={region}
                            size="small"
                            sx={{
                                bgcolor: "#E5E7EB",
                                color: "#374151",
                                fontWeight: 600,
                                fontSize: 11,
                                height: 24,
                            }}
                        />
                    )}
                    {canManage && (
                        <IconButton
                            size="small"
                            onClick={() => navigate(`/group/${group.id}/manage`)}
                            sx={{ ml: 0.5 }}
                        >
                            <SettingsIcon fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

function RecommendedGroupCard({ group }: { group: Omit<Group, "role"> & { id: string } }) {
    const [joinGroup, { isLoading }] = useJoinGroupMutation();
    const emoji = SPORT_EMOJI["탁구"] ?? "\u26BD";
    const region = [group.region_city, group.region_district].filter(Boolean).join(" ");

    const handleJoin = async () => {
        try {
            await joinGroup(group.id).unwrap();
        } catch (error) {
            console.error("Failed to join group:", error);
        }
    };

    return (
        <Card
            elevation={2}
            sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
        >
            <CardContent sx={{ py: 1.6, px: 2, "&:last-child": { pb: 1.6 } }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Typography sx={{ fontSize: 28, lineHeight: 1 }}>{emoji}</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 15, flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                        {group.name}
                    </Typography>
                    {region && (
                        <Chip
                            label={region}
                            size="small"
                            sx={{
                                bgcolor: "#E5E7EB",
                                color: "#374151",
                                fontWeight: 600,
                                fontSize: 11,
                                height: 24,
                            }}
                        />
                    )}
                    <Button
                        onClick={handleJoin}
                        disabled={isLoading}
                        size="small"
                        variant="contained"
                        sx={{
                            borderRadius: 1,
                            fontWeight: 700,
                            fontSize: 12,
                            minWidth: "auto",
                            px: 1.5,
                        }}
                    >
                        {isLoading ? "가입 중..." : "가입"}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}

function EmptyCard({ text }: { text: string }) {
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                "&:last-child": { pb: 2.5 },
            }}>
                <Typography color="text.secondary" fontWeight={700} fontSize={14}>
                    {text}
                </Typography>
            </CardContent>
        </Card>
    );
}
