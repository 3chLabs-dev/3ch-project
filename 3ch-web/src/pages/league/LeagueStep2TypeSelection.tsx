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
    <Box sx={{ p: 3, maxWidth: 420, mx: "auto" }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>
        리그 유형
      </Typography>

      <FormControl fullWidth>
        <RadioGroup
          name="league-type-group"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as LeagueTypeValue)}
          sx={{ display: "flex", gap: 2 }}
        >
          {LeagueTypeOptions.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              label={option.label}
              control={<Radio />}
              sx={{
                m: 0,
                borderRadius: 2,
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

                ...(selectedType === option.value && {
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
          disabled={!selectedType}
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

export default LeagueStep2TypeSelection;
