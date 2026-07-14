import { useMemo, useRef, useState } from "react";
import { Box, Button, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setRenewalBasicInfo, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";

const rowSx = { display: "grid", gridTemplateColumns: "72px 1fr", alignItems: "center", gap: 2, py: 1.2, borderBottom: "1px solid #D9DDE6" };
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 0.6, bgcolor: "#fff", height: 32 }, "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.95rem" } };
const selectSx = { height: 32, flex: 1, borderRadius: 0.6, bgcolor: "#fff", fontSize: "0.95rem" };
const hours = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, "0"));
const minutes = ["00", "10", "20", "30", "40", "50"];
const participantCounts = [4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];

function RequiredMark() { return <Box component="span" sx={{ color: "#EF4444", fontSize: 18 }}>*</Box>; }

export default function LeagueRenewalStep1BasicInfo() {
  const dispatch = useAppDispatch();
  const existing = useAppSelector((state) => state.leagueRenewalCreation.basicInfo);
  const dateRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(existing?.date ?? "");
  const [startTime, setStartTime] = useState(existing?.startTime ?? "");
  const [endTime, setEndTime] = useState(existing?.endTime ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [participantCount, setParticipantCount] = useState<number | "">(existing?.participantCount ?? "");
  const [courtCount, setCourtCount] = useState<number | "">(existing?.courtCount ?? "");
  const [startHour, startMinute] = startTime ? startTime.split(":") : ["", ""];
  const [endHour, endMinute] = endTime ? endTime.split(":") : ["", ""];
  const canNext = useMemo(() => Boolean(title && date && startTime), [date, startTime, title]);

  const saveAndNext = () => {
    if (!canNext) return;
    dispatch(setRenewalBasicInfo({ title, date, startTime, endTime, location, participantCount: participantCount === "" ? null : participantCount, courtCount: courtCount === "" ? null : courtCount }));
    dispatch(setRenewalStep(2));
  };

  const timeSelect = (value: string, placeholder: string, onChange: (value: string) => void, options: string[]) => (
    <Select displayEmpty value={value} onChange={(event) => onChange(String(event.target.value))} sx={selectSx}>
      <MenuItem value="" disabled>{placeholder}</MenuItem>
      {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
    </Select>
  );

  return <Box sx={{ px: 2.5, pt: 2 }}>
    <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>리그 정보</Typography>
    <Box sx={{ borderTop: "1px solid #D9DDE6" }}>
      <Box sx={rowSx}><Typography sx={{ fontWeight: 900 }}>리그명 <RequiredMark /></Typography><TextField value={title} onChange={(event) => setTitle(event.target.value)} sx={fieldSx} /></Box>
      <Box sx={{ ...rowSx, cursor: "pointer" }} onClick={() => dateRef.current?.showPicker()}><Typography sx={{ fontWeight: 900 }}>날짜 <RequiredMark /></Typography><TextField inputRef={dateRef} type="date" value={date} onChange={(event) => setDate(event.target.value)} sx={fieldSx} /></Box>
      <Box sx={rowSx}>
        <Typography sx={{ fontWeight: 900 }}>시간 <RequiredMark /></Typography>
        <Stack spacing={1}>
          <Stack direction="row" spacing={0.8} alignItems="center"><Typography sx={{ width: 34, fontWeight: 700 }}>시작</Typography>{timeSelect(startHour, "시", (value) => setStartTime(`${value}:${startMinute || "00"}`), hours)}<Typography>:</Typography>{timeSelect(startMinute, "분", (value) => setStartTime(`${startHour || "00"}:${value}`), minutes)}</Stack>
          <Stack direction="row" spacing={0.8} alignItems="center"><Typography sx={{ width: 34, fontWeight: 700 }}>종료</Typography>{timeSelect(endHour, "시", (value) => setEndTime(`${value}:${endMinute || "00"}`), hours)}<Typography>:</Typography>{timeSelect(endMinute, "분", (value) => setEndTime(`${endHour || "00"}:${value}`), minutes)}</Stack>
        </Stack>
      </Box>
      <Box sx={rowSx}><Typography sx={{ fontWeight: 900 }}>장소</Typography><TextField value={location} onChange={(event) => setLocation(event.target.value)} sx={fieldSx} /></Box>
      <Box sx={rowSx}><Typography sx={{ fontWeight: 900 }}>참가자 수</Typography><TextField select value={participantCount} onChange={(event) => setParticipantCount(event.target.value === "" ? "" : Number(event.target.value))} SelectProps={{ displayEmpty: true }} sx={{ ...fieldSx, "& .MuiSelect-select": { color: participantCount === "" ? "#B0B5BD" : "inherit" } }}><MenuItem value="" sx={{ color: "#B0B5BD" }}>선택</MenuItem>{participantCounts.map((count) => <MenuItem key={count} value={count}>{count}명</MenuItem>)}</TextField></Box>
      <Box sx={rowSx}><Typography sx={{ fontWeight: 900 }}>탁구대 수</Typography><TextField select value={courtCount} onChange={(event) => setCourtCount(event.target.value === "" ? "" : Number(event.target.value))} SelectProps={{ displayEmpty: true }} sx={{ ...fieldSx, "& .MuiSelect-select": { color: courtCount === "" ? "#B0B5BD" : "inherit" } }}><MenuItem value="" sx={{ color: "#B0B5BD" }}>선택</MenuItem>{[1, 2, 3, 4, 5, 6, 8, 10, 12].map((count) => <MenuItem key={count} value={count}>{count}대</MenuItem>)}</TextField></Box>
    </Box>
    <Stack direction="row" spacing={2} sx={{ mt: 4 }}><Button fullWidth variant="contained" disableElevation onClick={() => dispatch(setRenewalStep(0))} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#777" } }}>이전</Button><Button fullWidth variant="contained" disableElevation disabled={!canNext} onClick={saveAndNext} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" }, "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" } }}>다음</Button></Stack>
  </Box>;
}
