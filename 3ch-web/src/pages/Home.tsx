// src/pages/Home.tsx
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
    Box,
    Stack,
    Typography,
    Card,
    CardContent,
    Button,
    Link,
    Collapse,
    IconButton,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TuneIcon from "@mui/icons-material/Tune";

import { useAppSelector } from "../app/hooks";
import { useGetLeaguesQuery } from "../features/league/leagueApi";
import type { LeagueListItem } from "../features/league/leagueApi";
import { useGetMyGroupsQuery } from "../features/group/groupApi";

type Props = {
    // isLoggedIn?: boolean;
    userName?: string;
};

export default function Home({ userName = "우리리그" }: Props) {
    const [bizOpen, setBizOpen] = useState(false);

    const token = useAppSelector((state) => state.auth.token);
    const user = useAppSelector((state) => state.auth.user);
    const isLoggedIn = !!token;

    const { data: groupData } = useGetMyGroupsQuery(undefined, { skip: !isLoggedIn });
    const hasGroups = (groupData?.groups?.length ?? 0) > 0;

    const { data: leagueData, isLoading: leagueLoading } = useGetLeaguesQuery(
        isLoggedIn && user?.id ? { my_groups: true, user_id: user.id } : undefined,
        { skip: !isLoggedIn || !hasGroups }
    );

    const displayName = isLoggedIn
        ? (user?.name || user?.email || userName)
        : userName;

    return (
        <Stack spacing={2.5}>

            {/* 큰 타이틀 */}
            <Box>
                <Typography variant="h5" fontWeight={900} lineHeight={1.1}>
                    {displayName}
                </Typography>
            </Box>

            {/* 로그인/임시 모임 카드 */}
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
            ) : hasGroups ? (
                <SoftCard>
                    <Stack alignItems="center" spacing={1.2}>
                        <Typography fontWeight={800}>
                            {groupData!.groups[0].name}
                        </Typography>
                        <Typography color="text.secondary" fontWeight={700}>
                            멤버 {groupData!.groups[0].member_count}명
                        </Typography>
                    </Stack>
                </SoftCard>
            ) : (
                <SoftCard>
                    <Stack alignItems="center" spacing={1.2}>
                        <Typography fontWeight={800}>환영합니다!</Typography>
                        <Typography color="text.secondary" fontWeight={700}>
                            모임 없음
                        </Typography>
                    </Stack>
                </SoftCard>
            )}

            {/* 리그 일정 */}
            <SectionHeader title="리그 일정" />
            {!isLoggedIn || !hasGroups ? (
                <SoftCard>
                    <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                        {!isLoggedIn ? "로그인 후 확인할 수 있습니다." : "모임에 가입하면 리그 일정을 확인할 수 있습니다."}
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
            {isLoggedIn && (
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
                    {!isLoggedIn ? "로그인 후 확인할 수 있습니다." : !hasGroups ? "모임에 가입하면 대회 일정을 확인할 수 있습니다." : "개설된 대회가 없습니다."}
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

            <Box sx={{ pt: 1 }}>
                <Box
                    onClick={() => setBizOpen((v) => !v)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        userSelect: "none",
                        py: 1,
                    }}
                >
                    <Typography variant="body2" fontWeight={800}>
                        3ch 사업자 정보
                    </Typography>
                    <IconButton size="small" sx={{ transform: bizOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                        <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Collapse in={bizOpen} timeout={180}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", pb: 1 }}>
                        대표: 조하진 · 사업자등록번호: 000-00-00000
                        <br />
                        주소: 서울특별시 임시주소
                        <br />
                        고객센터: 0000-0000 · 이메일: 3chlabs@gmail.com
                    </Typography>
                </Collapse>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Link href="#" underline="hover" variant="body2" fontWeight={700}>
                        이용약관
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                        |
                    </Typography>
                    <Link href="#" underline="hover" variant="body2" fontWeight={700}>
                        개인정보 처리방침
                    </Link>
                </Stack>

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1.2, display: "block" }}
                >
                    Copyright 3ch. All rights reserved.
                </Typography>
            </Box>
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
            <CardContent sx={{
                py: 2.2, display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
            }}>
                {children}
            </CardContent>
        </Card>
    );
}
