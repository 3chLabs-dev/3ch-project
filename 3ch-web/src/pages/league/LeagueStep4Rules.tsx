import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  Stack,
} from "@mui/material";
import { setStep, setStep4Rules, setStep4TournamentOptions, setStep4MainSetup } from "../../features/league/leagueCreationSlice";
import type { LeagueRuleValue } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

const ALL_RULES = [
  { value: "best-of-3", label: "3전 2선승제" },
  { value: "best-of-5", label: "5전 3선승제" },
  { value: "best-of-7", label: "7전 4선승제" },
  { value: "3-sets",    label: "3세트제" },
] as const;

const LeagueStep4Rules: React.FC = () => {
  const dispatch = useAppDispatch();
  const format   = useAppSelector((s) => s.leagueCreation.step3Format?.format);
  const existing = useAppSelector((s) => s.leagueCreation.step4Rules?.rule ?? "");

  const [rule, setRule] = useState<LeagueRuleValue | "">(existing);

  const handleNext = () => {
    if (!rule) return;
    dispatch(setStep4Rules({ rule }));

    if (format === "upper-lower-tournament") {
      dispatch(setStep4TournamentOptions({ seeding: "seed", advancement: "upper-lower" }));
      dispatch(setStep(5));
    } else if (format === "single-league-tournament") {
      dispatch(setStep4MainSetup({
        advance_count: 8,
        advance_method: "rank",
        seeding: "seed",
        finals_advance: 2,
        tournament_rules: "best-of-5",
      }));
      dispatch(setStep(5));
    } else {
      dispatch(setStep(5));
    }
  };

  const handlePrev = () => dispatch(setStep(3));

  return (
    <Box sx={{ p: 3, maxWidth: 500, mx: "auto" }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>리그 규칙</Typography>

      <FormControl fullWidth>
        <RadioGroup
          value={rule}
          onChange={(e) => setRule(e.target.value as LeagueRuleValue)}
          sx={{ display: "flex", gap: 2 }}
        >
          {ALL_RULES.map((o) => (
            <FormControlLabel
              key={o.value} value={o.value}
              control={<Radio />} label={o.label}
              sx={{
                m: 0, borderRadius: 1, border: "1px solid",
                borderColor: rule === o.value ? "grey.900" : "grey.300",
                bgcolor: "background.paper",
                px: 2, py: 2, boxShadow: rule === o.value ? 2 : 1,
                gap: 1.5, alignItems: "center",
                "& .MuiFormControlLabel-label": { fontSize: 20, fontWeight: 700 },
                "& .MuiRadio-root": { p: 0.5 },
                "&:hover": { borderColor: "grey.700" },
              }}
            />
          ))}
        </RadioGroup>
      </FormControl>

      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          fullWidth variant="contained" disableElevation onClick={handlePrev}
          sx={{ borderRadius: 1, height: 44, fontWeight: 900, bgcolor: "#777777", "&:hover": { bgcolor: "#777777" } }}
        >
          이전
        </Button>
        <Button
          fullWidth variant="contained" disableElevation
          onClick={handleNext} disabled={!rule}
          sx={{
            borderRadius: 1, height: 44, fontWeight: 900,
            bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" },
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
