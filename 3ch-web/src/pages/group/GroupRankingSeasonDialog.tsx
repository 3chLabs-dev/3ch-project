import { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useCreateGroupRankingSeasonMutation, useDeleteGroupRankingSeasonMutation, useGetGroupRankingSeasonsQuery } from "../../features/group/groupApi";

type Props = { open: boolean; groupId: string; onClose: () => void; onCreated: (seasonId: string) => void };

const dateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function GroupRankingSeasonDialog({ open, groupId, onClose, onCreated }: Props) {
  const today = useMemo(() => dateOnly(new Date()), []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [error, setError] = useState("");
  const { data } = useGetGroupRankingSeasonsQuery(groupId, { skip: !open || !groupId });
  const [createSeason, { isLoading }] = useCreateGroupRankingSeasonMutation();
  const [deleteSeason, { isLoading: isDeleting }] = useDeleteGroupRankingSeasonMutation();

  const setPreset = (months: number) => {
    const base = new Date(`${startDate || today}T00:00:00`);
    base.setMonth(base.getMonth() + months);
    base.setDate(base.getDate() - 1);
    setEndDate(dateOnly(base));
  };

  const submit = async () => {
    if (!startDate || !endDate) return setError("시작일과 종료일을 모두 선택해 주세요.");
    if (endDate < startDate) return setError("종료일은 시작일보다 빠를 수 없습니다.");
    try {
      setError("");
      const result = await createSeason({ groupId, startDate, endDate, autoRenew }).unwrap();
      onCreated(result.season.id);
      onClose();
    } catch (caught: any) {
      setError(caught?.data?.message ?? "시즌 기간을 저장하지 못했습니다.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 900, pr: 6 }}>시즌 기간 설정</DialogTitle>
      <IconButton onClick={onClose} sx={{ position: "absolute", right: 10, top: 10 }}><CloseIcon /></IconButton>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField type="date" size="small" fullWidth value={startDate} onChange={(event) => setStartDate(event.target.value)} inputProps={{ "aria-label": "시작일" }} />
            <Typography>~</Typography>
            <TextField type="date" size="small" fullWidth value={endDate} onChange={(event) => setEndDate(event.target.value)} inputProps={{ "aria-label": "종료일" }} />
          </Stack>
          <Stack direction="row" spacing={0.7}>
            {[{ label: "1개월", months: 1 }, { label: "3개월", months: 3 }, { label: "6개월", months: 6 }, { label: "1년", months: 12 }].map((preset) => (
              <Button key={preset.label} variant="outlined" size="small" onClick={() => setPreset(preset.months)} sx={{ flex: 1, minWidth: 0, color: "text.secondary", borderColor: "divider" }}>{preset.label}</Button>
            ))}
          </Stack>
          <FormControlLabel
            control={<Checkbox checked={autoRenew} onChange={(event) => setAutoRenew(event.target.checked)} />}
            label={<Box><Typography sx={{ fontSize: 14, fontWeight: 800 }}>시즌 자동 연장</Typography><Typography sx={{ fontSize: 12, color: "text.secondary" }}>시즌 종료 후 동일한 기간으로 다음 시즌을 이어서 생성합니다.</Typography></Box>}
            sx={{ alignItems: "flex-start", m: 0 }}
          />
          {error && <Alert severity="warning">{error}</Alert>}
          {(data?.seasons.length ?? 0) > 0 && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1 }}>설정된 시즌</Typography>
              <Stack spacing={0.75}>
                {data?.seasons.map((season) => (
                  <Stack key={season.id} direction="row" alignItems="center" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, pl: 1.5, pr: 0.5, py: 0.5 }}>
                    <Box sx={{ flex: 1 }}><Typography sx={{ fontSize: 13 }}>{season.name}</Typography>{season.auto_renew && <Typography sx={{ fontSize: 11, color: "primary.main", fontWeight: 700 }}>자동 연장</Typography>}</Box>
                    <IconButton size="small" color="error" disabled={isDeleting} onClick={() => deleteSeason({ groupId, seasonId: season.id })}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>취소</Button>
        <Button variant="contained" disableElevation onClick={submit} disabled={isLoading}>완료</Button>
      </DialogActions>
    </Dialog>
  );
}
