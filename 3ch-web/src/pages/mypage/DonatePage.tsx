import { Box, Typography, IconButton } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate } from "react-router-dom";

export default function DonatePage() {
    const navigate = useNavigate();

    return (
        <Box sx={{ width: "100%", maxWidth: 420, mx: "auto", mt: "-4px" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <IconButton
                    onClick={() => navigate(-1)}
                    disableRipple
                    sx={{ p: 0, "&:hover": { background: "transparent" } }}
                >
                    <ChevronLeftIcon sx={{ fontSize: 28 }} />
                </IconButton>

                <Typography sx={{ fontSize: 20, fontWeight: 900 }}>
                    후원하기
                </Typography>
            </Box>

            <Box sx={{ mt: 3 }}>
                <Typography sx={{ mx: 2, color: "text.secondary", fontSize: 14 }}>
                    준비중
                </Typography>
            </Box>
        </Box>
    );
}
