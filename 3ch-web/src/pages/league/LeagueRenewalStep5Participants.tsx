import { useMemo, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, Divider, Snackbar, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setRenewalParticipants, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";
import type { Participant } from "../../features/league/leagueCreationSlice";
import LoadMembersDialog, { type MemberRow } from "./LoadMembersDialog";
import { mergeMembers } from "./mergeMember";
import LeagueInvitedGroupsPicker from "./LeagueInvitedGroupsPicker";

const headCellSx = { fontSize: 12, fontWeight: 900, color: "#6B7280", textAlign: "center" as const };
const cellCenter = { display: "flex", justifyContent: "center", alignItems: "center" };
const inputSx = {
  "& .MuiOutlinedInput-root": { borderRadius: 0.6, bgcolor: "#fff", height: 30 },
  "& .MuiOutlinedInput-input": { py: 0.3, fontSize: "0.9rem" },
};

export default function LeagueRenewalStep5Participants() {
  const dispatch = useAppDispatch();
  const basicInfo = useAppSelector((state) => state.leagueRenewalCreation.basicInfo);
  const storedParticipants = useAppSelector((state) => state.leagueRenewalCreation.participants);
  const compositionMode = useAppSelector((state) => state.leagueRenewalCreation.compositionMode);
  const [participants, setParticipants] = useState<Participant[]>(storedParticipants);
  const [division, setDivision] = useState("");
  const [name, setName] = useState("");
  const [openLoad, setOpenLoad] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ idx: number; division: string; name: string } | null>(null);
  const targetCount = basicInfo?.participantCount ?? null;
  const isFull = targetCount !== null && participants.length >= targetCount;
  const canAdd = useMemo(() => Boolean(division.trim() && name.trim()), [division, name]);

  const handleAdd = () => {
    if (!canAdd) return;
    if (isFull) {
      setAlertMsg(`모집 인원(${targetCount}명)을 초과할 수 없습니다.`);
      return;
    }
    const next = { division: division.trim(), name: name.trim(), paid: false, arrived: false, after: false };
    if (participants.some((participant) => participant.division === next.division && participant.name === next.name)) return;
    setParticipants((current) => [...current, next]);
    setDivision("");
    setName("");
  };

  const handleConfirmLoad = (selected: MemberRow[]) => {
    const merged = mergeMembers(participants, selected);
    if (targetCount !== null && merged.length > targetCount) {
      setAlertMsg(`모집 인원(${targetCount}명)을 초과하여 추가할 수 없습니다.`);
      setOpenLoad(false);
      return;
    }
    setParticipants(merged);
    setOpenLoad(false);
  };

  const handleNext = () => {
    dispatch(setRenewalParticipants(participants));
    dispatch(setRenewalStep(8));
  };

  return <Box sx={{ px: 2.5, pt: 2 }}>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 0.8 }}>
      <Stack direction="row" spacing={1} alignItems="baseline">
        <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 1 }}>참가자 사전 등록</Typography>
        {targetCount !== null && <Typography sx={{ fontSize: 14, fontWeight: 700, color: isFull ? "#E53935" : "#6B7280" }}>{participants.length}/{targetCount}</Typography>}
      </Stack>
      <Button variant="contained" disableElevation onClick={() => setOpenLoad(true)} sx={{ borderRadius: 1, height: 32, px: 2, fontWeight: 900, bgcolor: "#87B8FF", "&:hover": { bgcolor: "#79AEFF" }, boxShadow: "none" }}>불러오기</Button>
    </Box>
    <Divider sx={{ mb: 1.2, borderColor: "#D9DDE6" }} />

    <Box sx={{ display: "grid", gridTemplateColumns: "56px minmax(0,1fr) 56px", gap: 1, alignItems: "center", px: 0.5, mb: 0.8 }}>
      <Typography sx={headCellSx}>부수</Typography><Typography sx={headCellSx}>이름</Typography><Typography sx={headCellSx}>관리</Typography>
    </Box>
    <Box component="form" onSubmit={(event) => { event.preventDefault(); handleAdd(); }} sx={{ display: "grid", gridTemplateColumns: "56px minmax(0,1fr) 56px", gap: 1, alignItems: "center", px: 0.5, mb: 1.2 }}>
      <TextField placeholder="부수" value={division} onChange={(event) => setDivision(event.target.value)} slotProps={{ htmlInput: { enterKeyHint: "done" } }} sx={inputSx} />
      <Box sx={{ position: "relative", minWidth: 0 }}>
        <TextField placeholder="이름" value={name} onChange={(event) => setName(event.target.value)} slotProps={{ htmlInput: { enterKeyHint: "done" } }} sx={inputSx} fullWidth />
        {canAdd && <Box sx={{ position: "absolute", right: -2, top: -34, bgcolor: "#111827", color: "#fff", px: 1.2, py: 0.6, borderRadius: 1, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", boxShadow: "0 4px 10px rgba(15,23,42,0.18)", zIndex: 2, "&::after": { content: '\"\"', position: "absolute", right: 14, bottom: -5, width: 10, height: 10, bgcolor: "#111827", transform: "rotate(45deg)" } }}>Enter 키를 누르면 추가됩니다.</Box>}
      </Box>
      <Button type="submit" variant="contained" disableElevation disabled={!canAdd} sx={{ borderRadius: 1, height: 30, fontWeight: 900, bgcolor: "#BDBDBD", "&:hover": { bgcolor: "#BDBDBD" }, "&.Mui-disabled": { bgcolor: "#D7D7D7", color: "#fff" } }}>추가</Button>
    </Box>

    {participants.length > 0 && <Box sx={{ borderTop: "1px solid #D9DDE6", borderBottom: "1px solid #D9DDE6" }}>
      {participants.map((participant, index) => <Box key={`${participant.division}-${participant.name}-${index}`} sx={{ display: "grid", gridTemplateColumns: "56px minmax(0,1fr) 56px", gap: 1, alignItems: "center", px: 0.5, py: 0.6, borderTop: index === 0 ? "none" : "1px solid #ECEFF5" }}>
        <Box sx={cellCenter}><Box sx={{ minWidth: 36, height: 36, px: 0.8, borderRadius: 9999, bgcolor: "#FAAA47", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11 }}>{participant.division || "-"}</Box></Box>
        <Typography sx={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{participant.name}</Typography>
        <Box sx={cellCenter}><Button variant="contained" disableElevation onClick={() => setDeleteTarget({ idx: index, division: participant.division, name: participant.name })} sx={{ borderRadius: 1, height: 28, fontWeight: 900, bgcolor: "#D1D5DB", color: "#111827", "&:hover": { bgcolor: "#D1D5DB" } }}>삭제</Button></Box>
      </Box>)}
    </Box>}

    <LeagueInvitedGroupsPicker />

    <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
      <Button fullWidth variant="contained" disableElevation onClick={() => dispatch(setRenewalStep(compositionMode === "recommend" ? 3 : 6))} sx={{ borderRadius: 1, height: 44, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#777" } }}>이전</Button>
      <Button fullWidth variant="contained" disableElevation onClick={handleNext} sx={{ borderRadius: 1, height: 44, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>완료</Button>
    </Stack>

    <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" PaperProps={{ sx: { borderRadius: 2, mx: 2, maxWidth: 430 } }}>
      <DialogContent sx={{ pt: 2.5, pb: 1.5 }}><Typography sx={{ fontWeight: 900, mb: 1 }}>리그 참가자 삭제 확인</Typography><Typography sx={{ fontSize: 15, lineHeight: 1.5 }}>{deleteTarget ? `(${deleteTarget.division})${deleteTarget.name}을 참가자 명단에서 삭제하시겠습니까?` : "참가자를 삭제하시겠습니까?"}</Typography></DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}><Button onClick={() => setDeleteTarget(null)} sx={{ fontWeight: 900, color: "#111827" }}>취소</Button><Button autoFocus onClick={() => { if (deleteTarget) setParticipants((current) => current.filter((_, index) => index !== deleteTarget.idx)); setDeleteTarget(null); }} sx={{ fontWeight: 900, color: "#111827" }}>확인</Button></DialogActions>
    </Dialog>
    <LoadMembersDialog open={openLoad} onClose={() => setOpenLoad(false)} onConfirm={handleConfirmLoad} />
    <Snackbar open={Boolean(alertMsg)} autoHideDuration={3000} onClose={() => setAlertMsg("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}><Alert severity="warning" onClose={() => setAlertMsg("")} sx={{ fontWeight: 700 }}>{alertMsg}</Alert></Snackbar>
  </Box>;
}
