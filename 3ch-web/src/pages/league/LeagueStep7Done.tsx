import { Box, Typography, Button } from "@mui/material";
import { useAppDispatch } from "../../app/hooks";
// import { resetLeagueCreation, setStep } from "../../features/league/leagueCreationSlice";
import { setStep } from "../../features/league/leagueCreationSlice";
import CelebrationOutlinedIcon from "@mui/icons-material/CelebrationOutlined";

export default function LeagueStep7Done() {
  const dispatch = useAppDispatch();

  const handleOk = () => {
    // TODO: 향후 리그 상세 페이지 구현 시 아래 주석 해제
    // const createdLeagueId = useAppSelector((s) => s.leagueCreation.createdLeagueId);
    // if (createdLeagueId) {
    //   navigate(`/league/${createdLeagueId}`);
    // }

    // 상태 초기화 후 리그 메인으로 이동
    // dispatch(resetLeagueCreation());
    // dispatch(setStep(0));
    // 표 출력을 위한 임시변경
    dispatch(setStep(8));

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
        <CelebrationOutlinedIcon sx={{ fontSize: 92, color: "#4E8DF5" }} />
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
