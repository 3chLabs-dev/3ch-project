import React, { useState } from "react";
import { Box, Typography, Button, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel } from "@mui/material";
import { setStep, setStep3Format } from "../../features/league/leagueCreationSlice";
import type { LeagueFormatValue } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

const LeagueFormatOptions = [
  { value: "single-league", label: "단일리그" },
  { value: "group-league", label: "조별리그" },
  { value: "group-and-knockout", label: "조별리그 + 본선리그" },
] as const;

const LeagueStep3FormatSelection: React.FC = () => {
  const dispatch = useAppDispatch();
  const existingFormat = useAppSelector((s) => s.leagueCreation.step3Format?.format ?? "");

  const [selectedFormat, setSelectedFormat] = useState<LeagueFormatValue | "">(existingFormat);

  const handleNext = () => {
    if (!selectedFormat) return;
    dispatch(setStep3Format({ format: selectedFormat }));
    dispatch(setStep(4));
  };

  const handlePrev = () => {
    dispatch(setStep(2));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 500, mx: "auto" }}>
      <Typography variant="h5" fontWeight={900} gutterBottom>
        리그 방식 선택
      </Typography>

      <FormControl component="fieldset" margin="normal" fullWidth>
        <FormLabel component="legend">방식</FormLabel>
        <RadioGroup
          aria-label="league-format"
          name="league-format-group"
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value as LeagueFormatValue)}
        >
          {LeagueFormatOptions.map((option) => (
            <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} />
          ))}
        </RadioGroup>
      </FormControl>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}>
        <Button variant="outlined" onClick={handlePrev}>
          이전
        </Button>
        <Button variant="contained" onClick={handleNext} disabled={!selectedFormat}>
          다음
        </Button>
      </Box>
    </Box>
  );
};

export default LeagueStep3FormatSelection;
