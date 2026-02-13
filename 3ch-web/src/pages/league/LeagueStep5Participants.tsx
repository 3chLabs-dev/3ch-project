import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Checkbox,
  Stack,
  Divider,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from "@mui/material";
import { createLeague, setStep, setStep5Participants } from "../../features/league/leagueCreationSlice";
import type { Participant } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import LoadMembersDialog, { type MemberRow } from "./LoadMembersDialog";
import { mergeMembers } from "./mergeMember";
import type { SelectChangeEvent } from "@mui/material";

const headCellSx = {
  fontSize: 12,
  fontWeight: 900,
  color: "#6B7280",
  textAlign: "center" as const,
};

const tightCheckboxSx = {
  p: 0,
  "& .MuiSvgIcon-root": { fontSize: 20 },
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

const smallBtnSx = (bg: string, hover: string, color = "#fff") => ({
  borderRadius: 1,
  height: 32,
  px: 2,
  fontWeight: 900,
  bgcolor: bg,
  color,
  "&:hover": { bgcolor: hover },
  boxShadow: "none",
});

export default function LeagueStep5Participants() {
  const dispatch = useAppDispatch();
  const existing = useAppSelector((s) => s.leagueCreation.step5Participants?.participants ?? []);

  const [participants, setParticipants] = useState<Participant[]>(existing);

  const [recruitCount, setRecruitCount] = useState<number | "">("");
  
  const [division, setDivision] = useState("");
  const [name, setName] = useState("");

  const [openLoad, setOpenLoad] = useState(false);

  const isFull = recruitCount !== "" && participants.length >= recruitCount;
  const canAdd = useMemo(() => Boolean(division.trim() && name.trim()), [division, name]);
  const canNext = participants.length > 0;
  const [alertMsg, setAlertMsg] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{ idx: number; division: string; name: string } | null>(null);
  const [openCancelDialog, setOpenCancelDialog] = useState<boolean>(false);

  const handleCancelDelete = () => {
    setOpenCancelDialog(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setParticipants((prev) => prev.filter((_, i) => i !== deleteTarget.idx));
    setOpenCancelDialog(false);
  };

  const handleAdd = () => {
    if (!canAdd) return;

    if (isFull) {
      setAlertMsg(`모집 인원(${recruitCount}명)을 초과할 수 없습니다.`);
      return;
    }

    const d = division.trim();
    const n = name.trim();

    if (participants.some((p) => p.division === d && p.name === n)) return;

    setParticipants((prev) => [
      ...prev,
      { division: d, name: n, paid: false, arrived: false, footPool: false },
    ]);

    setDivision("");
    setName("");
  };

  const handleDelete = (idx: number) => {
    const p = participants[idx];
    if (!p) return;

    setDeleteTarget({ idx, division: p.division, name: p.name });
    setOpenCancelDialog(true);
  };


  const handleToggle = (idx: number, key: "paid" | "arrived" | "footPool") => {
    setParticipants((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: !p[key] } : p)));
  };

  const handlePrev = () => {
    dispatch(setStep(4));
  };

  const handleNext = () => {
    dispatch(setStep5Participants({ participants, recruitCount: recruitCount === "" ? null : recruitCount }));

    dispatch(setStep(6));
    dispatch(createLeague())
  };

  const handleOpenLoad = () => setOpenLoad(true);
  const handleCloseLoad = () => setOpenLoad(false);

  const handleConfirmLoad = (selected: MemberRow[]) => {
    const merged = mergeMembers(participants, selected);
    if (recruitCount !== "" && merged.length > recruitCount) {
      setAlertMsg(`모집 인원(${recruitCount}명)을 초과하여 추가할 수 없습니다.`);
      setOpenLoad(false);
      return;
    }
    setParticipants(merged);
    setOpenLoad(false);
  };

  return (
    <Box sx={{ px: 2.5, pt: 2 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 1 }}>
        모집 인원
      </Typography>

      <FormControl sx={{ width: 140, mb: 4 }}>
        <Select
          displayEmpty
          value={recruitCount === "" ? "" : String(recruitCount)}
          onChange={(e: SelectChangeEvent<string>) => {
            const v = e.target.value;
            setRecruitCount(v === "" ? "" : Number(v));
          }}
          size="small"
          sx={{
            borderRadius: 0.6,
            bgcolor: "#fff",
            height: 34,
            "& .MuiSelect-select": { fontWeight: 700, py: 0.6 },
          }}
        >
          <MenuItem value="">
            <em>-선택-</em>
          </MenuItem>

          {[4, 6, 8, 10, 12, 16, 20, 24, 32].map((n) => (
            <MenuItem key={n} value={String(n)}>
              {n}명
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 0.8 }}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 1 }}>
            리그 참가자
          </Typography>
          {recruitCount !== "" && (
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: isFull ? "#E53935" : "#6B7280" }}>
              {participants.length}/{recruitCount}
            </Typography>
          )}
        </Stack>

        <Button
          variant="contained"
          disableElevation
          onClick={handleOpenLoad}
          sx={smallBtnSx("#87B8FF", "#79AEFF")}
        >
          불러오기
        </Button>
      </Box>

      <Divider sx={{ mb: 1.2, borderColor: "#D9DDE6" }} />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "56px minmax(0,1fr) 36px 36px 44px 56px",
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
        <Typography sx={headCellSx}>뒷풀이</Typography>
        <Typography sx={headCellSx}>추가/삭제</Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "56px minmax(0,1fr) 36px 36px 44px 56px",
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

        <Box sx={cellCenter}>
          <Checkbox disabled size="small" />
        </Box>
        <Box sx={cellCenter}>
          <Checkbox disabled size="small" />
        </Box>
        <Box sx={cellCenter}>
          <Checkbox disabled size="small" />
        </Box>

        <Button
          variant="contained"
          disableElevation
          onClick={handleAdd}
          disabled={!canAdd}
          sx={{
            borderRadius: 1,
            height: 30,
            fontWeight: 900,
            bgcolor: "#BDBDBD",
            "&:hover": { bgcolor: "#BDBDBD" },
            "&.Mui-disabled": { bgcolor: "#D7D7D7", color: "#fff" },
          }}
        >
          추가
        </Button>
      </Box>

      {participants.length > 0 && (
        <Box
          sx={{
            borderTop: "1px solid #D9DDE6",
            borderBottom: "1px solid #D9DDE6",
          }}
        >
          {participants.map((p, idx) => (
            <Box
              key={`${p.division}-${p.name}-${idx}`}
              sx={{
                display: "grid",
                gridTemplateColumns: "56px minmax(0,1fr) 36px 36px 44px 56px",
                gap: 1,
                alignItems: "center",
                px: 0.5,
                py: 0.6,
                borderTop: idx === 0 ? "none" : "1px solid #ECEFF5",
              }}
            >
              <Box sx={{ ...cellCenter }}>
                <Box
                  sx={{
                    minWidth: 34,
                    height: 22,
                    px: 1,
                    borderRadius: 999,
                    bgcolor: "#E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 12,
                    color: "#111827",
                  }}
                >
                  {p.division}
                </Box>
              </Box>

              <Typography sx={{
                fontWeight: 900,
                fontSize: 16,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {p.name}
              </Typography>

              <Box sx={cellCenter}>
                <Checkbox sx={tightCheckboxSx} size="small" checked={p.paid} onChange={() => handleToggle(idx, "paid")} />
              </Box>

              <Box sx={cellCenter}>
                <Checkbox sx={tightCheckboxSx} size="small" checked={p.arrived} onChange={() => handleToggle(idx, "arrived")} />
              </Box>

              <Box sx={cellCenter}>
                <Checkbox sx={tightCheckboxSx} size="small" checked={p.footPool} onChange={() => handleToggle(idx, "footPool")} />
              </Box>

              <Box sx={cellCenter}>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => handleDelete(idx)}
                  sx={{
                    borderRadius: 1,
                    height: 28,
                    fontWeight: 900,
                    bgcolor: "#D1D5DB",
                    color: "#111827",
                    "&:hover": { bgcolor: "#D1D5DB" },
                  }}
                >
                  삭제
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

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

      {/* Cancel Dialog */}
      <Dialog
        open={openCancelDialog}
        onClose={handleCancelDelete}
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 2,
            mx: 2,
            maxWidth: 430,
          },
        }}
      >
        <DialogContent sx={{ pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>
            리그 참가자 추가/삭제 확인
          </Typography>

          <Typography sx={{ fontSize: 15, lineHeight: 1.5 }}>
            {deleteTarget
              ? `"(${deleteTarget.division})${deleteTarget.name}"를 참가자 명단에서 삭제하겠습니까?`
              : "참가자를 삭제하겠습니까?"}
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button
            onClick={handleCancelDelete}
            sx={{ fontWeight: 900, color: "#111827" }}
          >
            취소
          </Button>

          <Button
            onClick={handleConfirmDelete}
            autoFocus
            sx={{ fontWeight: 900, color: "#111827" }}
          >
            확인
          </Button>
        </DialogActions>
      </Dialog>


      <LoadMembersDialog open={openLoad} onClose={handleCloseLoad} onConfirm={handleConfirmLoad} />

      <Snackbar
        open={!!alertMsg}
        autoHideDuration={3000}
        onClose={() => setAlertMsg("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setAlertMsg("")} sx={{ fontWeight: 700 }}>
          {alertMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
