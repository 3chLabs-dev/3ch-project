import { Box, IconButton, Link, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate } from "react-router-dom";
import { LICENSE_ITEMS } from "./licenseData";

export default function LicensePage() {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                width: "100%",
                mx: "auto",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <IconButton
                        onClick={() => navigate("/mypage")}
                        disableRipple
                        sx={{ p: 0, "&:hover": { background: "transparent" } }}
                    >
                        <ChevronLeftIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                    <Typography sx={{ fontSize: 20, fontWeight: 900 }}>라이선스 및 저작권</Typography>
                </Box>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    pb: 2,
                    mx: 2,
                    mt: "-4px",
                    fontSize: 13,
                    lineHeight: 1.75,
                }}
            >
                <Typography sx={{ fontSize: 13, lineHeight: 1.75, mb: 3 }}>
                    우리리그 서비스에서 사용되는 일부 콘텐츠 및 리소스는 제3자가 제공하는 자료를 이용하고 있으며,
                    각 제공자의 라이선스 및 이용 조건에 따라 사용하고 있습니다.
                </Typography>

                {LICENSE_ITEMS.map((license) => (
                    <Box component="section" key={license.provider} sx={{ mb: 3 }}>
                        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, mb: 0.5 }}>
                            {license.provider}
                        </Typography>
                        <Typography sx={{ fontSize: 13, lineHeight: 1.75, mb: 1.5 }}>
                            {license.description}
                        </Typography>

                        <Stack component="ul" spacing={1.25} sx={{ m: 0, pl: 2.5 }}>
                            {license.attributions.map((attribution) => (
                                <Box component="li" key={`${attribution.usage}-${attribution.text}`}>
                                    <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.15 }}>
                                        {attribution.usage}
                                    </Typography>
                                    <Link
                                        href={attribution.href}
                                        title={attribution.title}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        underline="hover"
                                        sx={{ fontSize: 13, fontWeight: 600 }}
                                    >
                                        {attribution.text}
                                    </Link>
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
