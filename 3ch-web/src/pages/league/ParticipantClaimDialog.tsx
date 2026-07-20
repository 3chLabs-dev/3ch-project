import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Radio, Stack, Typography } from "@mui/material";
import {
  useGetParticipantClaimCandidatesQuery,
  useRequestParticipantClaimMutation,
  useReviewParticipantClaimMutation,
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
  const [requestClaim, { isLoading: isRequesting }] = useRequestParticipantClaimMutation();
  const [reviewClaim, { isLoading: isReviewing }] = useReviewParticipantClaimMutation();
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [messageSeverity, setMessageSeverity] = useState<"success" | "warning">("success");
  const candidates = data?.participants ?? [];
  const pendingClaims = useMemo(
    () => candidates.filter((participant) => participant.claim_status === "pending" && participant.requested_by_id),
    [candidates],
  );

  useEffect(() => {
    if (!open) {
      setSelectedId("");
      setMessage("");
      setMessageSeverity("success");
    }
  }, [open]);

  const handleRequest = async () => {
    if (!selectedId || !loggedIn) return;
    try {
      await requestClaim({ leagueId, participantId: selectedId }).unwrap();
      setMessageSeverity("success");
      setMessage("참가자 전환을 신청했습니다. 리더·운영진의 승인을 기다려 주세요.");
      await refetch();
    } catch (error) {
      setMessageSeverity("warning");
      setMessage((error as { data?: { message?: string } })?.data?.message ?? "참가자 전환 신청에 실패했습니다.");
    }
  };

  const handleReview = async (participantId: string, status: "approved" | "declined") => {
    try {
      await reviewClaim({ leagueId, participantId, status }).unwrap();
      setMessageSeverity("success");
      setMessage(status === "approved" ? "참가자 전환을 승인했습니다." : "참가자 전환을 거절했습니다.");
      await refetch();
      if (status === "approved") onLinked();
    } catch (error) {
      setMessageSeverity("warning");
      setMessage((error as { data?: { message?: string } })?.data?.message ?? "참가자 전환 신청 처리에 실패했습니다.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>
        {canManage ? "참가자 전환 신청" : "사전등록 참가자 전환"}
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ color: "text.secondary", fontSize: 13, mb: 1.5 }}>
          {canManage
            ? "신청자와 사전등록 참가자를 확인한 후 승인해 주세요."
            : "사전등록된 본인 이름을 선택해 전환을 신청해 주세요."}
        </Typography>

        {canManage ? (
          <Stack spacing={1}>
            {pendingClaims.map((participant) => (
              <Box key={participant.id} sx={{ border: "1px solid #E5E7EB", borderRadius: 1, p: 1.25, bgcolor: "#fff" }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: "#FAAA47", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                    {participant.division || "-"}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }}>{participant.name}</Typography>
                    <Typography sx={{ color: "text.secondary", fontSize: 12 }}>
                      신청자: {participant.requester_name || "회원"}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.25 }}>
                  <Button size="small" variant="outlined" color="inherit" disabled={isReviewing} onClick={() => void handleReview(participant.id, "declined")}>거절</Button>
                  <Button size="small" variant="contained" disableElevation disabled={isReviewing} onClick={() => void handleReview(participant.id, "approved")}>승인</Button>
                </Stack>
              </Box>
            ))}
            {!pendingClaims.length && (
              <Typography sx={{ py: 3, textAlign: "center", color: "text.secondary", fontSize: 13 }}>
                대기 중인 전환 신청이 없습니다.
              </Typography>
            )}
          </Stack>
        ) : (
          <>
            {!loggedIn && <Alert severity="info" sx={{ mb: 1.5 }}>로그인 후 참가자 전환을 신청할 수 있습니다.</Alert>}
            <Stack spacing={0.8}>
              {candidates.map((participant) => {
                const isPending = participant.claim_status === "pending";
                return (
                  <Box
                    key={participant.id}
                    onClick={() => !isPending && loggedIn && setSelectedId(participant.id)}
                    sx={{
                      display: "flex", alignItems: "center", border: "1px solid #E5E7EB", borderRadius: 1,
                      px: 1, py: 0.5, cursor: isPending || !loggedIn ? "default" : "pointer",
                      bgcolor: selectedId === participant.id ? "#EFF6FF" : "#fff", opacity: isPending ? 0.7 : 1,
                    }}
                  >
                    <Radio checked={selectedId === participant.id} disabled={isPending || !loggedIn} size="small" />
                    <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: "#FAAA47", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900 }}>
                      {participant.division || "-"}
                    </Box>
                    <Typography sx={{ ml: 1.2, fontWeight: 800, flex: 1 }}>{participant.name}</Typography>
                    {isPending && <Typography sx={{ fontSize: 11, color: "#1976D2", fontWeight: 800 }}>승인 대기</Typography>}
                  </Box>
                );
              })}
              {!candidates.length && <Typography sx={{ py: 2, textAlign: "center", color: "text.secondary" }}>전환 가능한 참가자가 없습니다.</Typography>}
            </Stack>
          </>
        )}

        {message && <Alert severity={messageSeverity} sx={{ mt: 2 }}>{message}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>닫기</Button>
        {!canManage && (
          <Button variant="contained" disableElevation disabled={!selectedId || !loggedIn || isRequesting} onClick={() => void handleRequest()}>
            전환 신청
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
