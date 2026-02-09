import React, { useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setStep, setStep1BasicInfo } from "../../features/league/leagueCreationSlice";
import { Box, Typography, TextField, Button, Stack } from "@mui/material";

const rowSx = {
  display: "grid",
  gridTemplateColumns: "72px 1fr",
  alignItems: "center",
  gap: 2,
  py: 1.2,
  borderBottom: "1px solid #D9DDE6",
};

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 0.6,
    bgcolor: "#fff",
    height: 32,
  },
  "& .MuiOutlinedInput-input": {
    py: 0.5,
    fontSize: "0.95rem",
  },
};

const LeagueStep1BasicInfo: React.FC = () => {
  const dispatch = useAppDispatch();
  const existing = useAppSelector((s) => s.leagueCreation.step1BasicInfo);

  const [date, setDate] = useState(existing?.date ?? "");
  const [time, setTime] = useState(existing?.time ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");

  // 다음 버튼 활성
  const canNext = useMemo(() => Boolean(date && time), [date, time]);

  const handleNext = () => {
    dispatch(
      setStep1BasicInfo({
        name: existing?.name ?? "",
        description: existing?.description ?? "",
        date,
        time,
        location,
      })
    );
    dispatch(setStep(2));
  };

  const handlePrev = () => {
    dispatch(setStep(0));
  };

  return (
    <Box sx={{ px: 2.5, pt: 2 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>
        리그 정보
      </Typography>

      <Box sx={{ borderTop: "1px solid #D9DDE6" }}>
        {/* 날짜 */}
        <Box sx={rowSx}>
          <Typography sx={{ fontWeight: 900, letterSpacing: 6 }}>날짜</Typography>
          <TextField
            placeholder="날짜"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            sx={inputSx}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        {/* 시간 */}
        <Box sx={rowSx}>
          <Typography sx={{ fontWeight: 900, letterSpacing: 6 }}>시간</Typography>
          <TextField
            placeholder="시간"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            sx={inputSx}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        {/* 장소 */}
        <Box sx={rowSx}>
          <Typography sx={{ fontWeight: 900, letterSpacing: 6 }}>장소</Typography>
          <TextField
            placeholder="장소"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            sx={inputSx}
          />
        </Box>
      </Box>

      {/* 하단 버튼 */}
      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={handlePrev}
          disableElevation
          sx={{
            borderRadius: 1,
            height: 44,
            fontWeight: 900,
            bgcolor: "#777777",
            "&:hover": { bgcolor: "#777777" },
          }}
        >
          이전
        </Button>

        <Button
          fullWidth
          variant="contained"
          onClick={handleNext}
          disableElevation
          disabled={!canNext}
          sx={{
            borderRadius: 1,
            height: 44,
            fontWeight: 900,
            bgcolor: "#2F80ED",
            "&:hover": { bgcolor: "#256FD1" },
            "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" },
          }}
        >
          다음
        </Button>
      </Stack>
    </Box>
  );
};

export default LeagueStep1BasicInfo;
