import { useMemo, useRef, useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, List, ListItemButton, Radio, Stack, TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import { DivisionBadge } from "../../components/ParticipantName";
import {
  useCreateGroupPreMemberMutation, useDeleteGroupPreMemberMutation,
  useGetGroupPreMembersQuery, useRequestGroupMemberClaimMutation,
  useReviewGroupMemberClaimMutation,
} from "../../features/group/groupApi";
import ParticipantImageImportDialog, { type ImportedParticipant } from "../league/ParticipantImageImportDialog";
import { useAppSelector } from "../../app/hooks";

type Props = { open: boolean; onClose: () => void; groupId: string; manager?: boolean; justJoined?: boolean; onChanged?: () => void | Promise<void> };

const errorMessage = (error: unknown) => {
  const value = error as { data?: { message?: string } };
  return value?.data?.message || "처리 중 오류가 발생했습니다.";
};

export default function GroupPreMemberDialog({ open, onClose, groupId, manager = false, justJoined = false, onChanged }: Props) {
  const { data, isFetching } = useGetGroupPreMembersQuery(groupId, { skip: !open || !groupId });
  const [createMember, { isLoading: isCreating }] = useCreateGroupPreMemberMutation();
  const [deleteMember] = useDeleteGroupPreMemberMutation();
  const [requestClaim, { isLoading: isRequesting }] = useRequestGroupMemberClaimMutation();
  const [reviewClaim, { isLoading: isReviewing }] = useReviewGroupMemberClaimMutation();
  const [division, setDivision] = useState("");
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const accountName = useAppSelector((state) => state.auth.user?.name ?? "");
  const [imageImportOpen, setImageImportOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const members = useMemo(
    () => [...(data?.pre_members ?? [])].sort((left, right) => {
      const pendingDifference = Number(right.claim_status === "pending") - Number(left.claim_status === "pending");
      if (pendingDifference !== 0) return pendingDifference;
      return Date.parse(left.created_at) - Date.parse(right.created_at);
    }),
    [data?.pre_members],
  );
  const visibleMembers = manager ? members : members.filter((member) => member.name.includes(memberSearch.trim()));

  const addMember = async () => {
    if (!name.trim()) return;
    try {
      await createMember({ groupId, name: name.trim(), division: division.trim() }).unwrap();
      await onChanged?.();
      setName(""); setDivision("");
      requestAnimationFrame(() => nameInputRef.current?.focus());
    } catch (error) { window.alert(errorMessage(error)); }
  };

  const addImageMembers = async (participants: ImportedParticipant[]) => {
    const candidates = participants.filter((participant) => !participant.member_id);
    let added = 0;
    let skipped = participants.length - candidates.length;

    for (const participant of candidates) {
      try {
        await createMember({
          groupId,
          name: participant.name.trim(),
          division: participant.division.trim(),
        }).unwrap();
        added += 1;
      } catch (error) {
        const status = (error as { status?: number })?.status;
        if (status === 409) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }

    const resultMessage = [`${added}명을 사전등록했습니다.`];
    if (added > 0) await onChanged?.();
    if (skipped > 0) resultMessage.push(`이미 클럽 회원이거나 등록된 ${skipped}명은 제외했습니다.`);
    window.alert(resultMessage.join("\n"));
  };

  const submitClaim = async () => {
    if (!selectedId) return;
    const selected = members.find((member) => member.id === selectedId);
    if (!selected || !window.confirm(`가입 계정: ${accountName || "내 계정"}\n사전등록 기록: ${selected.name} · ${selected.division || "부수 미입력"}\n\n이 기록을 본인 기록으로 전환 신청하시겠습니까? 리더의 승인이 필요합니다.`)) return;
    try {
      const result = await requestClaim({ groupId, preMemberId: selectedId }).unwrap();
      window.alert(result.message); setSelectedId(""); onClose();
    } catch (error) { window.alert(errorMessage(error)); }
  };

  const review = async (preMemberId: string, action: "approve" | "decline") => {
    const target = members.find((member) => member.id === preMemberId);
    if (!target) return;
    const message = action === "approve"
      ? `가입 계정: ${target.requester_name || "확인 필요"}\n사전등록 기록: ${target.name} · ${target.division || "부수 미입력"}\n\n이 계정에 사전등록 기록을 연결하시겠습니까? 과거 경기 기록과 순위는 자동 변경되지 않습니다.`
      : `${target.requester_name || "가입 회원"}님의 ${target.name} 사전등록 기록 전환 신청을 거절하시겠습니까?`;
    if (!window.confirm(message)) return;
    try {
      await reviewClaim({ groupId, preMemberId, action }).unwrap();
      await onChanged?.();
    }
    catch (error) { window.alert(errorMessage(error)); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ pr: 6, fontWeight: 900 }}>
        {manager ? "클럽 회원 사전등록" : "사전등록 회원 전환"}
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 12, top: 10 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        {manager && (
          <Stack spacing={1.25} sx={{ mb: 2.5 }}>
            <Typography fontSize={13} color="text.secondary">회원가입 전인 클럽 회원을 먼저 등록할 수 있습니다.</Typography>
            <Button
              variant="outlined"
              startIcon={<PhotoLibraryOutlinedIcon />}
              onClick={() => setImageImportOpen(true)}
              sx={{ height: 40, fontWeight: 800 }}
            >
              이미지로 등록하기
            </Button>
            <Stack direction="row" spacing={1} component="form" onSubmit={(e) => { e.preventDefault(); void addMember(); }}>
              <TextField inputRef={nameInputRef} size="small" label="이름" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
              <TextField size="small" label="부수" value={division} onChange={(e) => setDivision(e.target.value)} sx={{ width: 92 }} />
              <Button type="submit" variant="contained" disabled={!name.trim() || isCreating} sx={{ minWidth: 64 }}>추가</Button>
            </Stack>
          </Stack>
        )}
        {!manager && (
          <Stack spacing={1} sx={{ mb: 1.5 }}>
            <Typography fontSize={13} color="text.secondary">{justJoined ? "클럽 가입이 완료되었습니다. " : ""}아래에서 본인의 사전등록 기록을 선택해 주세요. 이름이 달라도 선택할 수 있으며 리더 승인 전에는 연결되지 않습니다.</Typography>
            <TextField size="small" label="사전등록 이름 검색" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="예: 이름A, 성을 뺀 이름" fullWidth />
          </Stack>
        )}
        <List disablePadding sx={{ border: "1px solid #E1E5EB", borderRadius: 1, overflow: "hidden" }}>
          {!isFetching && members.length === 0 && <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>사전등록된 회원이 없습니다.</Typography>}
          {!isFetching && members.length > 0 && visibleMembers.length === 0 && <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>일치하는 기록이 없습니다.</Typography>}
          {visibleMembers.map((member, index) => (
            <Box key={member.id}>
              {index > 0 && <Divider />}
              <ListItemButton
                disabled={!manager && member.claim_status === "pending"}
                selected={!manager && selectedId === member.id}
                onClick={() => !manager && setSelectedId(member.id)}
                sx={{ py: 1.25, px: 1.5 }}
              >
                {!manager && <Radio checked={selectedId === member.id} size="small" />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.45} alignItems="center"><Typography fontWeight={800}>{member.name}</Typography><DivisionBadge division={member.division}/></Stack>
                  {member.claim_status === "pending" && (
                    <Typography fontSize={12} color="primary.main">가입 계정 {member.requester_name} → 사전등록 {member.name} · {member.division || "부수 미입력"} 승인 대기</Typography>
                  )}
                  {member.status === "linked" && <Chip size="small" label="전환 완료" sx={{ mt: .5 }} />}
                </Box>
                {manager && member.claim_status === "pending" ? (
                  <Stack direction="row" spacing={.5}>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); void review(member.id, "decline"); }} disabled={isReviewing}>거절</Button>
                    <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); void review(member.id, "approve"); }} disabled={isReviewing}>승인</Button>
                  </Stack>
                ) : manager && member.status === "active" ? (
                  <IconButton size="small" color="error" onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm(`${member.name} 님의 사전등록 정보를 삭제하시겠습니까?`)) {
                      try {
                        await deleteMember({ groupId, preMemberId: member.id }).unwrap();
                        await onChanged?.();
                      } catch (error) { window.alert(errorMessage(error)); }
                    }
                  }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                ) : null}
              </ListItemButton>
            </Box>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!manager && justJoined && <Button onClick={onClose}>내 기록 없음</Button>}
        <Button onClick={onClose}>닫기</Button>
        {!manager && <Button variant="contained" onClick={() => void submitClaim()} disabled={!selectedId || isRequesting}>전환 신청</Button>}
      </DialogActions>
      <ParticipantImageImportDialog
        open={imageImportOpen}
        onClose={() => setImageImportOpen(false)}
        onConfirm={addImageMembers}
        existingNames={members.map((member) => member.name)}
        groupIds={[groupId]}
        title="이미지에서 클럽 회원 불러오기"
        recognizeLabel="회원 이름 인식"
      />
    </Dialog>
  );
}
