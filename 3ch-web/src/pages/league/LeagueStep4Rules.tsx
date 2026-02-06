import React, { useState } from "react";
import { Box, Typography, Button, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel } from "@mui/material";
import { setStep, setStep4Rules } from "../../features/league/leagueCreationSlice";
import type { LeagueRuleValue } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

const LeagueRulesOptions = [
  { value: "best-of-3", label: "3전 2선승제" },
  { value: "best-of-5", label: "5전 3선승제" },
  { value: "best-of-7", label: "7전 4선승제" },
  { value: "3-sets", label: "3세트제" },
] as const;

const LeagueStep4Rules: React.FC = () => {
  const dispatch = useAppDispatch();
  const existingRule = useAppSelector((s) => s.leagueCreation.step4Rules?.rule ?? "");

  const [selectedRule, setSelectedRule] = useState<LeagueRuleValue | "">(existingRule);

  const handleNext = () => {
    if (!selectedRule) return;
    dispatch(setStep4Rules({ rule: selectedRule }));
    dispatch(setStep(5));
  };

  const handlePrev = () => {
    dispatch(setStep(3));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 500, mx: "auto" }}>
      <Typography variant="h5" fontWeight={900} gutterBottom>
        리그 규칙 선택
      </Typography>

      <FormControl component="fieldset" margin="normal" fullWidth>
        <FormLabel component="legend">규칙</FormLabel>
        <RadioGroup
          aria-label="league-rules"
          name="league-rules-group"
          value={selectedRule}
          onChange={(e) => setSelectedRule(e.target.value as LeagueRuleValue)}
        >
          {LeagueRulesOptions.map((option) => (
            <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} />
          ))}
        </RadioGroup>
      </FormControl>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}>
        <Button variant="outlined" onClick={handlePrev}>
          이전
        </Button>
        <Button variant="contained" onClick={handleNext} disabled={!selectedRule}>
          다음
        </Button>
      </Box>
    </Box>
  );
};

export default LeagueStep4Rules;
