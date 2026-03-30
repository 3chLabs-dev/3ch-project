import { useState, useMemo } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
    Box,
    Stack,
    Typography,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    TextField,
    Button,
} from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { useAppSelector } from "../../app/hooks";
import { useGetMyGroupsQuery, useSearchGroupsQuery, useRecommendGroupsMutation } from "../../features/group/groupApi";
import type { Group, RecommendedClub } from "../../features/group/groupApi";

const SPORT_EMOJI: Record<string, string> = {
    "탁구": "\uD83C\uDFD3",
    "배드민턴": "\uD83C\uDFF8",
    "테니스": "\uD83C\uDFBE",
};

const SPORT_FILTERS = ["탁구", "배드민턴", "스포츠"];

export default function GroupMain() {
    const token = useAppSelector((s) => s.auth.token);
    const isLoggedIn = !!token;

    const { data, isLoading } = useGetMyGroupsQuery(undefined, {
        skip: !isLoggedIn,
        refetchOnMountOrArgChange: true,
    });
    const myGroups = useMemo(() => data?.groups ?? [], [data]);

    const [groupSearch, setGroupSearch] = useState("");
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

    const [recommend, { isLoading: isRecommending }] = useRecommendGroupsMutation();
    const [aiClubs, setAiClubs] = useState<RecommendedClub[] | null>(null);
    const [gpsError, setGpsError] = useState<string | null>(null);

    const handleGpsRecommend = () => {
        setGpsError(null);
        setAiClubs(null);
        if (!navigator.geolocation) {
            setGpsError("이 기기는 위치 서비스를 지원하지 않습니다.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const result = await recommend({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        sport: selectedFilter !== "스포츠" ? selectedFilter ?? undefined : undefined,
                    }).unwrap();
                    setAiClubs(result.clubs);
                } catch {
                    setGpsError("추천을 불러오는 중 오류가 발생했습니다.");
                }
            },
            (err) => {
                if (err.code === 1) setGpsError("위치 권한을 허용해주세요.");
                else if (err.code === 3) setGpsError("위치 요청 시간이 초과됐습니다. 다시 시도해주세요.");
                else setGpsError("위치를 가져올 수 없습니다. (코드: " + err.code + ")");
            },
            { timeout: 8000 }
        );
    };

    // 내 클럽들의 지역을 기반으로 추천 검색
    const myRegionCity = useMemo(() => {
        const firstWithRegion = myGroups.find((g) => g.region_city);
        return firstWithRegion?.region_city ?? "";
    }, [myGroups]);

    const searchParams = useMemo(() => ({
        q: groupSearch || undefined,
        region_city: !groupSearch && myRegionCity ? myRegionCity : undefined,
        limit: 10,
        sort_by_region: !groupSearch && myRegionCity ? true : undefined,
    }), [groupSearch, myRegionCity]);

    const { data: searchData, isLoading: searchLoading } = useSearchGroupsQuery(
        searchParams,
        { skip: !isLoggedIn, refetchOnMountOrArgChange: true },
    );
    const recommendedGroups = searchData?.groups ?? [];

    return (
        <Stack spacing={2.5}>
            {/* 가입한 클럽 */}
            <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
                    가입한 클럽
                </Typography>

                {!isLoggedIn ? (
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
                        </CardContent>
                    </Card>
                ) : isLoading ? (
                    <EmptyCard text="로딩 중..." />
                ) : myGroups.length > 0 ? (
                    <Stack spacing={1}>
                        {myGroups.map((g) => (
                            <GroupCard key={g.id} group={g} />
                        ))}
                    </Stack>
                ) : (
                    <EmptyCard text="가입한 클럽이 없습니다." />
                )}
            </Box>

            {isLoggedIn && (
                <Button
                    component={RouterLink}
                    to="/club/create"
                    variant="contained"
                    fullWidth
                    sx={{ borderRadius: 1, fontWeight: 700 }}
                >
                    클럽 생성
                </Button>
            )}

            {/* AI 클럽 추천 */}
            <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
                    AI 추천 클럽
                </Typography>

                {!isLoggedIn ? (
                    <EmptyCard text="로그인 후 확인할 수 있습니다." />
                ) : (
                    <>
                        {/* 종목 필터 */}
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
                                        "&:hover": { bgcolor: selectedFilter === f ? "#111827" : "#E5E7EB" },
                                    }}
                                />
                            ))}
                        </Stack>

                        {/* GPS AI 추천 버튼 */}
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={isRecommending ? <CircularProgress size={16} /> : <MyLocationIcon />}
                            disabled={isRecommending}
                            onClick={handleGpsRecommend}
                            sx={{
                                borderRadius: 1,
                                fontWeight: 700,
                                mb: 1.5,
                                borderColor: "#2F80ED",
                                color: "#2F80ED",
                                "&:hover": { bgcolor: "rgba(47,128,237,0.06)" },
                            }}
                        >
                            {isRecommending ? "위치 분석 중..." : "내 위치로 AI 추천받기"}
                        </Button>

                        {/* GPS 에러 */}
                        {gpsError && (
                            <Typography sx={{ fontSize: 13, color: "#E53935", mb: 1, fontWeight: 600 }}>
                                {gpsError}
                            </Typography>
                        )}

                        {/* AI 추천 결과 */}
                        {aiClubs !== null && (
                            <Box sx={{ mb: 2 }}>
                                {aiClubs.length > 0 ? (
                                    <Stack spacing={1}>
                                        {aiClubs.map((g) => (
                                            <NearbyGroupCard key={g.id} group={g} />
                                        ))}
                                    </Stack>
                                ) : (
                                    <EmptyCard text="주변에 추천 클럽이 없습니다." />
                                )}
                            </Box>
                        )}

                        {/* 텍스트 검색 */}
                        <TextField
                            placeholder="클럽 검색"
                            size="small"
                            value={groupSearch}
                            onChange={(e) => setGroupSearch(e.target.value)}
                            fullWidth
                            sx={{
                                "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: "#F9FAFB", height: 38 },
                                "& .MuiOutlinedInput-input": { py: 0.8, fontSize: "0.9rem" },
                                mb: 1.5,
                            }}
                        />

                        {searchLoading ? (
                            <EmptyCard text="검색 중..." />
                        ) : recommendedGroups.length > 0 ? (
                            <Stack spacing={1}>
                                {recommendedGroups.map((g) => (
                                    <RecommendedGroupCard key={g.id} group={g} />
                                ))}
                            </Stack>
                        ) : groupSearch ? (
                            <EmptyCard text="검색 결과가 없습니다." />
                        ) : null}
                    </>
                )}
            </Box>
        </Stack>
    );
}

function GroupCard({ group }: { group: Group }) {
    const navigate = useNavigate();
    const emoji = group.sport ? (SPORT_EMOJI[group.sport] ?? "\uD83C\uDFD3") : "\uD83C\uDFD3";
    const region = [group.region_city, group.region_district].filter(Boolean).join(" ");

    return (
        <Card
            elevation={2}
            onClick={() => navigate(`/club/${group.club_code ?? group.id}/manage`)}
            sx={{
                borderRadius: 1,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                cursor: "pointer",
            }}
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
                </Stack>
            </CardContent>
        </Card>
    );
}

function RecommendedGroupCard({ group }: { group: Omit<Group, "role"> & { id: string } }) {
    const navigate = useNavigate();
    const emoji = group.sport ? (SPORT_EMOJI[group.sport] ?? "\uD83C\uDFD3") : "\uD83C\uDFD3";
    const region = [group.region_city, group.region_district].filter(Boolean).join(" ");

    return (
        <Card
            elevation={2}
            onClick={() => navigate(`/club/${group.club_code ?? group.id}`)}
            sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer" }}
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
                </Stack>
            </CardContent>
        </Card>
    );
}

function NearbyGroupCard({ group }: { group: RecommendedClub }) {
    const navigate = useNavigate();
    const emoji = group.sport ? (SPORT_EMOJI[group.sport] ?? "\uD83C\uDFD3") : "\uD83C\uDFD3";
    const region = [group.region_city, group.region_district].filter(Boolean).join(" ");

    return (
        <Card
            elevation={2}
            onClick={() => navigate(`/club/${group.club_code ?? group.id}`)}
            sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer" }}
        >
            <CardContent sx={{ py: 1.6, px: 2, "&:last-child": { pb: 1.6 } }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Typography sx={{ fontSize: 28, lineHeight: 1 }}>{emoji}</Typography>
                    <Box flex={1} minWidth={0}>
                        <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>
                            {group.name}
                        </Typography>
                        <Stack direction="row" spacing={0.8} mt={0.3} flexWrap="wrap">
                            {region && (
                                <Typography sx={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{region}</Typography>
                            )}
                            <Typography sx={{ fontSize: 11, color: "#2F80ED", fontWeight: 700 }}>
                                {group.distance_km != null ? `${Number(group.distance_km).toFixed(1)}km` : "지역 기반"}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
                                회원 {group.member_count}명
                            </Typography>
                        </Stack>
                    </Box>
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
                <Typography color="text.secondary" fontWeight={700} fontSize={16}>
                    {text}
                </Typography>
            </CardContent>
        </Card>
    );
}
