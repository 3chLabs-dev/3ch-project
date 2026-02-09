import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Checkbox,
  Stack,
  Divider,
} from "@mui/material";
import { setStep, setStep5Participants } from "../../features/league/leagueCreationSlice";
import type { Participant } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import LoadMembersDialog, { type MemberRow } from "./LoadMembersDialog";
import { mergeMembers } from "./mergeMember";

const headCellSx = {
  fontSize: 12,
  fontWeight: 900,
  color: "#6B7280",
  textAlign: "center" as const,
};

const cellCenter = { display: "flex", justifyContent: "center", alignItems: "center" };

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 0.6,
    bgcolor: "#fff",
    height: 30,
  },
  "& .MuiOutlinedInput-input": {
    py: 0.3,
    fontSize: "0.9rem",
  },
};

export default function LeagueStep5Participants() {
  const dispatch = useAppDispatch();
  const existing = useAppSelector((s) => s.leagueCreation.step5Participants?.participants ?? []);

  const [participants, setParticipants] = useState<Participant[]>(existing);

  // 입력 폼(부수/이름)
  const [division, setDivision] = useState("");
  const [name, setName] = useState("");

  // 불러오기 팝업
  const [openLoad, setOpenLoad] = useState(false);

  const canAdd = useMemo(() => Boolean(division.trim() && name.trim()), [division, name]);
  const canNext = participants.length > 0;

  const handleAdd = () => {
    if (!canAdd) return;

    const d = division.trim();
    const n = name.trim();

    // 중복 방지(부수+이름 기준)
    if (participants.some((p) => p.division === d && p.name === n)) return;

    setParticipants((prev) => [
      ...prev,
      { division: d, name: n, paid: false, arrived: false, footPool: false },
    ]);

    setDivision("");
    setName("");
  };

  const handleToggle = (idx: number, key: "paid" | "arrived" | "footPool") => {
    setParticipants((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [key]: !p[key] } : p))
    );
  };

  const handlePrev = () => {
    dispatch(setStep(4));
  };

  const handleNext = () => {
    dispatch(setStep5Participants({ participants }));
    dispatch(setStep(6));
  };

  const handleOpenLoad = () => setOpenLoad(true);
  const handleCloseLoad = () => setOpenLoad(false);

  const handleConfirmLoad = (selected: MemberRow[]) => {
    setParticipants((prev) => mergeMembers(prev, selected));
    setOpenLoad(false);
  };

  return (
    <Box sx={{ px: 2.5, pt: 2 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 1 }}>
        리그 참가자
      </Typography>

      <Divider sx={{ mb: 1.2, borderColor: "#D9DDE6" }} />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "64px 1fr 44px 44px 56px",
          gap: 1,
          alignItems: "center",
          px: 0.5,
          mb: 0.8,
        }}
      >
        <Typography sx={headCellSx}>부수</Typography>
        <Typography sx={headCellSx}>이름</Typography>
        <Typography sx={headCellSx}>입금</Typography>
        <Typography sx={headCellSx}>도착</Typography>
        <Typography sx={headCellSx}>풋풀이</Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "64px 1fr 44px 44px 56px",
          gap: 1,
          alignItems: "center",
          px: 0.5,
          mb: 1.2,
        }}
      >
        <TextField
          placeholder="부수"
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          sx={inputSx}
        />
        <TextField
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={inputSx}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />

        <Box sx={cellCenter}><Checkbox disabled size="small" /></Box>
        <Box sx={cellCenter}><Checkbox disabled size="small" /></Box>
        <Box sx={cellCenter}><Checkbox disabled size="small" /></Box>
      </Box>

      {/* 추가하기 / 불러오기 */}
      <Stack spacing={1.2} sx={{ mb: 2 }}>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={handleAdd}
          disabled={!canAdd}
          sx={{
            borderRadius: 1,
            height: 40,
            fontWeight: 900,
            bgcolor: "#BDBDBD",
            "&:hover": { bgcolor: "#BDBDBD" },
            "&.Mui-disabled": { bgcolor: "#D7D7D7", color: "#fff" },
          }}
        >
          추가하기
        </Button>

        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={handleOpenLoad}
          sx={{
            borderRadius: 1,
            height: 40,
            fontWeight: 900,
            bgcolor: "#87B8FF",
            "&:hover": { bgcolor: "#79AEFF" },
          }}
        >
          불러오기
        </Button>
      </Stack>

      {/* 참가자 리스트(표 형태) */}
      {participants.length > 0 && (
        <Box
          sx={{
            borderTop: "1px solid #D9DDE6",
            borderBottom: "1px solid #D9DDE6",
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {participants.map((p, idx) => (
            <Box
              key={`${p.division}-${p.name}-${idx}`}
              sx={{
                display: "grid",
                gridTemplateColumns: "64px 1fr 44px 44px 56px",
                gap: 1,
                alignItems: "center",
                px: 0.5,
                py: 0.8,
                borderTop: idx === 0 ? "none" : "1px solid #ECEFF5",
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                {p.division}
              </Typography>

              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                {p.name}
              </Typography>

              <Box sx={cellCenter}>
                <Checkbox
                  size="small"
                  checked={p.paid}
                  onChange={() => handleToggle(idx, "paid")}
                />
              </Box>

              <Box sx={cellCenter}>
                <Checkbox
                  size="small"
                  checked={p.arrived}
                  onChange={() => handleToggle(idx, "arrived")}
                />
              </Box>

              <Box sx={cellCenter}>
                <Checkbox
                  size="small"
                  checked={p.footPool}
                  onChange={() => handleToggle(idx, "footPool")}
                />
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* 하단 이전/완료 */}
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
          disabled={!canNext}
          sx={{
            borderRadius: 1,
            height: 44,
            fontWeight: 900,
            bgcolor: "#2F80ED",
            "&:hover": { bgcolor: "#256FD1" },
            "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" },
          }}
        >
          완료
        </Button>
      </Stack>

      {/* 불러오기 팝업 */}
      <LoadMembersDialog
        open={openLoad}
        onClose={handleCloseLoad}
        onConfirm={handleConfirmLoad}
      />
    </Box>
  );
}
