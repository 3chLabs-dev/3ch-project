import { useState } from "react";
import { Box, Button, FormControl, FormControlLabel, Radio, RadioGroup, Stack, Typography } from "@mui/material";
import { useAppDispatch } from "../../app/hooks";
import { setRenewalCompositionMode, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";

export default function LeagueRenewalStep2Composition() {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<"recommend" | "custom" | "">("");
  const handleNext = () => {
    if (!mode) return;
    dispatch(setRenewalCompositionMode(mode));
    dispatch(setRenewalStep(mode === "recommend" ? 3 : 4));
  };
  return (
    <Box sx={{ px: 2.5, pt: 2 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>리그 구성</Typography>
      <FormControl fullWidth><RadioGroup value={mode} onChange={(event) => setMode(event.target.value as "recommend" | "custom")}><Stack spacing={1.5}><FormControlLabel value="recommend" control={<Radio />} label={<Box><Typography fontWeight={900}>추천 프로그램</Typography><Typography sx={{ mt: 0.5, color: "text.secondary", fontSize: 14 }}>AI가 자동으로 만들어주는 프로그램을 선택하여 리그를 생성할 수 있습니다.</Typography></Box>} sx={{ m: 0, minHeight: 104, px: 2, border: "1px solid", borderColor: mode === "recommend" ? "#2F80ED" : "#D9DDE6", borderRadius: 1, bgcolor: mode === "recommend" ? "#EFF6FF" : "#fff" }} /><FormControlLabel value="custom" control={<Radio />} label={<Box><Typography fontWeight={900}>직접 구성하기</Typography><Typography sx={{ mt: 0.5, color: "text.secondary", fontSize: 14 }}>리그 유형, 방식, 옵션 등을 라운드별로 직접 선택하여 리그를 생성할 수 있습니다.</Typography></Box>} sx={{ m: 0, minHeight: 104, px: 2, border: "1px solid", borderColor: mode === "custom" ? "#2F80ED" : "#D9DDE6", borderRadius: 1, bgcolor: mode === "custom" ? "#EFF6FF" : "#fff" }} /></Stack></RadioGroup></FormControl>
      <Stack direction="row" spacing={2} sx={{ mt: 4 }}><Button fullWidth variant="contained" disableElevation onClick={() => dispatch(setRenewalStep(1))} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#777" } }}>이전</Button><Button fullWidth variant="contained" disableElevation disabled={!mode} onClick={handleNext} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" }, "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" } }}>다음</Button></Stack>
    </Box>
  );
}
