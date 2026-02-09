import React, { useState } from "react";
import { 
  Box, 
  Typography, 
  Button, 
  RadioGroup, 
  FormControlLabel, 
  Radio, 
  FormControl, 
  Stack 
} from "@mui/material";
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
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>
        리그 규칙
      </Typography>

      <FormControl fullWidth>
        <RadioGroup
          aria-label="league-rules"
          name="league-rules-group"
          value={selectedRule}
          onChange={(e) => setSelectedRule(e.target.value as LeagueRuleValue)}
          sx={{ display: "flex", gap: 2 }}
        >
          {LeagueRulesOptions.map((option) => (
            <FormControlLabel 
              key={option.value} 
              value={option.value} 
              control={<Radio />} 
              label={option.label}
              sx={{
                m: 0,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "grey.300",
                bgcolor: "background.paper",
                px: 2,
                py: 2,
                boxShadow: 1,
                gap: 1.5,
                alignItems: "center",

                "& .MuiFormControlLabel-label": {
                  fontSize: 20,
                  fontWeight: 700,
                },

                ...(selectedRule === option.value && {
                  borderColor: "grey.900",
                  boxShadow: 2,
                }),

                "& .MuiRadio-root": {
                  p: 0.5,
                },

                // hover
                "&:hover": {
                  borderColor: "grey.700",
                },
              }}
            />
          ))}
        </RadioGroup>
      </FormControl>

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
                disabled={!selectedRule}
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

export default LeagueStep4Rules;
