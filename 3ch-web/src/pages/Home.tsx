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

type Props = {
    isLoggedIn?: boolean;
    userName?: string;
};

export default function Home({ isLoggedIn = false, userName = "우리리그" }: Props) {
    const [bizOpen, setBizOpen] = useState(false);

    return (
        <Stack spacing={2.5}>

            {/* 큰 타이틀 */}
            <Box>
                <Typography variant="h5" fontWeight={900} lineHeight={1.1}>
                    {userName}
                </Typography>
                <Typography variant="h6" fontWeight={900} sx={{ mt: 0.5 }}>
                    참가자
                </Typography>
            </Box>

            {/* 로그인 카드 */}
            <SoftCard>
                <Stack alignItems="center" spacing={1.2}>
                    <Typography fontWeight={800}>로그인을 해주세요.</Typography>
                    <Button component={RouterLink} to="/login" variant="contained" size="medium" sx={{ px: 3, borderRadius: 2 }}>
                        로그인
                    </Button>
                </Stack>
            </SoftCard>

            {/* 진행중 경기 */}
            <SectionTitle title="나의 진행중 경기" />
            <SoftCard>
                <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                    진행중인 경기가 없습니다.
                </Typography>
            </SoftCard>

            {/* 종료 경기 */}
            <SectionTitle title="나의 종료 경기" />
            <SoftCard>
                <Typography textAlign="center" color="text.secondary" fontWeight={700}>
                    종료된 경기가 없습니다.
                </Typography>
            </SoftCard>

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
                        (주)3CH 사업자 정보
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
                    Copyright Woorimoim Inc. All rights reserved.
                </Typography>
            </Box>
        </Stack>
    );
}

function SectionTitle({ title }: { title: string }) {
    return (
        <Typography variant="subtitle1" fontWeight={900} sx={{ mt: 0.5 }}>
            {title}
        </Typography>
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
            <CardContent sx={{ py: 2.2 }}>{children}</CardContent>
        </Card>
    );
}
