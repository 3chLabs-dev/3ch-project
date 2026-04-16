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
  { value: "singles", label: "단식", disabled: false },
  { value: "doubles", label: "복식", disabled: true },
  { value: "team", label: "단체전", disabled: true },
  { value: "club_battle", label: "클럽 대항전", disabled: true },
  { value: "club_exchange", label: "클럽 교류전", disabled: true },
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
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <span>{option.label}</span>
                  {option.disabled && (
                    <Typography component="span" sx={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", bgcolor: "#F3F4F6", px: 0.8, py: 0.2, borderRadius: 0.5 }}>
                      준비중
                    </Typography>
                  )}
                </Box>
              }
              disabled={option.disabled}
              control={<Radio />}
              sx={{
                m: 0,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "grey.300",
                bgcolor: option.disabled ? "#F9FAFB" : "background.paper",
                px: 2,
                py: 2,
                boxShadow: 1,
                gap: 1.5,
                alignItems: "center",

                "& .MuiFormControlLabel-label": {
                  fontSize: 20,
                  fontWeight: 700,
                },

                ...(!option.disabled && selectedType === option.value && {
                  borderColor: "grey.900",
                  boxShadow: 2,
                }),

                "& .MuiRadio-root": {
                  p: 0.5,
                },

                "&:hover": {
                  borderColor: option.disabled ? "grey.300" : "grey.700",
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
