import { Box, Typography } from "@mui/material";

export default function AdminInquiryPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 2, color: "#1F2937" }}>문의사항</Typography>
      <Box sx={{ mt: 6, display: "flex", justifyContent: "center" }}>
        <Typography sx={{ fontSize: 14, color: "#9CA3AF", fontWeight: 600 }}>
          준비 중입니다.
        </Typography>
      </Box>
    </Box>
  );
}
