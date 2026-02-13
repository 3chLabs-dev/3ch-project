import { Box, Typography, IconButton } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate } from "react-router-dom";

export default function NoticePage() {
    const navigate = useNavigate();

    return (
        <Box sx={{ px: 2, pt: 2, width: "100%", maxWidth: 420, mx: "auto" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <IconButton
                    onClick={() => navigate(-1)}
                    disableRipple
                    sx={{ p: 0, "&:hover": { background: "transparent" } }}
                >
                    <ChevronLeftIcon sx={{ fontSize: 28 }} />
                </IconButton>

                <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                    공지사항
                </Typography>
            </Box>

            <Box sx={{ mt: 3 }}>
                <Typography sx={{ color: "text.secondary", fontSize: 14 }}>
                    준비중
                </Typography>
            </Box>
        </Box>
    );
}
