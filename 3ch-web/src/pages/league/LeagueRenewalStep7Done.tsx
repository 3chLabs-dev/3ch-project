import { useEffect, useRef } from "react";
import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { resetRenewalLeagueCreation } from "../../features/league/leagueRenewalCreationSlice";
import confettiImg from "../../assets/128_축포.png";

export default function LeagueRenewalStep7Done() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const leagueId = useAppSelector((state) => state.leagueRenewalCreation.createdLeagueId);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fire = (originX: number, angle: number) => confetti({
      particleCount: 6,
      angle,
      spread: 50,
      origin: { x: originX, y: 0.65 },
      colors: ["#2F80ED", "#56CCF2", "#F2994A", "#27AE60", "#EB5757"],
      zIndex: 9999,
    });
    let count = 0;
    animationRef.current = setInterval(() => {
      fire(0.1, 60);
      fire(0.9, 120);
      if (++count >= 8 && animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    }, 200);
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, []);

  const handleConfirm = () => {
    if (animationRef.current) clearInterval(animationRef.current);
    dispatch(resetRenewalLeagueCreation());
    navigate(leagueId ? `/league/${leagueId}` : "/league");
  };

  const handleGoToMain = () => {
    if (animationRef.current) clearInterval(animationRef.current);
    dispatch(resetRenewalLeagueCreation());
    navigate("/league");
  };

  return <Box sx={{ px: 2.5, pt: 2 }}>
    <Typography sx={{ fontSize: 32, fontWeight: 900, textAlign: "center", mt: 2, color: "#2F80ED" }}>리그 생성 완료</Typography>
    <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: "center", mt: 1, color: "#6B7280" }}>이제 우리리그에서 리그를 진행할 수 있습니다!</Typography>
    <Box sx={{ mt: 3, width: "100%", height: 200, borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Box component="img" src={confettiImg} alt="축하" sx={{ width: 180, height: 180, objectFit: "contain" }} />
    </Box>
    <Button fullWidth variant="contained" disableElevation onClick={handleConfirm} sx={{ mt: 3, borderRadius: 1, height: 44, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>리그 바로가기</Button>
    <Button fullWidth variant="outlined" onClick={handleGoToMain} sx={{ mt: 1.5, borderRadius: 1, height: 44, fontWeight: 900 }}>메인으로</Button>
  </Box>;
}
