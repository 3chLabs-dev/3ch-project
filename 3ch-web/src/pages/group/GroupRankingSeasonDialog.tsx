import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  useCreateGroupRankingSeasonMutation,
  useDeleteGroupRankingSeasonMutation,
  useGetGroupRankingSeasonsQuery,
  useUpdateGroupRankingSeasonMutation,
} from "../../features/group/groupApi";
import type { GroupRankingPointRules } from "../../features/group/groupApi";

type Props = {
  open: boolean;
  groupId: string;
  seasonId?: string;
  onClose: () => void;
  onCreated: (seasonId: string) => void;
};

const DEFAULT_POINT_RULES: GroupRankingPointRules = {
  attendance: { league: 1, tournament: 2 },
  matchPoints: { mode: "sets", winPoints: 3 },
  rankings: {
    league: { first: 30, second: 20, thirdFourth: 10 },
    group: { first: 30, second: 15, thirdFourth: 10 },
    tournamentUpper: { first: 50, second: 30, thirdFourth: 20 },
    tournamentLower: { first: 20, second: 10, thirdFourth: 7 },
  },
};

const dateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function GroupRankingSeasonDialog({ open, groupId, seasonId, onClose, onCreated }: Props) {
  const today = useMemo(() => dateOnly(new Date()), []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [pointRules, setPointRules] = useState<GroupRankingPointRules>(DEFAULT_POINT_RULES);
  const [error, setError] = useState("");
  const { data } = useGetGroupRankingSeasonsQuery(groupId, { skip: !open || !groupId });
  const [createSeason, { isLoading }] = useCreateGroupRankingSeasonMutation();
  const [updateSeason, { isLoading: isUpdating }] = useUpdateGroupRankingSeasonMutation();
  const [deleteSeason, { isLoading: isDeleting }] = useDeleteGroupRankingSeasonMutation();
  const selectedSeason = data?.seasons.find((season) => season.id === seasonId);

  useEffect(() => {
    if (!open) return;
    if (selectedSeason) {
      setStartDate(selectedSeason.start_date.slice(0, 10));
      setEndDate(selectedSeason.end_date.slice(0, 10));
      setAutoRenew(Boolean(selectedSeason.auto_renew));
      const savedRules = selectedSeason.point_rules;
      setPointRules(savedRules
        ? {
            ...DEFAULT_POINT_RULES,
            ...savedRules,
            attendance: { ...DEFAULT_POINT_RULES.attendance, ...savedRules.attendance },
            matchPoints: { ...DEFAULT_POINT_RULES.matchPoints, ...savedRules.matchPoints },
            rankings: { ...DEFAULT_POINT_RULES.rankings, ...savedRules.rankings },
          }
        : DEFAULT_POINT_RULES);
    } else {
      setStartDate(today);
      setEndDate("");
      setAutoRenew(false);
      setPointRules(DEFAULT_POINT_RULES);
    }
    setError("");
  }, [open, selectedSeason, today]);

  const setPreset = (months: number) => {
    const base = new Date(`${startDate || today}T00:00:00`);
    base.setMonth(base.getMonth() + months);
    base.setDate(base.getDate() - 1);
    setEndDate(dateOnly(base));
  };

  const updateAttendance = (key: "league" | "tournament", value: number) => {
    setPointRules((previous) => ({
      ...previous,
      attendance: { ...previous.attendance, [key]: value },
    }));
  };

  const updateMatchPoints = (updates: Partial<GroupRankingPointRules["matchPoints"]>) => {
    setPointRules((previous) => ({
      ...previous,
      matchPoints: { ...previous.matchPoints, ...updates },
    }));
  };

  const updateRanking = (
    key: keyof GroupRankingPointRules["rankings"],
    rank: "first" | "second" | "thirdFourth",
    value: number,
  ) => {
    setPointRules((previous) => ({
      ...previous,
      rankings: {
        ...previous.rankings,
        [key]: { ...previous.rankings[key], [rank]: value },
      },
    }));
  };

  const submit = async () => {
    if (!startDate || !endDate) return setError("시작일과 종료일을 모두 선택해 주세요.");
    if (endDate < startDate) return setError("종료일은 시작일보다 빠를 수 없습니다.");
    try {
      setError("");
      const payload = { groupId, startDate, endDate, autoRenew, pointRules };
      const result = selectedSeason
        ? await updateSeason({ ...payload, seasonId: selectedSeason.id }).unwrap()
        : await createSeason(payload).unwrap();
      onCreated(result.season.id);
      onClose();
    } catch (caught: any) {
      setError(caught?.data?.message ?? "시즌 설정을 저장하지 못했습니다.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 900, pr: 6 }}>시즌 설정</DialogTitle>
      <IconButton onClick={onClose} sx={{ position: "absolute", right: 10, top: 10 }}><CloseIcon /></IconButton>
      <DialogContent dividers>
        <Stack spacing={2.25}>
          <Typography sx={{ fontSize: 15, fontWeight: 900 }}>기간 설정</Typography>
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
            label={<Box><Typography sx={{ fontSize: 14, fontWeight: 800 }}>시즌 자동 연장</Typography><Typography sx={{ fontSize: 12, color: "text.secondary" }}>시즌 종료 후 동일한 기간과 포인트로 다음 시즌을 생성합니다.</Typography></Box>}
            sx={{ alignItems: "flex-start", m: 0 }}
          />

          <Divider />

          <Typography sx={{ fontSize: 15, fontWeight: 900 }}>포인트 설정</Typography>
          <Stack spacing={1}>
            <PointRow label="리그 참석" value={pointRules.attendance.league} onChange={(value) => updateAttendance("league", value)} />
            <PointRow label="대회 참석" value={pointRules.attendance.tournament} onChange={(value) => updateAttendance("tournament", value)} />
          </Stack>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.5 }}>경기당 승점</Typography>
            <RadioGroup
              value={pointRules.matchPoints.mode}
              onChange={(event) => updateMatchPoints({ mode: event.target.value as "sets" | "win" })}
            >
              <FormControlLabel
                value="sets"
                control={<Radio size="small" />}
                label={<Typography sx={{ fontSize: 13 }}>획득한 세트스코어</Typography>}
              />
              <FormControlLabel
                value="win"
                control={<Radio size="small" />}
                label={(
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography sx={{ fontSize: 13 }}>승점</Typography>
                    <PointInput
                      value={pointRules.matchPoints.winPoints}
                      onChange={(value) => updateMatchPoints({ winPoints: value })}
                      ariaLabel="경기당 승점"
                    />
                    <Typography sx={{ fontSize: 13 }}>점</Typography>
                  </Stack>
                )}
              />
            </RadioGroup>
          </Box>
          <Stack spacing={1.5}>
            <RankingPointRow label="단일리그" values={pointRules.rankings.league} onChange={(rank, value) => updateRanking("league", rank, value)} />
            <RankingPointRow label="조별리그" values={pointRules.rankings.group} onChange={(rank, value) => updateRanking("group", rank, value)} />
            <RankingPointRow label="토너먼트(상위)" values={pointRules.rankings.tournamentUpper} onChange={(rank, value) => updateRanking("tournamentUpper", rank, value)} />
            <RankingPointRow label="토너먼트(하위)" values={pointRules.rankings.tournamentLower} onChange={(rank, value) => updateRanking("tournamentLower", rank, value)} />
          </Stack>

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
        <Button variant="contained" disableElevation onClick={submit} disabled={isLoading || isUpdating}>완료</Button>
      </DialogActions>
    </Dialog>
  );
}

function PointInput({ value, onChange, ariaLabel }: { value: number; onChange: (value: number) => void; ariaLabel: string }) {
  return (
    <TextField
      size="small"
      type="number"
      value={value}
      onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      inputProps={{ min: 0, max: 10000, inputMode: "numeric", "aria-label": ariaLabel }}
      sx={{ width: 70, "& input": { textAlign: "center", py: 0.8 } }}
    />
  );
}

function PointRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Stack direction="row" alignItems="center">
      <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</Typography>
      <PointInput value={value} onChange={onChange} ariaLabel={`${label} 포인트`} />
      <Typography sx={{ ml: 0.75, fontSize: 13 }}>점</Typography>
    </Stack>
  );
}

type RankRule = GroupRankingPointRules["rankings"]["league"];

function RankingPointRow({
  label,
  values,
  onChange,
}: {
  label: string;
  values: RankRule;
  onChange: (rank: "first" | "second" | "thirdFourth", value: number) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.75 }}>{label}</Typography>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Typography sx={{ fontSize: 12 }}>1위</Typography>
        <PointInput value={values.first} onChange={(value) => onChange("first", value)} ariaLabel={`${label} 1위 포인트`} />
        <Typography sx={{ fontSize: 12 }}>2위</Typography>
        <PointInput value={values.second} onChange={(value) => onChange("second", value)} ariaLabel={`${label} 2위 포인트`} />
        <Typography sx={{ fontSize: 12 }}>3·4위</Typography>
        <PointInput value={values.thirdFourth} onChange={(value) => onChange("thirdFourth", value)} ariaLabel={`${label} 3·4위 포인트`} />
      </Stack>
    </Box>
  );
}
