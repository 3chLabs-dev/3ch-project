import { Box, Typography, Button } from "@mui/material";
import { useAppDispatch } from "../../app/hooks";
import { resetLeagueCreation, setStep } from "../../features/league/leagueCreationSlice";

export default function LeagueStep7Done() {
  const dispatch = useAppDispatch();

  const handleOk = () => {
    dispatch(resetLeagueCreation());
    dispatch(setStep(0));
  };

  return (
    <Box sx={{ px: 2.5, pt: 2 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, textAlign: "center", mt: 2 }}>
        리그 생성 완료
      </Typography>

      <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: "center", mt: 1, color: "#6B7280" }}>
        이제 우리리그에서 리그를 진행할 수 있습니다!
      </Typography>

      <Box
        sx={{
          mt: 3,
          width: "100%",
          height: 200,
          border: "2px solid #2F80ED",
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#2F80ED",
          fontWeight: 900,
        }}
      >
        {/* SVG/이미지 넣어야됨... */}
        🎉
      </Box>

      <Button
        fullWidth
        variant="contained"
        disableElevation
        onClick={handleOk}
        sx={{
          mt: 3,
          borderRadius: 1,
          height: 44,
          fontWeight: 900,
          bgcolor: "#2F80ED",
          "&:hover": { bgcolor: "#256FD1" },
        }}
      >
        확인
      </Button>
    </Box>
  );
}
