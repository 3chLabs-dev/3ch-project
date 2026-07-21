import { useMemo, useState } from "react";
import { Box, Button, Chip, CircularProgress, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { useSearchGroupsQuery } from "../../features/group/groupApi";
import { setRenewalInvitedGroupIds } from "../../features/league/leagueRenewalCreationSlice";

export default function LeagueInvitedGroupsPicker() {
  const dispatch = useAppDispatch();
  const hostGroupId = useAppSelector((state) => state.leagueRenewalCreation.groupId);
  const selectedIds = useAppSelector((state) => state.leagueRenewalCreation.invitedGroupIds);
  const [query, setQuery] = useState("");
  const { data, isFetching } = useSearchGroupsQuery({ q: query, limit: 20 }, { skip: query.trim().length < 2 });
  const groups = useMemo(
    () => (data?.groups ?? []).filter((group) => group.id !== hostGroupId),
    [data?.groups, hostGroupId],
  );
  const selectedGroups = groups.filter((group) => selectedIds.includes(group.id));

  const toggle = (groupId: string) => {
    dispatch(setRenewalInvitedGroupIds(
      selectedIds.includes(groupId)
        ? selectedIds.filter((id) => id !== groupId)
        : [...selectedIds, groupId],
    ));
  };

  return (
    <Box sx={{ mt: "100px", border: "1px solid #D9DDE6", borderRadius: 1, px: 2, py: 2 }}>
      <Typography sx={{ fontSize: 17, fontWeight: 900, mb: 0.6, lineHeight: 1.45 }}>
        🤝 다른 클럽과 교류할 수 있는 리그를 생성해 보는 건 어떠신가요?
      </Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.4 }}>
        함께 할 클럽을 검색해 보세요.
      </Typography>
      <TextField
        fullWidth size="small" placeholder="클럽명 검색" value={query}
        onChange={(event) => setQuery(event.target.value)}
        InputProps={{
          endAdornment: <InputAdornment position="end">{isFetching ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}</InputAdornment>,
        }}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
      />
      {selectedGroups.length > 0 && (
        <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          {selectedGroups.map((group) => <Chip key={group.id} label={group.name} onDelete={() => toggle(group.id)} size="small" />)}
        </Stack>
      )}
      {query.trim().length >= 2 && (
        <Stack sx={{ mt: 1, border: "1px solid #E5E7EB", borderRadius: 1, overflow: "hidden" }}>
          {groups.length === 0 && !isFetching ? (
            <Typography sx={{ px: 1.5, py: 1.2, color: "text.secondary", fontSize: 13 }}>검색된 클럽이 없습니다.</Typography>
          ) : groups.map((group) => (
            <Box key={group.id} sx={{ display: "flex", alignItems: "center", px: 1.5, py: 0.8, borderTop: "1px solid #F1F5F9", "&:first-of-type": { borderTop: 0 } }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 800 }}>{group.name}</Typography>
                <Typography sx={{ color: "text.secondary", fontSize: 12 }}>{[group.region_city, group.region_district].filter(Boolean).join(" ")}</Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                disableElevation
                disabled={selectedIds.includes(group.id)}
                onClick={() => toggle(group.id)}
                sx={{ minWidth: 56, borderRadius: 1, fontWeight: 700 }}
              >
                {selectedIds.includes(group.id) ? "추가됨" : "추가"}
              </Button>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
