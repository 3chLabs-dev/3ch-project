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
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>
        리그 방식
      </Typography>

      <FormControl fullWidth>
        <RadioGroup
          aria-label="league-format"
          name="league-format-group"
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value as LeagueFormatValue)}
          sx={{ display: "flex", gap: 2}}
        >
          {LeagueFormatOptions.map((option) => (
            <FormControlLabel 
              key={option.value} 
              value={option.value} 
              label={option.label} 
              control={<Radio />} 
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

                ...(selectedFormat === option.value && {
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
          disabled={!selectedFormat}
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

export default LeagueStep3FormatSelection;
