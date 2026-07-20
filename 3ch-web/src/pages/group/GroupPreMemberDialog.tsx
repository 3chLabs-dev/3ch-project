import { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, List, ListItemButton, Radio, Stack, TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  useCreateGroupPreMemberMutation, useDeleteGroupPreMemberMutation,
  useGetGroupPreMembersQuery, useRequestGroupMemberClaimMutation,
  useReviewGroupMemberClaimMutation,
} from "../../features/group/groupApi";

type Props = { open: boolean; onClose: () => void; groupId: string; manager?: boolean };

const errorMessage = (error: unknown) => {
  const value = error as { data?: { message?: string } };
  return value?.data?.message || "처리 중 오류가 발생했습니다.";
};

export default function GroupPreMemberDialog({ open, onClose, groupId, manager = false }: Props) {
  const { data, isFetching } = useGetGroupPreMembersQuery(groupId, { skip: !open || !groupId });
  const [createMember, { isLoading: isCreating }] = useCreateGroupPreMemberMutation();
  const [deleteMember] = useDeleteGroupPreMemberMutation();
  const [requestClaim, { isLoading: isRequesting }] = useRequestGroupMemberClaimMutation();
  const [reviewClaim, { isLoading: isReviewing }] = useReviewGroupMemberClaimMutation();
  const [division, setDivision] = useState("");
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const members = data?.pre_members ?? [];

  const addMember = async () => {
    if (!name.trim()) return;
    try {
      await createMember({ groupId, name: name.trim(), division: division.trim() }).unwrap();
      setName(""); setDivision("");
    } catch (error) { window.alert(errorMessage(error)); }
  };

  const submitClaim = async () => {
    if (!selectedId) return;
    try {
      const result = await requestClaim({ groupId, preMemberId: selectedId }).unwrap();
      window.alert(result.message); setSelectedId(""); onClose();
    } catch (error) { window.alert(errorMessage(error)); }
  };

  const review = async (preMemberId: string, action: "approve" | "decline") => {
    try { await reviewClaim({ groupId, preMemberId, action }).unwrap(); }
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
            <Stack direction="row" spacing={1} component="form" onSubmit={(e) => { e.preventDefault(); void addMember(); }}>
              <TextField size="small" label="부수" value={division} onChange={(e) => setDivision(e.target.value)} sx={{ width: 92 }} />
              <TextField size="small" label="이름" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
              <Button type="submit" variant="contained" disabled={!name.trim() || isCreating} sx={{ minWidth: 64 }}>추가</Button>
            </Stack>
          </Stack>
        )}
        {!manager && (
          <Typography fontSize={13} color="text.secondary" sx={{ mb: 1.5 }}>
            리더가 미리 등록한 본인을 선택해 전환을 신청해 주세요. 승인되면 클럽 기록이 계정에 연결됩니다.
          </Typography>
        )}
        <List disablePadding sx={{ border: "1px solid #E1E5EB", borderRadius: 1, overflow: "hidden" }}>
          {!isFetching && members.length === 0 && <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>사전등록된 회원이 없습니다.</Typography>}
          {members.map((member, index) => (
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
                  <Typography fontWeight={800}>{member.division ? `${member.division}부 · ` : ""}{member.name}</Typography>
                  {member.claim_status === "pending" && (
                    <Typography fontSize={12} color="primary.main">{member.requester_name}님의 전환 승인 대기 중</Typography>
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
                      try { await deleteMember({ groupId, preMemberId: member.id }).unwrap(); }
                      catch (error) { window.alert(errorMessage(error)); }
                    }
                  }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                ) : null}
              </ListItemButton>
            </Box>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>닫기</Button>
        {!manager && <Button variant="contained" onClick={() => void submitClaim()} disabled={!selectedId || isRequesting}>전환 신청</Button>}
      </DialogActions>
    </Dialog>
  );
}
