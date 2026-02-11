import React, { useMemo, useState, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setStep, setStep1BasicInfo } from "../../features/league/leagueCreationSlice";
import { Box, Typography, TextField, Button, Stack, MenuItem, Select } from "@mui/material";

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

// 시간 옵션 (00 ~ 23)
const generateHourOptions = () => {
  return Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
};

// 분 옵션 (00, 10, 20, 30, 40, 50)
const generateMinuteOptions = () => {
  return ['00', '10', '20', '30', '40', '50'];
};

const LeagueStep1BasicInfo: React.FC = () => {
  const dispatch = useAppDispatch();
  const existing = useAppSelector((s) => s.leagueCreation.step1BasicInfo);

  const dateRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(existing?.date ?? "");
  const [time, setTime] = useState(existing?.time ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");

  // 시간을 hour와 minute로 분리
  const [hour, minute] = time ? time.split(':') : ['', ''];

  const hourOptions = useMemo(() => generateHourOptions(), []);
  const minuteOptions = useMemo(() => generateMinuteOptions(), []);

  const handleHourChange = (newHour: string) => {
    setTime(`${newHour}:${minute || '00'}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    setTime(`${hour || '00'}:${newMinute}`);
  };

  // 다음 버튼 활성
  const canNext = useMemo(() => Boolean(date && time), [date, time]);

  const handleNext = () => {
    dispatch(
      setStep1BasicInfo({
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
        <Box sx={{...rowSx, cursor: "pointer"}} onClick={() => dateRef.current?.showPicker()}>
          <Typography sx={{ fontWeight: 900, letterSpacing: 6 }}>날짜</Typography>

          <TextField
            inputRef={dateRef}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            sx={inputSx}
          />
        </Box>

        {/* 시간 */}
        <Box sx={rowSx}>
          <Typography sx={{ fontWeight: 900, letterSpacing: 6 }}>시간</Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* 시 */}
            <Select
              value={hour}
              onChange={(e) => handleHourChange(e.target.value)}
              displayEmpty
              sx={{
                borderRadius: 0.6,
                bgcolor: "#fff",
                height: 32,
                fontSize: "0.95rem",
                flex: 1,
              }}
            >
              <MenuItem value="" disabled>
                시
              </MenuItem>
              {hourOptions.map((h) => (
                <MenuItem key={h} value={h}>
                  {h}
                </MenuItem>
              ))}
            </Select>

            <Typography sx={{ alignSelf: 'center' }}>:</Typography>

            {/* 분 */}
            <Select
              value={minute}
              onChange={(e) => handleMinuteChange(e.target.value)}
              displayEmpty
              sx={{
                borderRadius: 0.6,
                bgcolor: "#fff",
                height: 32,
                fontSize: "0.95rem",
                flex: 1,
              }}
            >
              <MenuItem value="" disabled>
                분
              </MenuItem>
              {minuteOptions.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </Box>
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
