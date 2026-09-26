import { useMemo, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Divider, FormControl, FormControlLabel, IconButton, MenuItem, Radio, RadioGroup, Select, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PlaceSearchDialog from "../../components/PlaceSearchDialog";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useCreateTournamentMutation, useGetTournamentEligibilityQuery, type TournamentDivisionInput, type TournamentFormat, type TournamentLeagueType } from "../../features/tournament/tournamentApi";

type DivisionDraft = TournamentDivisionInput & { key: number; matchRule: string };
const makeDivision = (key: number, name = ""): DivisionDraft => ({ key, name, league_type: "SINGLES", format: "GROUP_TOURNAMENT", matchRule: "BEST_OF_3", rules: { match_rule: "BEST_OF_3" }, recruit_count: null });
const rowSx = { display: "grid", gridTemplateColumns: "72px 1fr", alignItems: "center", gap: 2, py: 1.2, borderBottom: "1px solid #D9DDE6" };
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 0.6, bgcolor: "#fff", height: 32 }, "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.95rem" } };
const selectSx = { height: 32, flex: 1, borderRadius: 0.6, bgcolor: "#fff", fontSize: "0.95rem" };
const hours = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, "0"));
const minutes = ["00", "10", "20", "30", "40", "50"];
const optionSx = { m: 0, px: 2, minHeight: 66, border: "1px solid #D9DDE6", borderRadius: 1, bgcolor: "#fff", boxShadow: "0 2px 2px rgba(0,0,0,0.18)", "& .MuiFormControlLabel-label": { fontSize: 20, fontWeight: 800 } };
const steps = ["", "대회 정보", "대회 구성", "참가 부문", "대회 유형", "대회 방식", "대회 규칙", "대회 생성"];
const typeOptions: Array<{ value: TournamentLeagueType; label: string }> = [{ value: "SINGLES", label: "단식" }, { value: "DOUBLES", label: "복식" }, { value: "TEAM", label: "단체전" }];
const formatOptions: Array<{ value: TournamentFormat; label: string }> = [{ value: "LEAGUE", label: "풀리그" }, { value: "GROUP", label: "조별리그" }, { value: "TOURNAMENT", label: "토너먼트" }, { value: "GROUP_TOURNAMENT", label: "조별리그 + 토너먼트" }];
const ruleOptions = [{ value: "BEST_OF_3", label: "3전 2선승제" }, { value: "BEST_OF_5", label: "5전 3선승제" }, { value: "THREE_SET", label: "3세트제" }];

function OptionalNumberStepper({ value, onChange }: { value: number | ""; onChange: (value: number | "") => void }) {
  const numericValue = value === "" ? 1 : value;
  return <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.7} sx={{ width: "100%" }}>
    <IconButton aria-label="수량 감소" disabled={value === "" || numericValue <= 1} onClick={() => onChange(Math.max(1, numericValue - 1))} sx={{ width: 36, height: 36, border: "1px solid #90CAF9", color: "#1976D2", fontSize: 21 }}>−</IconButton>
    <TextField type="text" value={value} placeholder="선택" onFocus={(event) => event.currentTarget.select()} onChange={(event) => { const digits = event.target.value.replace(/\D/g, ""); onChange(digits ? Math.min(999, Math.max(1, Number(digits))) : ""); }} inputProps={{ inputMode: "numeric", "aria-label": "수량" }} size="small" sx={{ width: 66, "& .MuiInputBase-root": { height: 36, borderRadius: 1 }, "& input": { p: 0, textAlign: "center", fontWeight: 800, MozAppearance: "textfield" }, "& input::placeholder": { color: "#B0B5BD", opacity: 1, fontWeight: 500 }, "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": { m: 0, WebkitAppearance: "none" } }} />
    <IconButton aria-label="수량 증가" disabled={value !== "" && numericValue >= 999} onClick={() => onChange(value === "" ? 1 : Math.min(999, numericValue + 1))} sx={{ width: 36, height: 36, border: "1px solid #90CAF9", color: "#1976D2", fontSize: 21 }}>+</IconButton>
  </Stack>;
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
  const dateRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const today = new Date();
  const defaultTournamentTitle = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")} 대회`;
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [placeOpen, setPlaceOpen] = useState(false);
  const [premiumVisible, setPremiumVisible] = useState(true);
  const [courtCount, setCourtCount] = useState<number | "">("");
  const [participantCount, setParticipantCount] = useState<number | "">("");
  const [divisions, setDivisions] = useState<DivisionDraft[]>([makeDivision(1, "3~4부"), makeDivision(2, "5~6부"), makeDivision(3, "7~8부"), makeDivision(4, "희망부")]);
  const [error, setError] = useState("");
  const effectiveGroupId = groups.find((group) => group.id === preferredGroupId)?.id || groups[0]?.id || "";
  const [startHour, startMinute] = startTime ? startTime.split(":") : ["", ""];
  const [endHour, endMinute] = endTime ? endTime.split(":") : ["", ""];
  const timeSelect = (value: string, placeholder: string, onChange: (value: string) => void, options: string[]) => <Select displayEmpty value={value} onChange={(event) => onChange(String(event.target.value))} sx={selectSx}><MenuItem value="" disabled>{placeholder}</MenuItem>{options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select>;
  const updateDivision = (key: number, patch: Partial<DivisionDraft>) => setDivisions((current) => current.map((division) => division.key === key ? { ...division, ...patch } : division));
  const validate = () => {
    if (step === 1 && (!date || !startTime || !effectiveGroupId)) return "날짜와 시작 시간을 입력해주세요.";
    if (step === 1 && participantCount === 1) return "참가자 수는 2명 이상 입력해주세요.";
    if (step === 1 && endTime && endTime <= startTime) return "종료 시간은 시작 시간보다 늦어야 합니다.";
    if (step === 3 && divisions.some((division) => !division.name.trim())) return "모든 부문에 이름을 입력해주세요.";
    if (step === 3 && new Set(divisions.map((division) => division.name.trim())).size !== divisions.length) return "부문 이름은 중복될 수 없습니다.";
    if (step === 3 && divisions.some((division) => division.recruit_count !== null && (!Number.isInteger(division.recruit_count) || division.recruit_count < 1))) return "모집 인원은 1명 이상 입력해주세요.";
    return "";
  };
  const next = () => { const issue = validate(); if (issue) { setError(issue); return; } setError(""); setStep((current) => current + 1); };
  const previous = () => { setError(""); if (step === 1) navigate("/league"); else setStep((current) => current - 1); };
  const submit = async () => {
    setError("");
    const startsAt = new Date(`${date}T${startTime}:00`);
    const endsAt = endTime ? new Date(`${date}T${endTime}:00`) : null;
    if (!Number.isFinite(startsAt.getTime()) || (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt))) { setError("대회 시간을 확인해주세요."); return; }
    try {
      await createTournament({
        title: title.trim() || defaultTournamentTitle,
        venue_name: location.trim() || null, venue_address: venueAddress.trim() || null,
        court_count: courtCount === "" ? null : courtCount,
        recruit_count: participantCount === "" ? null : participantCount,
        starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null,
        host_group_id: effectiveGroupId, premium_visible: premiumVisible,
        divisions: divisions.map(({ name, league_type, format, matchRule, recruit_count }) => ({ name: name.trim(), league_type, format, rules: { match_rule: matchRule }, recruit_count })),
      }).unwrap();
      navigate("/league", { replace: true });
    } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "대회를 생성하지 못했습니다."); }
  };
  if (!token) return <Box sx={{ p: 2.5 }}><Alert severity="info">로그인 후 대회를 생성할 수 있습니다.</Alert></Box>;
  if (checkingEligibility || checkingGroups) return <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress /></Box>;
  if (!eligibility?.can_create) return <Box sx={{ p: 2.5 }}><Alert severity="warning">대회 메뉴는 프리미엄 구독자만 이용할 수 있습니다.</Alert></Box>;
  if (groups.length === 0) return <Box sx={{ p: 2.5 }}><Alert severity="warning">대회를 주최할 수 있는 클럽 관리 권한이 없습니다.</Alert></Box>;

  return <Box sx={{ px: 2.5, pt: 2, pb: 3 }}>
    <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>{steps[step]}</Typography>
    {step === 1 && <>
      <Box sx={{ borderTop: "1px solid #D9DDE6" }}>
        <Box sx={rowSx}><Typography fontWeight={900}>대회명 <Box component="span" sx={{ color: "#EF4444" }}>*</Box></Typography><TextField value={title} placeholder={defaultTournamentTitle} onChange={(event) => setTitle(event.target.value)} sx={fieldSx} /></Box>
        <Box sx={{ ...rowSx, cursor: "pointer" }} onClick={() => dateRef.current?.showPicker()}><Typography fontWeight={900}>날짜 <Box component="span" sx={{ color: "#EF4444" }}>*</Box></Typography><TextField inputRef={dateRef} type="date" value={date} onChange={(event) => setDate(event.target.value)} sx={fieldSx} /></Box>
        <Box sx={rowSx}><Typography fontWeight={900}>시간 *</Typography><Stack spacing={1}>
          <Stack direction="row" spacing={0.8} alignItems="center"><Typography sx={{ width: 34, fontWeight: 700 }}>시작</Typography>{timeSelect(startHour, "시", (value) => setStartTime(`${value}:${startMinute || "00"}`), hours)}<Typography>:</Typography>{timeSelect(startMinute, "분", (value) => setStartTime(`${startHour || "00"}:${value}`), minutes)}</Stack>
          <Stack direction="row" spacing={0.8} alignItems="center"><Typography sx={{ width: 34, fontWeight: 700 }}>종료</Typography>{timeSelect(endHour, "시", (value) => setEndTime(`${value}:${endMinute || "00"}`), hours)}<Typography>:</Typography>{timeSelect(endMinute, "분", (value) => setEndTime(`${endHour || "00"}:${value}`), minutes)}</Stack>
        </Stack></Box>
        <Box sx={rowSx}><Typography fontWeight={900}>장소</Typography><Stack direction="row" spacing={0.8}><TextField value={location} onChange={(event) => setLocation(event.target.value)} placeholder="장소명 또는 주소" sx={{ ...fieldSx, flex: 1 }} /><Button variant="outlined" size="small" startIcon={<SearchIcon />} onClick={() => setPlaceOpen(true)} sx={{ whiteSpace: "nowrap", fontWeight: 800 }}>주소 검색</Button></Stack></Box>
        {venueAddress && <Box sx={rowSx}><Typography fontWeight={900}>주소</Typography><Typography fontSize={13}>{venueAddress}</Typography></Box>}
        <Box sx={rowSx}><Typography fontWeight={900}>코트 수</Typography><OptionalNumberStepper value={courtCount} onChange={setCourtCount} /></Box>
        <Box sx={rowSx}><Typography fontWeight={900}>참가자 수</Typography><Box><OptionalNumberStepper value={participantCount} onChange={setParticipantCount} /><Typography sx={{ mt: 0.5, textAlign: "right", color: "text.secondary", fontSize: 11.5 }}>모든 부문 합계</Typography></Box></Box>
      </Box>
      <Divider sx={{ my: 3, borderColor: "#D8B4FE" }} />
      <Typography sx={{ fontSize: 12, fontWeight: 950, color: "#6D28D9", letterSpacing: 1.2, mb: 1 }}>PREMIUM OPTION · 프리미엄 전용</Typography>
      <Box sx={{ position: "relative", overflow: "hidden", borderRadius: 2, border: premiumVisible ? "2px solid #F2C94C" : "1px solid #D9B95B", background: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 58%, #9333EA 100%)", boxShadow: premiumVisible ? "0 14px 32px rgba(91,33,182,0.34), inset 0 0 0 1px rgba(255,238,170,0.28)" : "0 10px 26px rgba(91,33,182,0.24)", p: 2.2 }}>
        <Box sx={{ position: "absolute", width: 170, height: 170, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.10)", right: -55, top: -80 }} />
        <Stack spacing={1.6} sx={{ position: "relative" }}>
          <Box><Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}><Typography component="span" sx={{ fontSize: 19, lineHeight: 1 }}>👑</Typography><Typography sx={{ color: "#FFE38A", fontSize: 12, fontWeight: 950, letterSpacing: 1.4 }}>PREMIUM</Typography></Stack><Typography sx={{ color: "#fff", fontSize: 18, fontWeight: 950 }}>프리미엄 노출</Typography><Typography sx={{ color: "#F3E8FF", fontSize: 12.5, mt: 0.55, lineHeight: 1.55 }}>주변 사용자에게 대회를 소개하고 프리미엄 일정 영역에 우선 노출합니다.</Typography></Box>
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="contained" onClick={() => setPremiumVisible(false)} sx={{ fontWeight: 950, border: !premiumVisible ? "3px solid #fff" : "1px solid #D1D5DB", bgcolor: !premiumVisible ? "#E5E7EB" : "#F3F4F6", color: "#374151", opacity: !premiumVisible ? 1 : 0.62, transform: !premiumVisible ? "translateY(-2px)" : "none", boxShadow: !premiumVisible ? "0 6px 16px rgba(17,24,39,0.3), 0 0 0 2px rgba(255,255,255,0.35)" : "none", "&:hover": { bgcolor: "#DDE0E5", opacity: 1 } }}>{!premiumVisible ? "✓ 사용 안 함" : "사용 안 함"}</Button>
            <Button fullWidth variant="contained" startIcon={<Typography component="span" sx={{ fontSize: 16 }}>👑</Typography>} onClick={() => setPremiumVisible(true)} sx={{ fontWeight: 950, border: premiumVisible ? "3px solid #fff" : "1px solid #FFD24A", color: "#4A2A00", background: premiumVisible ? "linear-gradient(135deg, #FFF09A 0%, #FFC107 100%)" : "linear-gradient(135deg, #FFF3AE 0%, #FFD75C 100%)", opacity: premiumVisible ? 1 : 0.68, transform: premiumVisible ? "translateY(-2px)" : "none", boxShadow: premiumVisible ? "0 7px 20px rgba(255,184,0,0.58), 0 0 0 2px rgba(255,238,138,0.4)" : "none", "&:hover": { background: "linear-gradient(135deg, #FFE36A 0%, #FFBC0A 100%)", opacity: 1 } }}>{premiumVisible ? "✓ 프리미엄으로 홍보" : "프리미엄으로 홍보"}</Button>
          </Stack>
          <Stack spacing={0.65}>{["전체 일정에 공개", "주변 일정 추천 영역 노출", "프리미엄 일정 우선 배치"].map((label) => <Typography key={label} sx={{ color: "#fff", fontSize: 12.5, fontWeight: 800 }}>✓ {label}</Typography>)}</Stack>
          <Typography sx={{ color: "#FFE38A", fontSize: 11.5, fontWeight: 900 }}>프리미엄 구독 혜택</Typography>
        </Stack>
      </Box>
      <PlaceSearchDialog open={placeOpen} initialQuery={location} onClose={() => setPlaceOpen(false)} allowDirectInput onDirectInput={(value) => { setLocation(value); setVenueAddress(""); setPlaceOpen(false); }} onSelect={(place) => { setLocation(place.name); setVenueAddress(place.address); setPlaceOpen(false); }} />
    </>}
    {step === 2 && <FormControl fullWidth><RadioGroup value="custom"><FormControlLabel value="custom" control={<Radio />} label={<Box><Typography fontWeight={900}>직접 구성하기</Typography><Typography sx={{ mt: 0.5, color: "text.secondary", fontSize: 14 }}>부문별 리그 유형, 방식, 규칙을 직접 선택하여 대회를 생성합니다.</Typography></Box>} sx={{ m: 0, minHeight: 104, px: 2, border: "1px solid #2F80ED", borderRadius: 1, bgcolor: "#EFF6FF" }} /></RadioGroup></FormControl>}
    {step === 3 && <>
      <Typography sx={{ mb: 2, color: "text.secondary", fontSize: 14 }}>참가 신청을 받을 부문을 먼저 만듭니다. 모집 인원은 나중에 수정할 수 있습니다.</Typography>
      <Stack spacing={1.5}>{divisions.map((division, index) => <Box key={division.key} sx={{ border: "1px solid #D9DDE6", borderRadius: 1, p: 2, bgcolor: "#fff" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography fontWeight={900} fontSize={18}>{index + 1}부문</Typography><IconButton aria-label="부문 삭제" disabled={divisions.length === 1} onClick={() => setDivisions((current) => current.filter((item) => item.key !== division.key))}>×</IconButton></Stack>
        <Box sx={rowSx}><Typography fontWeight={900}>부문명 *</Typography><TextField value={division.name} onChange={(event) => updateDivision(division.key, { name: event.target.value })} placeholder="예: 3~4부" sx={fieldSx} /></Box>
        <Box sx={rowSx}><Typography fontWeight={900}>참가자 수</Typography><TextField type="number" value={division.recruit_count ?? ""} onChange={(event) => updateDivision(division.key, { recruit_count: event.target.value ? Number(event.target.value) : null })} inputProps={{ min: 1 }} sx={fieldSx} /></Box>
      </Box>)}</Stack>
      <Button fullWidth variant="outlined" onClick={() => setDivisions((current) => [...current, makeDivision(Math.max(...current.map((item) => item.key)) + 1)])} sx={{ mt: 1.5, minHeight: 44, borderRadius: 1, fontWeight: 900 }}>+ 부문 추가</Button>
    </>}
    {[4, 5, 6].includes(step) && <Stack spacing={2}>{divisions.map((division, index) => <Box key={division.key} sx={{ border: "1px solid #D9DDE6", borderRadius: 1, bgcolor: "#F8FAFC", p: 2 }}>
      <Typography sx={{ fontSize: 20, fontWeight: 900, mb: 1.5 }}>{division.name || `${index + 1}부문`}</Typography>
      {step === 4 && <FormControl fullWidth><RadioGroup value={division.league_type} onChange={(event) => updateDivision(division.key, { league_type: event.target.value as TournamentLeagueType })}><Stack spacing={1}>{typeOptions.map((option) => <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} sx={{ ...optionSx, borderColor: division.league_type === option.value ? "#2F80ED" : "#D9DDE6" }} />)}</Stack></RadioGroup></FormControl>}
      {step === 5 && <FormControl fullWidth><RadioGroup value={division.format} onChange={(event) => updateDivision(division.key, { format: event.target.value as TournamentFormat })}><Stack spacing={1}>{formatOptions.map((option) => <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} sx={{ ...optionSx, borderColor: division.format === option.value ? "#2F80ED" : "#D9DDE6" }} />)}</Stack></RadioGroup></FormControl>}
      {step === 6 && <FormControl fullWidth><RadioGroup value={division.matchRule} onChange={(event) => updateDivision(division.key, { matchRule: event.target.value })}><Stack spacing={1}>{ruleOptions.map((option) => <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} sx={{ ...optionSx, borderColor: division.matchRule === option.value ? "#2F80ED" : "#D9DDE6" }} />)}</Stack></RadioGroup></FormControl>}
    </Box>)}</Stack>}
    {step === 7 && <Box sx={{ borderTop: "1px solid #D9DDE6" }}>
      <Box sx={rowSx}><Typography fontWeight={900}>대회명</Typography><Typography>{title.trim() || `${date} 대회`}</Typography></Box>
      <Box sx={rowSx}><Typography fontWeight={900}>일정</Typography><Typography>{date} {startTime}{endTime ? ` ~ ${endTime}` : ""}</Typography></Box>
      <Box sx={rowSx}><Typography fontWeight={900}>코트 수</Typography><Typography>{courtCount === "" ? "미설정" : `${courtCount}개`}</Typography></Box>
      <Box sx={rowSx}><Typography fontWeight={900}>참가자 수</Typography><Typography>{participantCount === "" ? "미설정" : `전체 ${participantCount}명`}</Typography></Box>
      <Box sx={rowSx}><Typography fontWeight={900}>부문</Typography><Stack spacing={0.6}>{divisions.map((division) => <Typography key={division.key} fontWeight={700}>{division.name} · {typeOptions.find((item) => item.value === division.league_type)?.label} · {formatOptions.find((item) => item.value === division.format)?.label}</Typography>)}</Stack></Box>
      <Box sx={rowSx}><Typography fontWeight={900}>노출</Typography><Typography>{premiumVisible ? "프리미엄 노출" : "사용 안 함"}</Typography></Box>
    </Box>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
      <Button fullWidth variant="contained" disableElevation onClick={previous} disabled={isCreating} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#777" } }}>이전</Button>
      <Button fullWidth variant="contained" disableElevation onClick={step === 7 ? submit : next} disabled={isCreating} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>{step === 7 ? isCreating ? "생성 중..." : "완료" : "다음"}</Button>
    </Stack>
  </Box>;
}
