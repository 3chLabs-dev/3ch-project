import { useState } from "react";
import { Box, Button, FormControl, FormControlLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setRenewalConfiguration, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";
import type { LeagueTypeValue } from "../../features/league/leagueCreationSlice";

const options: Array<{ value: LeagueTypeValue; label: string }> = [
  { value: "singles", label: "단식" },
  { value: "doubles", label: "복식" },
  { value: "team", label: "단체전" },
  { value: "club_event", label: "클럽 이벤트" },
];

export default function LeagueRenewalStep2Type() {
  const dispatch = useAppDispatch();
  const configuration = useAppSelector((state) => state.leagueRenewalCreation.configuration);
  const [type, setType] = useState<LeagueTypeValue | "">(configuration.type ?? "");
  const [teamPlayerCount, setTeamPlayerCount] = useState(configuration.teamPlayerCount);

  const handleNext = () => {
    if (!type) return;
    dispatch(setRenewalConfiguration({ type, teamPlayerCount }));
    dispatch(setRenewalStep(5));
  };

  return (
    <Box sx={{ px: 2.5, pt: 2 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>리그 유형</Typography>
      <FormControl fullWidth>
        <RadioGroup value={type} onChange={(event) => setType(event.target.value as LeagueTypeValue)}>
          <Stack spacing={1}>
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={<Radio />}
                label={option.label}
                sx={{ m: 0, px: 1, minHeight: 52, border: "1px solid", borderColor: type === option.value ? "primary.main" : "divider", borderRadius: 1, bgcolor: type === option.value ? "#EFF6FF" : "#fff" }}
              />
            ))}
          </Stack>
        </RadioGroup>
      </FormControl>
      {type === "team" && (
        <TextField select fullWidth label="팀 인원 수" value={teamPlayerCount} onChange={(event) => setTeamPlayerCount(Number(event.target.value))} sx={{ mt: 2, "& .MuiOutlinedInput-root": { borderRadius: 1 } }}>
          {[2, 3, 4, 5].map((count) => <MenuItem key={count} value={count}>{count}명</MenuItem>)}
        </TextField>
      )}
      <Stack direction="row" spacing={1.5} sx={{ mt: 4 }}>
        <Button fullWidth variant="contained" disableElevation onClick={() => dispatch(setRenewalStep(2))} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#666" } }}>이전</Button>
        <Button fullWidth variant="contained" disableElevation disabled={!type} onClick={handleNext} sx={{ height: 44, borderRadius: 1, fontWeight: 900 }}>다음</Button>
      </Stack>
    </Box>
  );
}
