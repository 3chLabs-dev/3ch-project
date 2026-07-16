import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Radio, Stack, TextField, Typography } from "@mui/material";
import {
  useClaimLeagueParticipantMutation,
  useGetParticipantClaimCandidatesQuery,
  useIssueParticipantClaimCodeMutation,
} from "../../features/league/leagueApi";

type Props = {
  open: boolean;
  leagueId: string;
  loggedIn: boolean;
  canManage?: boolean;
  onClose: () => void;
  onLinked: () => void;
};

export default function ParticipantClaimDialog({ open, leagueId, loggedIn, canManage = false, onClose, onLinked }: Props) {
  const { data, refetch } = useGetParticipantClaimCandidatesQuery(leagueId, { skip: !open || !leagueId });
  const [claimParticipant, { isLoading }] = useClaimLeagueParticipantMutation();
  const [issueCode] = useIssueParticipantClaimCodeMutation();
  const [selectedId, setSelectedId] = useState("");
  const [code, setCode] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [message, setMessage] = useState("");
  const candidates = data?.participants ?? [];

  useEffect(() => {
    if (!open) { setSelectedId(""); setCode(""); setIssuedCode(""); setMessage(""); }
  }, [open]);

  const handleClaim = async () => {
    if (!selectedId || !code.trim()) return;
    try {
      const result = await claimParticipant({ leagueId, participantId: selectedId, code }).unwrap();
      if (result.guest_token) localStorage.setItem(`guestClaimToken_${leagueId}`, result.guest_token);
      setMessage(loggedIn ? "참가자 계정 연결이 완료되었습니다." : "참가 기록을 이 기기에 안전하게 연결했습니다.");
      await refetch();
      onLinked();
    } catch (error) {
      setMessage((error as { data?: { message?: string } })?.data?.message ?? "참가자 연결에 실패했습니다.");
    }
  };

  const handleIssue = async () => {
    if (!selectedId) return;
    try {
      const result = await issueCode({ leagueId, participantId: selectedId }).unwrap();
      setIssuedCode(result.code);
    } catch (error) {
      setMessage((error as { data?: { message?: string } })?.data?.message ?? "연결코드를 발급하지 못했습니다.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>사전 등록 참가자 전환</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ color: "text.secondary", fontSize: 13, mb: 1.5 }}>
          본인 이름을 선택하고 전달받은 연결코드를 입력해 주세요.
        </Typography>
        <Stack spacing={0.8}>
          {candidates.map((participant) => (
            <Box key={participant.id} onClick={() => { setSelectedId(participant.id); setIssuedCode(""); }} sx={{ display: "flex", alignItems: "center", border: "1px solid #E5E7EB", borderRadius: 1, px: 1, py: 0.5, cursor: "pointer", bgcolor: selectedId === participant.id ? "#EFF6FF" : "#fff" }}>
              <Radio checked={selectedId === participant.id} size="small" />
              <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: "#FAAA47", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900 }}>{participant.division || "-"}</Box>
              <Typography sx={{ ml: 1.2, fontWeight: 800 }}>{participant.name}</Typography>
            </Box>
          ))}
          {!candidates.length && <Typography sx={{ py: 2, textAlign: "center", color: "text.secondary" }}>전환 가능한 참가자가 없습니다.</Typography>}
        </Stack>
        {selectedId && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {canManage && <Button variant="outlined" onClick={handleIssue}>연결코드 재발급</Button>}
            {issuedCode && <Alert severity="info">새 연결코드: <strong>{issuedCode}</strong></Alert>}
            {!canManage && <TextField fullWidth label="연결코드" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} inputProps={{ maxLength: 32 }} />}
          </Stack>
        )}
        {message && <Alert severity={message.includes("완료") || message.includes("안전하게") ? "success" : "warning"} sx={{ mt: 2 }}>{message}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>취소</Button>
        {!canManage && <Button variant="contained" disableElevation disabled={!selectedId || !code.trim() || isLoading} onClick={handleClaim}>신청</Button>}
      </DialogActions>
    </Dialog>
  );
}
