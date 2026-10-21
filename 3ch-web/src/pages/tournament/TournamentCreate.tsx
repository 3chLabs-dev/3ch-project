import { OptionalNumberStepper as LeagueNumberStepper, PremiumExposureOption, LeagueTimeFields, rowSx, fieldSx } from "../league/LeagueRenewalStep1BasicInfo";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { LeagueRoundStepForm, areLeagueRoundsValid } from "../league/LeagueRenewalRoundStep";
import type { RenewalRoundConfig } from "../../features/league/leagueRenewalCreationSlice";
import { Alert, Box, Button, CircularProgress, Divider, IconButton, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PlaceSearchDialog from "../../components/PlaceSearchDialog";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useCreateTournamentMutation, useGetTournamentEligibilityQuery, type TournamentDivisionInput } from "../../features/tournament/tournamentApi";

type RoundDraft = RenewalRoundConfig & { key: number };
type DivisionDraft = Omit<TournamentDivisionInput, "rounds"> & { key: number; rounds: RoundDraft[] };
const makeRound = (key: number): RoundDraft => ({ key, id: key, expanded: true, program: "SINGLES", format: "GROUP", matchRule: "BEST_OF_3", option: key === 1 ? "PRELIM" : "FINAL", teamPlayerCount: 3, teamMatchType: "SSS", tournamentMode: "single", finalAdvancementMode: "all", advanceCount: 2 });
const makeDivision = (key: number, name = ""): DivisionDraft => ({ key, name, recruit_count: null, rounds: [makeRound(1)] });
const steps = ["", "대회 정보", "참가 부문", "대회 유형", "대회 방식", "대회 규칙"];

function OptionalNumberStepper({ value, onChange }: { value: number | ""; onChange: (value: number | "") => void }) {
  return <LeagueNumberStepper value={value} onChange={onChange} min={1} max={999} suffix="" />;
}

export default function TournamentCreate() {
  const navigate = useNavigate();
  const token = useAppSelector((state) => state.auth.token);
  const preferredGroupId = useAppSelector((state) => state.leagueCreation.preferredGroupId);
  const { data: eligibility, isLoading: checkingEligibility } = useGetTournamentEligibilityQuery(undefined, { skip: !token });
  const { data: groupData, isLoading: checkingGroups } = useGetMyGroupsQuery(undefined, { skip: !token });
  const [createTournament, { isLoading: isCreating }] = useCreateTournamentMutation();
  const groups = useMemo(() => (groupData?.groups ?? []).filter((group) => group.role === "owner" || (group.role === "admin" && group.management_permissions?.league === true)), [groupData]);
  const [step, setStep] = useState(1);
  const pageTopRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    pageTopRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [step]);
  const dateRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const today = new Date();
  const defaultTournamentTitle = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")} 대회`;
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [location, setLocation] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [placeOpen, setPlaceOpen] = useState(false);
  const [premiumVisible, setPremiumVisible] = useState(true);
  const [courtCount, setCourtCount] = useState<number | "">("");
  const [participantCount, setParticipantCount] = useState<number | "">("");
  const [divisions, setDivisions] = useState<DivisionDraft[]>([makeDivision(1, "3~4부"), makeDivision(2, "5~6부"), makeDivision(3, "7~8부"), makeDivision(4, "희망부")]);
  const [error, setError] = useState("");
  const effectiveGroupId = groups.find((group) => group.id === preferredGroupId)?.id || groups[0]?.id || "";
  const updateDivision = (key: number, patch: Partial<DivisionDraft>) => setDivisions((current) => current.map((division) => division.key === key ? { ...division, ...patch } : division));
  const validate = () => {
    if (step >= 3 && divisions.some(division => !areLeagueRoundsValid(division.rounds, step === 3 ? "type" : step === 4 ? "format" : "rule", participantCount === "" ? null : participantCount))) return "각 부문의 라운드 설정을 확인해주세요.";
    if (step === 1 && (!date || !startTime || !effectiveGroupId)) return "날짜와 시작 시간을 입력해주세요.";
    if (step === 1 && participantCount === 1) return "참가자 수는 2명 이상 입력해주세요.";
    if (step === 1 && endTime && endTime <= startTime) return "종료 시간은 시작 시간보다 늦어야 합니다.";
    if (step === 1 && applicationDeadline && new Date(applicationDeadline) >= new Date(`${date}T${startTime}`)) return "참가 신청 마감을 대회 시작 전으로 설정해주세요.";
    if (step === 1 && applicationDeadline && new Date(applicationDeadline) <= new Date()) return "참가 신청 마감을 현재 이후로 설정해주세요.";
    if (step === 2 && divisions.some((division) => !division.name.trim())) return "모든 부문에 이름을 입력해주세요.";
    if (step === 2 && new Set(divisions.map((division) => division.name.trim())).size !== divisions.length) return "부문 이름은 중복될 수 없습니다.";
    return "";
  };
  const next = () => { const issue = validate(); if (issue) { setError(issue); return; } setError(""); setStep((current) => current + 1); };
  const previous = () => { setError(""); if (step === 1) navigate("/league"); else setStep((current) => current - 1); };
  const submit = async () => {
    const issue = validate(); if (issue) { setError(issue); return; }
    setError("");
    const startsAt = new Date(`${date}T${startTime}:00`);
    const endsAt = endTime ? new Date(`${date}T${endTime}:00`) : null;
    const deadlineAt = applicationDeadline ? new Date(applicationDeadline) : null;
    if (!Number.isFinite(startsAt.getTime()) || (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt))) { setError("대회 시간을 확인해주세요."); return; }
    if (deadlineAt && (!Number.isFinite(deadlineAt.getTime()) || deadlineAt >= startsAt)) { setError("참가 신청 마감을 확인해주세요."); return; }
    try {
      const created = await createTournament({
        title: title.trim() || defaultTournamentTitle,
        venue_name: location.trim() || null, venue_address: venueAddress.trim() || null,
        court_count: courtCount === "" ? null : courtCount,
        recruit_count: participantCount === "" ? null : participantCount,
        starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null,
        application_deadline_at: deadlineAt?.toISOString() ?? null,
        host_group_id: effectiveGroupId, premium_visible: premiumVisible,
        divisions: divisions.map(({ name, recruit_count, rounds }) => ({ name: name.trim(), recruit_count, rounds: rounds.map((round, index) => ({
          league_type: round.program!, format: round.format!, rules: { match_rule: round.matchRule!, league_config: round,
            round_label: round.option === "PRELIM" ? "예선" : round.option === "FINAL" ? (index >= 2 ? "결선" : "본선") : round.option === "UPPER" ? "상위" : round.option === "LOWER" ? "하위" : "",
            tournament_mode: round.tournamentMode ?? "single", final_advancement_mode: round.finalAdvancementMode ?? "all", advance_count: round.advanceCount ?? 2,
            half_split_only_matches: round.halfSplitOnlyMatches === true,
          } })) })),
      }).unwrap();
      navigate(`/tournament/${created.tournament.id}`, { replace: true });
    } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "대회를 생성하지 못했습니다."); }
  };
  if (!token) return <Box sx={{ p: 2.5 }}><Alert severity="info">로그인 후 대회를 생성할 수 있습니다.</Alert></Box>;
  if (checkingEligibility || checkingGroups) return <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress /></Box>;
  if (!eligibility?.can_create) return <Box sx={{ p: 2.5 }}><Alert severity="warning">대회 메뉴는 프리미엄 구독자만 이용할 수 있습니다.</Alert></Box>;
  if (groups.length === 0) return <Box sx={{ p: 2.5 }}><Alert severity="warning">대회를 주최할 수 있는 클럽 관리 권한이 없습니다.</Alert></Box>;

  return <Box ref={pageTopRef} sx={{ px: 2.5, pt: 2, pb: 3 }}>
    <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>{steps[step]}</Typography>
    {step === 1 && <>
      <Box sx={{ borderTop: "1px solid #D9DDE6" }}>
        <Box sx={rowSx}><Typography fontWeight={900}>대회명 <Box component="span" sx={{ color: "#EF4444" }}>*</Box></Typography><TextField value={title} placeholder={defaultTournamentTitle} onChange={(event) => setTitle(event.target.value)} sx={fieldSx} /></Box>
        <Box sx={{ ...rowSx, cursor: "pointer" }} onClick={() => dateRef.current?.showPicker()}><Typography fontWeight={900}>날짜 <Box component="span" sx={{ color: "#EF4444" }}>*</Box></Typography><TextField inputRef={dateRef} type="date" value={date} onChange={(event) => setDate(event.target.value)} sx={fieldSx} /></Box>
        <Box sx={rowSx}><Typography fontWeight={900}>시간 <Box component="span" sx={{ color: "#EF4444" }}>*</Box></Typography><LeagueTimeFields startTime={startTime} endTime={endTime} setStartTime={setStartTime} setEndTime={setEndTime} /></Box>
        <Box sx={{ ...rowSx, cursor: "pointer" }} onClick={() => deadlineRef.current?.showPicker()}><Typography fontWeight={900}>신청 마감</Typography><TextField inputRef={deadlineRef} type="datetime-local" value={applicationDeadline} onChange={(event) => setApplicationDeadline(event.target.value)} sx={fieldSx} inputProps={{ max: date ? `${date}T${startTime || "00:00"}` : undefined }} /></Box>
        <Box sx={rowSx}><Typography fontWeight={900}>장소</Typography><Stack direction="row" spacing={0.8}><TextField value={location} onChange={(event) => setLocation(event.target.value)} placeholder="장소명 또는 주소" sx={{ ...fieldSx, flex: 1 }} /><Button variant="outlined" size="small" startIcon={<SearchIcon />} onClick={() => setPlaceOpen(true)} sx={{ whiteSpace: "nowrap", fontWeight: 800 }}>주소 검색</Button></Stack></Box>
        {venueAddress && <Box sx={rowSx}><Typography fontWeight={900}>주소</Typography><Typography fontSize={13}>{venueAddress}</Typography></Box>}
        <Box sx={rowSx}><Typography fontWeight={900}>코트 수</Typography><OptionalNumberStepper value={courtCount} onChange={setCourtCount} /></Box>
        <Box sx={rowSx}><Typography fontWeight={900}>참가자 수</Typography><Box><OptionalNumberStepper value={participantCount} onChange={setParticipantCount} /><Typography sx={{ mt: 0.5, textAlign: "right", color: "text.secondary", fontSize: 11.5 }}>모든 부문 합계</Typography></Box></Box>
      </Box>
      <Divider sx={{ my: 3, borderColor: "#D8B4FE" }} />
      <PremiumExposureOption premiumEnabled={premiumVisible} setPremiumEnabled={setPremiumVisible} premiumBalance={{ unlimited: true }} noun="대회" />
      <PlaceSearchDialog open={placeOpen} initialQuery={location} onClose={() => setPlaceOpen(false)} allowDirectInput onDirectInput={(value) => { setLocation(value); setVenueAddress(""); setPlaceOpen(false); }} onSelect={(place) => { setLocation(place.name); setVenueAddress(place.address); setPlaceOpen(false); }} />
    </>}
    {step === 2 && <>
      <Typography sx={{ mb: 2, color: "text.secondary", fontSize: 14 }}>참가 신청을 받을 부문을 먼저 만듭니다.</Typography>
      <Stack spacing={1.5}>{divisions.map((division, index) => <Box key={division.key} sx={{ border: "1px solid #D9DDE6", borderRadius: 1, p: 2, bgcolor: "#fff" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography fontWeight={900} fontSize={18}>{index + 1}부문</Typography><IconButton aria-label="부문 삭제" disabled={divisions.length === 1} onClick={() => setDivisions((current) => current.filter((item) => item.key !== division.key))}>×</IconButton></Stack>
        <Box sx={rowSx}><Typography fontWeight={900}>부문명 *</Typography><TextField value={division.name} onChange={(event) => updateDivision(division.key, { name: event.target.value })} placeholder="예: 3~4부" sx={fieldSx} /></Box>
      </Box>)}</Stack>
      <Button fullWidth variant="outlined" onClick={() => setDivisions((current) => [...current, makeDivision(Math.max(...current.map((item) => item.key)) + 1)])} sx={{ mt: 1.5, minHeight: 44, borderRadius: 1, fontWeight: 900 }}>+ 부문 추가</Button>
    </>}
    {step >= 3 && <Stack spacing={4}>{divisions.map(division => <Box key={division.key} sx={{ pb: 3, borderBottom: "2px solid #E5E7EB" }}>
      <Typography sx={{ mb: 2, fontSize: 21, fontWeight: 900 }}>{division.name}</Typography>
      <LeagueRoundStepForm embedded kind={step === 3 ? "type" : step === 4 ? "format" : "rule"}
        rounds={division.rounds} setRounds={rounds => updateDivision(division.key, { rounds: rounds.map(round => ({ ...round, key: round.id })) })}
        hasParticipatingClubs participantCount={participantCount === "" ? null : participantCount} />
    </Box>)}</Stack>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
      <Button fullWidth variant="contained" disableElevation onClick={previous} disabled={isCreating} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#777" } }}>이전</Button>
      <Button fullWidth variant="contained" disableElevation onClick={step === 5 ? submit : next} disabled={isCreating} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>{step === 5 ? isCreating ? "생성 중..." : "완료" : "다음"}</Button>
    </Stack>
  </Box>;
}
