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
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
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
  attendance: { league: 10, tournament: 20 },
  matchPoints: {
    mode: "sets",
    winPoints: 3,
    eventTypes: { singles: true, doubles: true, team: true },
  },
  rankings: {
    league: { first: 30, second: 20, third: 15, fourth: 10 },
    group: { first: 30, second: 20, third: 15, fourth: 10 },
    tournamentUpper: { first: 50, second: 30, third: 20, fourth: 15 },
    tournamentLower: { first: 20, second: 15, third: 10, fourth: 5 },
  },
};

type RankingRuleKey = keyof GroupRankingPointRules["rankings"];

const normalizeRankingRules = (
  saved: Partial<GroupRankingPointRules["rankings"]> | undefined,
): GroupRankingPointRules["rankings"] => {
  const keys: RankingRuleKey[] = ["league", "group", "tournamentUpper", "tournamentLower"];
  return keys.reduce((result, key) => {
    const fallback = DEFAULT_POINT_RULES.rankings[key];
    const rule = saved?.[key];
    const legacyThirdFourth = rule?.thirdFourth;
    result[key] = {
      first: rule?.first ?? fallback.first,
      second: rule?.second ?? fallback.second,
      third: rule?.third ?? legacyThirdFourth ?? fallback.third,
      fourth: rule?.fourth ?? legacyThirdFourth ?? fallback.fourth,
    };
    return result;
  }, {} as GroupRankingPointRules["rankings"]);
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
            matchPoints: {
              ...DEFAULT_POINT_RULES.matchPoints,
              ...savedRules.matchPoints,
              eventTypes: {
                ...DEFAULT_POINT_RULES.matchPoints.eventTypes,
                ...savedRules.matchPoints?.eventTypes,
              },
            },
            rankings: normalizeRankingRules(savedRules.rankings),
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
    rank: "first" | "second" | "third" | "fourth",
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
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: "text.secondary", mb: 0.25 }}>
              점수 계산 방식
            </Typography>
            <RadioGroup
              value={pointRules.matchPoints.mode}
              onChange={(event) => updateMatchPoints({ mode: event.target.value as "sets" | "win" })}
              sx={{ alignItems: "flex-start" }}
            >
              <FormControlLabel
                value="sets"
                control={<Radio size="small" />}
                label={<Typography sx={{ fontSize: 13 }}>획득한 세트스코어</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                value="win"
                control={<Radio size="small" />}
                label={(
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography sx={{ fontSize: 13 }}>승점</Typography>
                    <StepPointInput
                      value={pointRules.matchPoints.winPoints}
                      onChange={(value) => updateMatchPoints({ winPoints: value })}
                      ariaLabel="경기당 승점"
                    />
                    <Typography sx={{ fontSize: 13 }}>점</Typography>
                  </Stack>
                )}
                sx={{ m: 0 }}
              />
            </RadioGroup>
            <Divider sx={{ my: 1.25 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: "text.secondary", mb: 0.25 }}>
              반영 종목
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, pl: 0 }}>
              {([
                ["singles", "단식"],
                ["doubles", "복식"],
                ["team", "단체전"],
              ] as const).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={(
                    <Checkbox
                      size="small"
                      checked={pointRules.matchPoints.eventTypes[key]}
                      onChange={(event) => updateMatchPoints({
                        eventTypes: {
                          ...pointRules.matchPoints.eventTypes,
                          [key]: event.target.checked,
                        },
                      })}
                    />
                  )}
                  label={<Typography sx={{ fontSize: 13 }}>{label}</Typography>}
                  sx={{
                    m: 0,
                    mr: 1,
                    "& .MuiCheckbox-root": { p: "9px" },
                  }}
                />
              ))}
            </Stack>
            {(pointRules.matchPoints.eventTypes.doubles || pointRules.matchPoints.eventTypes.team) && (
              <Box
                sx={{
                  mt: 1,
                  px: 1.5,
                  py: 1.25,
                  border: "1px solid #D9E5F5",
                  borderRadius: 1,
                  bgcolor: "#F6F9FD",
                }}
              >
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#1F2937", mb: 0.5 }}>
                  복식·단체전 개인 포인트 계산
                </Typography>
                {pointRules.matchPoints.eventTypes.doubles && (
                  <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.6 }}>
                    복식: {pointRules.matchPoints.mode === "sets" ? "획득한 세트스코어" : `승점 ${pointRules.matchPoints.winPoints}점`} ÷ 2명
                  </Typography>
                )}
                {pointRules.matchPoints.eventTypes.team && (
                  <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.6 }}>
                    단체전: {pointRules.matchPoints.mode === "sets" ? "획득한 세트스코어" : `승점 ${pointRules.matchPoints.winPoints}점`} ÷ 실제 팀원 수
                  </Typography>
                )}
                <Typography sx={{ mt: 0.4, fontSize: 11.5, color: "#1976D2", fontWeight: 700 }}>
                  계산된 개인 포인트는 소수점 첫째 자리까지 반올림합니다.
                </Typography>
              </Box>
            )}
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

function StepPointInput({ value, onChange, ariaLabel }: { value: number; onChange: (value: number) => void; ariaLabel: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.25}>
      <IconButton
        size="small"
        aria-label={`${ariaLabel} 감소`}
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        sx={{ width: 32, height: 32 }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <TextField
        size="small"
        type="number"
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        inputProps={{ min: 0, max: 10000, inputMode: "numeric", "aria-label": ariaLabel }}
        sx={{
          width: 58,
          "& input": { textAlign: "center", px: 0.5, py: 0.7, fontWeight: 700 },
          "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": {
            WebkitAppearance: "none",
            m: 0,
          },
        }}
      />
      <IconButton
        size="small"
        aria-label={`${ariaLabel} 증가`}
        onClick={() => onChange(value + 1)}
        sx={{ width: 32, height: 32 }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function PointRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Stack direction="row" alignItems="center">
      <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</Typography>
      <StepPointInput value={value} onChange={onChange} ariaLabel={`${label} 포인트`} />
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
  onChange: (rank: "first" | "second" | "third" | "fourth", value: number) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.75 }}>{label}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.75 }}>
        {([
          ["first", "1위"],
          ["second", "2위"],
          ["third", "3위"],
          ["fourth", "4위"],
        ] as const).map(([key, rankLabel]) => (
          <Stack key={key} spacing={0.35} alignItems="flex-start">
            <Typography sx={{ fontSize: 12 }}>{rankLabel}</Typography>
            <PointInput
              value={values[key]}
              onChange={(value) => onChange(key, value)}
              ariaLabel={`${label} ${rankLabel} 포인트`}
            />
          </Stack>
        ))}
      </Box>
    </Box>
  );
}
