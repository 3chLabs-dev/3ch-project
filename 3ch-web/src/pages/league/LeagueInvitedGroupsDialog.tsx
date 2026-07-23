import { useState } from "react";
import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useSearchGroupsQuery } from "../../features/group/groupApi";
import { useGetLeagueInvitedGroupsQuery, useInviteGroupsToLeagueMutation } from "../../features/league/leagueApi";

type Props = { open: boolean; leagueId: string; hostGroupId?: string | null; hostGroupName?: string | null; canManage: boolean; onClose: () => void };

export default function LeagueInvitedGroupsDialog({ open, leagueId, hostGroupId, hostGroupName, canManage, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data, isFetching } = useSearchGroupsQuery({ q: query, limit: 20, include_joined: true }, { skip: !open || !canManage || query.trim().length < 2 });
  const { data: invitedData } = useGetLeagueInvitedGroupsQuery(leagueId, { skip: !open });
  const [inviteGroups, { isLoading }] = useInviteGroupsToLeagueMutation();
  const existingIds = new Set((invitedData?.groups ?? []).map((group) => group.group_id));
  const results = (data?.groups ?? []).filter((group) => group.id !== hostGroupId && !existingIds.has(group.id));

  const submit = async () => {
    if (!selectedIds.length) return;
    await inviteGroups({ leagueId, groupIds: selectedIds }).unwrap();
    setSelectedIds([]);
    setQuery("");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>참여 클럽</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1}>
          {hostGroupId && (
            <Box sx={{ display: "flex", alignItems: "center", border: "1px solid #E5E7EB", borderRadius: 1, px: 1.5, py: 1 }}>
              <Typography sx={{ flex: 1, fontWeight: 800 }}>{hostGroupName || "주최 클럽"}</Typography>
              <Chip size="small" label="주최" sx={{ bgcolor: "#FFF7ED", color: "#C2410C", fontWeight: 800 }} />
            </Box>
          )}
          {(invitedData?.groups ?? []).map((group) => (
            <Box key={group.id} sx={{ display: "flex", alignItems: "center", border: "1px solid #E5E7EB", borderRadius: 1, px: 1.5, py: 1 }}>
              <Typography sx={{ flex: 1, fontWeight: 800 }}>{group.name}</Typography>
              <Chip size="small" label={group.status === "accepted" ? "참여" : group.status === "declined" ? "거절" : "대기"} color={group.status === "accepted" ? "primary" : "default"} />
            </Box>
          ))}
          {!hostGroupId && !invitedData?.groups.length && <Typography sx={{ color: "text.secondary", textAlign: "center", py: 1 }}>참여 클럽이 없습니다.</Typography>}
        </Stack>
        {canManage && (
          <Box sx={{ mt: 2.5 }}>
            <Typography sx={{ fontWeight: 900, mb: 1 }}>클럽 초대</Typography>
            <TextField fullWidth size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="클럽명 검색" InputProps={{ endAdornment: <InputAdornment position="end">{isFetching ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}</InputAdornment> }} />
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {results.map((group) => {
                const selected = selectedIds.includes(group.id);
                return <Button key={group.id} variant={selected ? "contained" : "outlined"} disableElevation onClick={() => setSelectedIds((ids) => selected ? ids.filter((id) => id !== group.id) : [...ids, group.id])} sx={{ justifyContent: "flex-start" }}>{group.name}</Button>;
              })}
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>닫기</Button>
        {canManage && <Button variant="contained" disableElevation disabled={!selectedIds.length || isLoading} onClick={submit}>초대</Button>}
      </DialogActions>
    </Dialog>
  );
}
