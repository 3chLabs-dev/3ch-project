import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider, FormControlLabel,
  IconButton, MenuItem, Stack, Switch, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";
import {
  useCreateTournamentMutation,
  useGetTournamentEligibilityQuery,
  type TournamentDivisionInput,
} from "../../features/tournament/tournamentApi";

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

const emptyDivision = (name = ""): TournamentDivisionInput => ({
  name,
  league_type: "SINGLES",
  format: "GROUP_TOURNAMENT",
  rules: { match_rule: "3게임 2선승" },
  recruit_count: null,
});

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 1.2, bgcolor: "#fff" } };

export default function TournamentCreate() {
  const navigate = useNavigate();
  const token = useAppSelector((state) => state.auth.token);
  const { data: eligibility, isLoading: eligibilityLoading } = useGetTournamentEligibilityQuery(undefined, { skip: !token });
  const { data: groupData, isLoading: groupsLoading } = useGetMyGroupsQuery(undefined, { skip: !token });
  const [createTournament, { isLoading: isCreating }] = useCreateTournamentMutation();
  const manageableGroups = useMemo(() => (groupData?.groups ?? []).filter((group) =>
    group.role === "owner" || (group.role === "admin" && group.management_permissions?.league === true)), [groupData]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState("탁구");
  const [date, setDate] = useState(tomorrow);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [hostGroupId, setHostGroupId] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [notice, setNotice] = useState("");
  const [premiumVisible, setPremiumVisible] = useState(true);
  const [divisions, setDivisions] = useState<TournamentDivisionInput[]>([
    emptyDivision("3~4부"), emptyDivision("5~6부"), emptyDivision("7~8부"), emptyDivision("희망부"),
  ]);
  const [error, setError] = useState("");

  const effectiveGroupId = hostGroupId || manageableGroups[0]?.id || "";
  const updateDivision = (index: number, patch: Partial<TournamentDivisionInput>) => {
    setDivisions((current) => current.map((division, itemIndex) => itemIndex === index ? { ...division, ...patch } : division));
  };

  const handleSubmit = async () => {
    setError("");
    const normalized = divisions.map((division) => ({ ...division, name: division.name.trim() }));
    if (!title.trim() || !effectiveGroupId || normalized.some((division) => !division.name)) {
      setError("대회명, 주최 클럽, 부문명을 모두 입력해주세요.");
      return;
    }
    if (new Set(normalized.map((division) => division.name)).size !== normalized.length) {
      setError("부문 이름은 중복될 수 없습니다.");
      return;
    }
    const startsAt = new Date(`${date}T${startTime}:00`);
    const endsAt = new Date(`${date}T${endTime}:00`);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
      setError("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    try {
      await createTournament({
        title: title.trim(), description: description.trim() || null, sport,
        venue_name: venueName.trim() || null, venue_address: venueAddress.trim() || null,
        notice: notice.trim() || null, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
        host_group_id: effectiveGroupId, premium_visible: premiumVisible, divisions: normalized,
      }).unwrap();
      navigate("/league", { replace: true });
    } catch (reason) {
      const response = reason as { data?: { message?: string } };
      setError(response.data?.message ?? "대회를 생성하지 못했습니다.");
    }
  };

  if (!token) return <Box sx={{ p: 3 }}><Alert severity="info">로그인 후 대회를 생성할 수 있습니다.</Alert></Box>;
  if (eligibilityLoading || groupsLoading) return <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress /></Box>;
  if (!eligibility?.can_create) return <Box sx={{ p: 2.5 }}><Alert severity="warning" action={<Button onClick={() => navigate("/mypage/pricing")}>요금제 보기</Button>}>대회 메뉴는 프리미엄 구독자만 이용할 수 있습니다.</Alert></Box>;
  if (manageableGroups.length === 0) return <Box sx={{ p: 2.5 }}><Alert severity="warning">대회를 주최할 수 있는 클럽 관리 권한이 없습니다.</Alert></Box>;

  return <Box sx={{ px: 2.5, py: 2, maxWidth: 780, mx: "auto" }}>
    <Typography sx={{ fontSize: 24, fontWeight: 950 }}>대회 생성</Typography>
    <Typography sx={{ mt: 0.5, mb: 2.5, color: "text.secondary", fontSize: 14 }}>부문별 운영 방식을 미리 설정하고 참가 현황에 따라 경기 생성 전까지 수정할 수 있습니다.</Typography>

    <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}><CardContent>
      <Typography fontWeight={950} sx={{ mb: 1.5 }}>기본 정보</Typography>
      <Stack spacing={1.5}>
        <TextField required label="대회명" value={title} onChange={(event) => setTitle(event.target.value)} sx={fieldSx} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
          <TextField select required fullWidth label="주최 클럽" value={effectiveGroupId} onChange={(event) => setHostGroupId(event.target.value)} sx={fieldSx}>
            {manageableGroups.map((group) => <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="종목" value={sport} onChange={(event) => setSport(event.target.value)} sx={fieldSx}>
            {["탁구", "배드민턴", "테니스", "볼링", "기타"].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
          <TextField required fullWidth type="date" label="대회일" value={date} onChange={(event) => setDate(event.target.value)} InputLabelProps={{ shrink: true }} sx={fieldSx} />
          <TextField required fullWidth type="time" label="시작" value={startTime} onChange={(event) => setStartTime(event.target.value)} InputLabelProps={{ shrink: true }} sx={fieldSx} />
          <TextField required fullWidth type="time" label="종료" value={endTime} onChange={(event) => setEndTime(event.target.value)} InputLabelProps={{ shrink: true }} sx={fieldSx} />
        </Stack>
        <TextField label="장소명" value={venueName} onChange={(event) => setVenueName(event.target.value)} sx={fieldSx} />
        <TextField label="주소" value={venueAddress} onChange={(event) => setVenueAddress(event.target.value)} sx={fieldSx} />
        <TextField multiline minRows={2} label="대회 소개" value={description} onChange={(event) => setDescription(event.target.value)} sx={fieldSx} />
        <TextField multiline minRows={2} label="공지사항" value={notice} onChange={(event) => setNotice(event.target.value)} sx={fieldSx} />
        <Box sx={{ p: 1.5, bgcolor: "#FFF8E1", borderRadius: 1.5 }}>
          <FormControlLabel control={<Switch checked={premiumVisible} onChange={(event) => setPremiumVisible(event.target.checked)} />} label={<Box><Typography fontWeight={900}>프리미엄 노출</Typography><Typography fontSize={12.5} color="text.secondary">ON이면 공개 대회 목록에 노출합니다. OFF여도 초대된 클럽은 참여할 수 있습니다.</Typography></Box>} />
        </Box>
      </Stack>
    </CardContent></Card>

    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
      <Box><Typography fontWeight={950} fontSize={18}>참가 부문</Typography><Typography fontSize={12.5} color="text.secondary">각 부문의 유형·방식·규칙은 서로 다르게 설정할 수 있습니다.</Typography></Box>
      <Button startIcon={<AddIcon />} onClick={() => setDivisions((current) => [...current, emptyDivision()])}>부문 추가</Button>
    </Stack>
    <Stack spacing={1.5}>
      {divisions.map((division, index) => <Card key={index} variant="outlined" sx={{ borderRadius: 2 }}><CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Typography fontWeight={950} sx={{ flex: 1 }}>부문 {index + 1}</Typography>
          <IconButton aria-label="부문 삭제" disabled={divisions.length === 1} onClick={() => setDivisions((current) => current.filter((_, itemIndex) => itemIndex !== index))}><DeleteOutlineIcon /></IconButton>
        </Stack>
        <Stack spacing={1.2}>
          <TextField required label="부문명" placeholder="예: 3~4부" value={division.name} onChange={(event) => updateDivision(index, { name: event.target.value })} sx={fieldSx} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            <TextField select fullWidth label="경기 유형" value={division.league_type} onChange={(event) => updateDivision(index, { league_type: event.target.value as TournamentDivisionInput["league_type"] })} sx={fieldSx}>
              <MenuItem value="SINGLES">단식</MenuItem><MenuItem value="DOUBLES">복식</MenuItem><MenuItem value="TEAM">단체전</MenuItem>
            </TextField>
            <TextField select fullWidth label="진행 방식" value={division.format} onChange={(event) => updateDivision(index, { format: event.target.value as TournamentDivisionInput["format"] })} sx={fieldSx}>
              <MenuItem value="LEAGUE">풀리그</MenuItem><MenuItem value="GROUP">조별리그</MenuItem><MenuItem value="TOURNAMENT">토너먼트</MenuItem><MenuItem value="GROUP_TOURNAMENT">조별리그 + 토너먼트</MenuItem>
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            <TextField select fullWidth label="경기 규칙" value={String(division.rules.match_rule)} onChange={(event) => updateDivision(index, { rules: { ...division.rules, match_rule: event.target.value } })} sx={fieldSx}>
              {["1게임 단판", "3게임 2선승", "5게임 3선승", "7게임 4선승"].map((rule) => <MenuItem key={rule} value={rule}>{rule}</MenuItem>)}
            </TextField>
            <TextField fullWidth type="number" label="모집 인원" value={division.recruit_count ?? ""} onChange={(event) => updateDivision(index, { recruit_count: event.target.value ? Math.max(1, Number(event.target.value)) : null })} inputProps={{ min: 1 }} sx={fieldSx} />
          </Stack>
        </Stack>
      </CardContent></Card>)}
    </Stack>
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    <Divider sx={{ my: 2.5 }} />
    <Stack direction="row" spacing={1.2}>
      <Button fullWidth variant="outlined" onClick={() => navigate(-1)} disabled={isCreating}>취소</Button>
      <Button fullWidth variant="contained" onClick={handleSubmit} disabled={isCreating}>{isCreating ? "생성 중..." : "대회 생성"}</Button>
    </Stack>
  </Box>;
}
