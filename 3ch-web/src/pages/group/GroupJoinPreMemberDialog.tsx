import { useState } from "react";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  List, ListItemButton, Radio, Stack, TextField, Typography,
} from "@mui/material";
import { DivisionBadge } from "../../components/ParticipantName";
import { useGetGroupPreMemberOptionsQuery, useJoinGroupMutation } from "../../features/group/groupApi";

type Props = { open: boolean; groupId: string; onClose: () => void; onJoined: (message: string) => void };

const errorMessage = (error: unknown) =>
  (error as { data?: { message?: string } })?.data?.message || "클럽 가입에 실패했습니다.";

export default function GroupJoinPreMemberDialog({ open, groupId, onClose, onJoined }: Props) {
  const { data, isFetching, refetch } = useGetGroupPreMemberOptionsQuery(groupId, { skip: !open || !groupId });
  const [joinGroup, { isLoading }] = useJoinGroupMutation();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const members = data?.pre_members ?? [];
  const visibleMembers = members.filter((member) => member.name.includes(search.trim()));

  const join = async (preMemberId?: string) => {
    const selected = members.find((member) => member.id === preMemberId);
    if (selected && !window.confirm(`가입 계정과 사전등록 기록 ${selected.name} · ${selected.division || "부수 미입력"}을 전환 신청하시겠습니까? 리더의 승인이 필요합니다.`)) return;
    if (!selected && !window.confirm("연결할 사전등록 기록이 없나요? 클럽에 일반 회원으로 가입합니다.")) return;
    try {
      const result = await joinGroup({ groupId, ...(selected ? { preMemberId: selected.id } : { joinWithoutClaim: true }) }).unwrap();
      onJoined(result.message || "클럽에 가입되었습니다.");
    } catch (error) {
      window.alert(errorMessage(error));
      void refetch();
    }
  };

  return (
    <Dialog open={open} onClose={isLoading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle fontWeight={900}>사전등록 기록 선택</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography fontSize={13} color="text.secondary">
            이름이 정확히 일치하는 기록이 없어 아직 가입되지 않았습니다. 본인의 사전등록 기록을 선택하면 리더에게 전환 승인을 요청합니다.
          </Typography>
          <TextField size="small" label="사전등록 이름 검색" value={search} onChange={(event) => setSearch(event.target.value)} fullWidth />
          <List sx={{ maxHeight: 300, overflow: "auto", border: "1px solid #E1E5EB", borderRadius: 1 }}>
            {isFetching && <Typography textAlign="center" sx={{ py: 3 }}>불러오는 중...</Typography>}
            {!isFetching && visibleMembers.length === 0 && <Typography textAlign="center" sx={{ py: 3 }}>일치하는 기록이 없습니다.</Typography>}
            {visibleMembers.map((member) => (
              <ListItemButton key={member.id} selected={selectedId === member.id} onClick={() => setSelectedId(member.id)}>
                <Radio checked={selectedId === member.id} size="small" />
                <Box sx={{ display: "flex", alignItems: "center", gap: .5 }}>
                  <Typography fontWeight={800}>{member.name}</Typography><DivisionBadge division={member.division} />
                </Box>
              </ListItemButton>
            ))}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>취소</Button>
        <Button onClick={() => void join()} disabled={isLoading || isFetching}>내 기록 없음</Button>
        <Button variant="contained" onClick={() => void join(selectedId)} disabled={!selectedId || isLoading}>전환 신청하고 가입</Button>
      </DialogActions>
    </Dialog>
  );
}
