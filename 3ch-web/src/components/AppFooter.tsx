import { useState } from "react";
import { Box, Collapse, IconButton, Link, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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
                    대표: 조하진 · 사업자등록번호: 000-00-00000
                    <br />주소: 서울특별시 임시주소
                    <br />고객센터: 0000-0000 · 이메일: 3chlabs@gmail.com
                </Typography>
            </Collapse>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Copyright 3ch. All rights reserved.
            </Typography>
        </Box>
    );
}
