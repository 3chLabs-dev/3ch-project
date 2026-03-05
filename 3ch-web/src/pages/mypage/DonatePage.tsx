import { useState } from "react";
import { Box, Typography, IconButton, Stack, Button, Snackbar, Divider } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useNavigate } from "react-router-dom";

const BANK = "우리은행";
const ACCOUNT = "1002-123-123456";
const HOLDER = "조하진";

export default function DonatePage() {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(ACCOUNT);
        } catch {
            const el = document.createElement("textarea");
            el.value = ACCOUNT;
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
        }
        setCopied(true);
    };

    return (
        <Stack spacing={0} sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>후원하기</Typography>
            </Stack>

            {/* 히어로 섹션 */}
            <Box
                sx={{
                    borderRadius: 3,
                    background: "linear-gradient(135deg, #667eea 0%, #f093fb 100%)",
                    p: 4,
                    mb: 3,
                    textAlign: "center",
                    position: "relative",
                    overflow: "hidden",
                    "&::before": {
                        content: '""',
                        position: "absolute",
                        top: -30,
                        right: -30,
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        bgcolor: "rgba(255,255,255,0.1)",
                    },
                    "&::after": {
                        content: '""',
                        position: "absolute",
                        bottom: -20,
                        left: -20,
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        bgcolor: "rgba(255,255,255,0.08)",
                    },
                }}
            >
                <Typography sx={{ fontSize: 72, lineHeight: 1, mb: 1.5, userSelect: "none" }}>
                    🫶
                </Typography>
                <Typography fontSize={20} fontWeight={900} color="#fff" sx={{ mb: 0.5 }}>
                    우리리그를 응원해주세요
                </Typography>
                <Typography fontSize={13} color="rgba(255,255,255,0.85)" fontWeight={500} lineHeight={1.6}>
                    여러분의 소중한 후원이<br />서비스 발전의 밑거름이 됩니다
                </Typography>
            </Box>

            {/* 계좌 정보 카드 */}
            <Box
                sx={{
                    borderRadius: 2.5,
                    border: "1.5px solid #E5E7EB",
                    overflow: "hidden",
                    mb: 3,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
            >
                {/* 카드 헤더 */}
                <Box
                    sx={{
                        px: 2.5,
                        py: 1.5,
                        bgcolor: "#F8FAFF",
                        borderBottom: "1px solid #E5E7EB",
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <AccountBalanceIcon sx={{ fontSize: 16, color: "#6366F1" }} />
                    <Typography fontSize={13} fontWeight={800} color="#374151">
                        후원 계좌 안내
                    </Typography>
                </Box>

                {/* 계좌 정보 행 */}
                <Stack divider={<Divider />}>
                    <InfoRow label="예금주" value={HOLDER} />
                    <InfoRow label="은행" value={BANK} />
                    <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Box>
                            <Typography fontSize={12} color="#9CA3AF" fontWeight={600} sx={{ mb: 0.3 }}>
                                계좌번호
                            </Typography>
                            <Typography fontSize={17} fontWeight={900} color="#1F2937" letterSpacing={0.5}>
                                {ACCOUNT}
                            </Typography>
                        </Box>
                        <IconButton
                            onClick={handleCopy}
                            size="small"
                            sx={{
                                bgcolor: "#EEF2FF",
                                color: "#6366F1",
                                "&:hover": { bgcolor: "#E0E7FF" },
                                borderRadius: 1.5,
                                p: 1,
                            }}
                        >
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Stack>
            </Box>

            {/* 복사 버튼 */}
            <Button
                fullWidth
                variant="contained"
                disableElevation
                onClick={handleCopy}
                startIcon={<ContentCopyIcon />}
                sx={{
                    borderRadius: 2,
                    fontWeight: 800,
                    fontSize: 15,
                    py: 1.6,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    "&:hover": {
                        background: "linear-gradient(135deg, #5a6fd6 0%, #6a4292 100%)",
                    },
                }}
            >
                계좌번호 복사하기
            </Button>

            <Snackbar
                open={copied}
                autoHideDuration={2000}
                onClose={() => setCopied(false)}
                message="계좌번호가 복사되었습니다."
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            />
        </Stack>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ px: 2.5, py: 1.8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography fontSize={12} color="#9CA3AF" fontWeight={600}>{label}</Typography>
            <Typography fontSize={14} fontWeight={700} color="#374151">{value}</Typography>
        </Box>
    );
}
