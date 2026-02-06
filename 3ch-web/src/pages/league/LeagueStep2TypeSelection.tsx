import React, { useState } from "react";
import { Box, Typography, Button, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel } from "@mui/material";
import { setStep, setStep2Type } from "../../features/league/leagueCreationSlice";
import type { LeagueTypeValue } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

const LeagueTypeOptions = [
  { value: "singles", label: "단식" },
  { value: "doubles", label: "복식" },
  { value: "2-person-team", label: "2인 단체전" },
  { value: "3-person-team", label: "3인 단체전" },
  { value: "4-person-team", label: "4인 단체전" },
] as const;

const LeagueStep2TypeSelection: React.FC = () => {
  const dispatch = useAppDispatch();
  const existingType = useAppSelector((s) => s.leagueCreation.step2Type?.selectedType ?? "");

  const [selectedType, setSelectedType] = useState<LeagueTypeValue | "">(existingType);

  const handleNext = () => {
    if (!selectedType) return;
    dispatch(setStep2Type({ selectedType }));
    dispatch(setStep(3));
  };

  const handlePrev = () => {
    dispatch(setStep(1));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 500, mx: "auto" }}>
      <Typography variant="h5" fontWeight={900} gutterBottom>
        리그 유형 선택
      </Typography>

      <FormControl component="fieldset" margin="normal" fullWidth>
        <FormLabel component="legend">유형</FormLabel>
        <RadioGroup
          aria-label="league-type"
          name="league-type-group"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as LeagueTypeValue)}
        >
          {LeagueTypeOptions.map((option) => (
            <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} />
          ))}
        </RadioGroup>
      </FormControl>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}>
        <Button variant="outlined" onClick={handlePrev}>
          이전
        </Button>
        <Button variant="contained" onClick={handleNext} disabled={!selectedType}>
          다음
        </Button>
      </Box>
    </Box>
  );
};

export default LeagueStep2TypeSelection;
