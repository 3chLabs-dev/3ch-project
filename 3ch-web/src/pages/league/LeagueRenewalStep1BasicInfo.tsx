import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Divider,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setRenewalBasicInfo, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";
import LeagueInvitedGroupsPicker from "./LeagueInvitedGroupsPicker";
import { useGetMyFeatureUsageQuery } from "../../features/payment/usageApi";
import { useLazySearchLeagueVenuesQuery } from "../../features/group/groupApi";

const rowSx = { display: "grid", gridTemplateColumns: "72px 1fr", alignItems: "center", gap: 2, py: 1.2, borderBottom: "1px solid #D9DDE6" };
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 0.6, bgcolor: "#fff", height: 32 }, "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.95rem" } };
const selectSx = { height: 32, flex: 1, borderRadius: 0.6, bgcolor: "#fff", fontSize: "0.95rem" };
const hours = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, "0"));
const minutes = ["00", "10", "20", "30", "40", "50"];

function RequiredMark() { return <Box component="span" sx={{ color: "#EF4444", fontSize: 18 }}>*</Box>; }

function OptionalNumberStepper({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number | "";
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number | "") => void;
}) {
  const numericValue = value === "" ? min : value;

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="flex-end"
      spacing={0.7}
      sx={{ width: "100%" }}
    >
      <IconButton
        aria-label={`${suffix} 수 감소`}
        disabled={value === "" || numericValue <= min}
        onClick={() => onChange(Math.max(min, numericValue - 1))}
        sx={{ width: 36, height: 36, border: "1px solid #90CAF9", color: "#1976D2", fontSize: 21 }}
      >
        −
      </IconButton>
      <TextField
        type="text"
        value={value}
        placeholder="선택"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          if (!digits) {
            onChange("");
            return;
          }
          onChange(Math.min(max, Math.max(min, Number(digits))));
        }}
        inputProps={{ inputMode: "numeric", "aria-label": `${suffix} 수` }}
        size="small"
        sx={{
          width: suffix === "명" ? 66 : 56,
          "& .MuiInputBase-root": { height: 36, borderRadius: 1 },
          "& input": {
            p: 0,
            textAlign: "center",
            fontWeight: 800,
            MozAppearance: "textfield",
          },
          "& input::placeholder": { color: "#B0B5BD", opacity: 1, fontWeight: 500 },
          "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": {
            m: 0,
            WebkitAppearance: "none",
          },
        }}
      />
      <IconButton
        aria-label={`${suffix} 수 증가`}
        disabled={value !== "" && numericValue >= max}
        onClick={() => onChange(value === "" ? min : Math.min(max, numericValue + 1))}
        sx={{ width: 36, height: 36, border: "1px solid #90CAF9", color: "#1976D2", fontSize: 21 }}
      >
        +
      </IconButton>
      <Typography sx={{ width: 28, flexShrink: 0, fontSize: 14, fontWeight: 700 }}>
        {suffix}
      </Typography>
    </Stack>
  );
}

export default function LeagueRenewalStep1BasicInfo() {
  const dispatch = useAppDispatch();
  const existing = useAppSelector((state) => state.leagueRenewalCreation.basicInfo);
  const dateRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(existing?.date ?? "");
  const [startTime, setStartTime] = useState(existing?.startTime ?? "");
  const [endTime, setEndTime] = useState(existing?.endTime ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [venueAddress, setVenueAddress] = useState(existing?.venueAddress ?? "");
  const [venueLat, setVenueLat] = useState<number | null>(existing?.venueLat ?? null);
  const [venueLng, setVenueLng] = useState<number | null>(existing?.venueLng ?? null);
  const [venueRegionCity, setVenueRegionCity] = useState(existing?.venueRegionCity ?? "");
  const [venueRegionDistrict, setVenueRegionDistrict] = useState(existing?.venueRegionDistrict ?? "");
  const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [searchVenues, { data: placeData, isFetching: placeSearching }] = useLazySearchLeagueVenuesQuery();
  const [participantCount, setParticipantCount] = useState<number | "">(existing?.participantCount ?? "");
  const [courtCount, setCourtCount] = useState<number | "">(existing?.courtCount ?? "");
  const [joinPermission, setJoinPermission] = useState<"public" | "club_only">(existing?.joinPermission ?? "club_only");
  const [premiumEnabled, setPremiumEnabled] = useState(existing?.premiumEnabled ?? false);
  const authUserId = useAppSelector((state) => state.auth.user?.id);
  const { data: usageData } = useGetMyFeatureUsageQuery(authUserId, { skip: !authUserId, refetchOnMountOrArgChange: true });
  const premiumBalance = usageData?.usage.premium_promotion;
  const canUsePremium = Boolean(premiumBalance?.unlimited || Number(premiumBalance?.remaining ?? 0) > 0);
  const [participantCountDialogOpen, setParticipantCountDialogOpen] = useState(false);
  const [startHour, startMinute] = startTime ? startTime.split(":") : ["", ""];
  const [endHour, endMinute] = endTime ? endTime.split(":") : ["", ""];
  const canNext = useMemo(() => Boolean(title && date && startTime), [date, startTime, title]);

  const saveAndNext = () => {
    if (!canNext) return;
    if (participantCount === 1) {
      setParticipantCountDialogOpen(true);
      return;
    }
    dispatch(setRenewalBasicInfo({ title, date, startTime, endTime, location, participantCount: participantCount === "" ? null : participantCount, courtCount: courtCount === "" ? null : courtCount, joinPermission, premiumEnabled, venueAddress, venueLat, venueLng, venueRegionCity, venueRegionDistrict }));
    dispatch(setRenewalStep(2));
  };

  const timeSelect = (value: string, placeholder: string, onChange: (value: string) => void, options: string[]) => (
    <Select displayEmpty value={value} onChange={(event) => onChange(String(event.target.value))} sx={selectSx}>
      <MenuItem value="" disabled>{placeholder}</MenuItem>
      {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
    </Select>
  );

  return <Box sx={{ px: 2.5, pt: 2 }}>
    <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>리그 정보</Typography>
    <Box sx={{ borderTop: "1px solid #D9DDE6" }}>
      <Box sx={rowSx}><Typography sx={{ fontWeight: 900 }}>리그명 <RequiredMark /></Typography><TextField value={title} onChange={(event) => setTitle(event.target.value)} sx={fieldSx} /></Box>
      <Box sx={{ ...rowSx, cursor: "pointer" }} onClick={() => dateRef.current?.showPicker()}><Typography sx={{ fontWeight: 900 }}>날짜 <RequiredMark /></Typography><TextField inputRef={dateRef} type="date" value={date} onChange={(event) => setDate(event.target.value)} sx={fieldSx} /></Box>
      <Box sx={rowSx}>
        <Typography sx={{ fontWeight: 900 }}>시간 <RequiredMark /></Typography>
        <Stack spacing={1}>
          <Stack direction="row" spacing={0.8} alignItems="center"><Typography sx={{ width: 34, fontWeight: 700 }}>시작</Typography>{timeSelect(startHour, "시", (value) => setStartTime(`${value}:${startMinute || "00"}`), hours)}<Typography>:</Typography>{timeSelect(startMinute, "분", (value) => setStartTime(`${startHour || "00"}:${value}`), minutes)}</Stack>
          <Stack direction="row" spacing={0.8} alignItems="center"><Typography sx={{ width: 34, fontWeight: 700 }}>종료</Typography>{timeSelect(endHour, "시", (value) => setEndTime(`${value}:${endMinute || "00"}`), hours)}<Typography>:</Typography>{timeSelect(endMinute, "분", (value) => setEndTime(`${endHour || "00"}:${value}`), minutes)}</Stack>
        </Stack>
      </Box>
      <Box sx={rowSx}>
        <Typography sx={{ fontWeight: 900 }}>장소</Typography>
        <Box>
          <Stack direction="row" spacing={0.8}>
            <TextField value={location} onChange={(event) => { setLocation(event.target.value); setVenueLat(null); setVenueLng(null); }} sx={{ ...fieldSx, flex: 1 }} placeholder="탁구장 또는 주소" />
            <Button variant="outlined" size="small" startIcon={<SearchIcon />} onClick={() => { setPlaceQuery(location); setPlaceDialogOpen(true); }} sx={{ whiteSpace: "nowrap", fontWeight: 800 }}>주소 검색</Button>
          </Stack>
          {venueAddress && <Typography fontSize={11.5} color="text.secondary" sx={{ mt: 0.6 }}>{venueAddress} · {venueRegionCity} {venueRegionDistrict}</Typography>}
        </Box>
      </Box>
      <Box sx={rowSx}>
        <Typography sx={{ fontWeight: 900 }}>탁구대 수</Typography>
        <OptionalNumberStepper value={courtCount} min={1} max={99} suffix="대" onChange={setCourtCount} />
      </Box>
      <Box sx={rowSx}>
        <Typography sx={{ fontWeight: 900 }}>참가자 수</Typography>
        <OptionalNumberStepper value={participantCount} min={1} max={999} suffix="명" onChange={setParticipantCount} />
      </Box>
    </Box>
    <LeagueInvitedGroupsPicker />
    <Divider sx={{ my: 3, borderColor: "#D8B4FE" }} />
    <Box>
      {canUsePremium && (
        <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 950, color: "#6D28D9", letterSpacing: 1.2, mb: 1 }}>
          PREMIUM OPTION · 프리미엄 전용
        </Typography>
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 2,
            border: premiumEnabled ? "2px solid #F2C94C" : "1px solid #D9B95B",
            background: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 58%, #9333EA 100%)",
            boxShadow: premiumEnabled ? "0 14px 32px rgba(91,33,182,0.34), inset 0 0 0 1px rgba(255,238,170,0.28)" : "0 10px 26px rgba(91,33,182,0.24)",
            p: 2.2,
          }}
        >
          <Box sx={{ position: "absolute", width: 170, height: 170, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.10)", right: -55, top: -80 }} />
          <Stack spacing={1.6}>
            <Box sx={{ position: "relative" }}>
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}>
                <Typography component="span" sx={{ fontSize: 19, lineHeight: 1 }}>👑</Typography>
                <Typography sx={{ color: "#FFE38A", fontSize: 12, fontWeight: 950, letterSpacing: 1.4 }}>PREMIUM</Typography>
              </Stack>
              <Typography sx={{ color: "#fff", fontSize: 18, fontWeight: 950 }}>프리미엄 노출</Typography>
              <Typography sx={{ color: "#F3E8FF", fontSize: 12.5, mt: 0.55, lineHeight: 1.55 }}>
                주변 사용자에게 리그를 소개하고 프리미엄 일정 영역에 우선 노출합니다.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ position: "relative" }}>
              <Button fullWidth variant="contained" onClick={() => setPremiumEnabled(false)} sx={{ fontWeight: 900, border: !premiumEnabled ? "2px solid #FFE38A" : "1px solid rgba(255,255,255,0.5)", bgcolor: !premiumEnabled ? "#40364A" : "rgba(255,255,255,0.15)", color: "#fff", "&:hover": { bgcolor: !premiumEnabled ? "#332B3B" : "rgba(255,255,255,0.24)" } }}>사용 안 함</Button>
              <Button fullWidth variant="contained" startIcon={<Typography component="span" sx={{ fontSize: 16 }}>👑</Typography>} onClick={() => { setPremiumEnabled(true); setJoinPermission("public"); }} sx={{ fontWeight: 950, border: premiumEnabled ? "2px solid #FFF0A6" : "1px solid #F2C94C", color: premiumEnabled ? "#4C1D75" : "#FFE38A", bgcolor: premiumEnabled ? "#FFE38A" : "rgba(54,20,91,0.42)", "&:hover": { bgcolor: premiumEnabled ? "#FFD95C" : "rgba(54,20,91,0.58)" } }}>프리미엄으로 홍보</Button>
            </Stack>
          </Stack>
          <Stack spacing={0.65} sx={{ mt: 1.8, position: "relative" }}>
            {["전체 일정에 공개", "주변 일정 추천 영역 노출", "프리미엄 일정 우선 배치"].map((label) => (
              <Typography key={label} sx={{ color: "#fff", fontSize: 12.5, fontWeight: 800 }}>✓ {label}</Typography>
            ))}
          </Stack>
          <Typography sx={{ mt: 1.5, color: "#FFE38A", fontSize: 11.5, fontWeight: 900, position: "relative" }}>
            {premiumBalance?.unlimited ? "프리미엄 구독 혜택" : `사용 가능한 프리미엄 노출권 ${premiumBalance?.remaining ?? 0}회`}
          </Typography>
        </Box>
        </Box>
      )}
    </Box>
    <Stack direction="row" spacing={2} sx={{ mt: 4 }}><Button fullWidth variant="contained" disableElevation onClick={() => dispatch(setRenewalStep(0))} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#777" } }}>이전</Button><Button fullWidth variant="contained" disableElevation disabled={!canNext} onClick={saveAndNext} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" }, "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" } }}>다음</Button></Stack>
    <Dialog
      open={participantCountDialogOpen}
      onClose={() => setParticipantCountDialogOpen(false)}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ fontWeight: 800 }}>참가자 수 확인</DialogTitle>
      <DialogContent>
        <Typography>참가자 수는 2명 이상 입력해 주세요.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setParticipantCountDialogOpen(false)} sx={{ fontWeight: 700 }}>
          확인
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog open={placeDialogOpen} onClose={() => setPlaceDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>주소 검색</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} sx={{ mt: 0.5, mb: 2 }}>
          <TextField fullWidth size="small" autoFocus value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && placeQuery.trim().length >= 2) void searchVenues(placeQuery.trim()); }} placeholder="탁구장, 체육관 또는 주소" />
          <Button variant="contained" disabled={placeQuery.trim().length < 2 || placeSearching} onClick={() => void searchVenues(placeQuery.trim())}>{placeSearching ? <CircularProgress size={18} color="inherit" /> : "검색"}</Button>
        </Stack>
        <Stack spacing={1}>
          {(placeData?.places ?? []).map((place) => (
            <Button
              key={place.id}
              variant="outlined"
              onClick={() => {
                setLocation(place.name);
                setVenueAddress(place.address);
                setVenueLat(place.lat);
                setVenueLng(place.lng);
                setVenueRegionCity(place.region_city ?? "");
                setVenueRegionDistrict(place.region_district ?? "");
                setPlaceDialogOpen(false);
              }}
              sx={{ display: "block", textAlign: "left", px: 1.5, py: 1.1, color: "text.primary" }}
            >
              <Typography fontWeight={900} fontSize={14}>{place.name}</Typography>
              <Typography fontSize={11.5} color="text.secondary">{place.address}</Typography>
            </Button>
          ))}
          {!placeSearching && placeData && placeData.places.length === 0 && <Typography textAlign="center" color="text.secondary" sx={{ py: 3 }}>검색 결과가 없습니다.</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setPlaceDialogOpen(false)}>닫기</Button></DialogActions>
    </Dialog>
  </Box>;
}
