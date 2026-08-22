import { useState } from "react";
import { Box, Collapse, IconButton, Link, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const socialLinks = [
    { label: "카카오톡", href: "http://pf.kakao.com/_NSrKX", icon: "/images/social/footer_icon_kakao.png" },
    { label: "인스타그램", href: "https://www.instagram.com/woori_league/", icon: "/images/social/footer_icon_instagram.png" },
    { label: "유튜브", href: "https://www.youtube.com/@woorileague", icon: "/images/social/footer_icon_youtube.png" },
    { label: "틱톡", href: "https://www.tiktok.com/@woori_league", icon: "/images/social/footer_icon_tiktok.png" },
];

export default function AppFooter() {
    const [bizOpen, setBizOpen] = useState(false);

    return (
        <Box sx={{ pt: 6, pb: 1, px: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Link href="/mypage/guide" underline="hover" variant="body2" fontWeight={800} sx={{ color: "#4F46E5" }}>
                    이용방법
                </Link>
                <Typography variant="body2" color="text.secondary">|</Typography>
                <Link href="/mypage/terms" underline="hover" variant="body2" fontWeight={700}>이용약관</Link>
                <Typography variant="body2" color="text.secondary">|</Typography>
                <Link href="/mypage/privacy" underline="hover" variant="body2" fontWeight={700}>개인정보 처리방침</Link>
            </Stack>

            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ py: 1.5 }}>
                {socialLinks.map(({ label, href, icon }) => (
                    <Link
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${label} 새 창에서 열기`}
                        sx={{ display: "inline-flex", borderRadius: "50%" }}
                    >
                        <Box component="img" src={icon} alt="" sx={{ width: 36, height: 36, display: "block" }} />
                    </Link>
                ))}
            </Stack>

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
                <Typography variant="body2" fontWeight={800}>3ch 사업자 정보</Typography>
                <IconButton size="small" sx={{ transform: bizOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                    <ExpandMoreIcon fontSize="small" />
                </IconButton>
            </Box>

            <Collapse in={bizOpen} timeout={180}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", pb: 1 }}>
                    대표: 조하진
                    <br />사업자등록번호: 467-04-03722
                    <br />주소: 서울특별시 광진구 광나루로 478, 광진경제허브센터 도약관 102-11호
                    <br />이메일: 3chlabs@gmail.com
                    <br />전화번호: 010-7106-5673
                </Typography>
            </Collapse>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Copyright 3ch. All rights reserved.
            </Typography>
        </Box>
    );
}
