import LeagueProgramList from "../league/LeagueProgramList";
import { tournamentLeagueKey } from "../../features/tournament/leagueScope";
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CurvedShareIcon from '../../components/CurvedShareIcon';
import { calculateTournamentFee } from "../../features/tournament/participationFee";
import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, MenuItem, Select, Snackbar, Stack, TextField, Typography } from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import QRCode from "react-qr-code";
import { createTossTransferLink, isSmartphoneBrowser, parseBankAccount } from "../../utils/paymentDeepLink";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useGetTournamentQuery, useGetTournamentParticipantsAllQuery, useLazyGetTournamentDeletePreviewQuery, useDeleteTournamentMutation, useOpenTournamentMutation, useUpdateTournamentMutation, type TournamentDeleteSummary } from "../../features/tournament/tournamentApi";
import TournamentParticipants from "./TournamentParticipants";

const floatingBoxSx = { position: "fixed", bottom: "calc(56px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", width: "min(calc(100% - 32px), 398px)", pb: 1, zIndex: 10 } as const;
const rowSx = { display: "grid", gridTemplateColumns: "72px 1fr", alignItems: "center", py: 0.8 };
const labelSx = { fontSize: 13, fontWeight: 700, color: "#6B7280" };
const valueSx = { fontSize: 13, fontWeight: 700 };
const inputSx = { "& .MuiInput-underline:before": { display: "none" }, "& .MuiInput-underline:after": { display: "none" }, "& input": { fontSize: 13, fontWeight: 700, p: 0 } };
const selectSx = { fontSize: 13, fontWeight: 700, "&:before": { display: "none" }, "&:after": { display: "none" }, "& .MuiSelect-select": { py: 0.2, pl: 0 } };
const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const localDate = (value: string) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const localTime = (value: string) => new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
type DetailDraft = { title: string; date: string; start: string; end: string; application_deadline_at: string; venue_name: string; court_count: string; recruit_count: string; notice: string; entry_fee: string; bank_account: string };
const draftFromTournament = (tournament: NonNullable<ReturnType<typeof useGetTournamentQuery>["data"]>["tournament"]): DetailDraft => ({ notice: tournament.notice ?? "", entry_fee: String(tournament.entry_fee ?? ""), bank_account: tournament.bank_account ?? "", title: tournament.title, date: localDate(tournament.starts_at), start: localTime(tournament.starts_at), end: tournament.ends_at ? localTime(tournament.ends_at) : "", application_deadline_at: tournament.application_deadline_at ? `${localDate(tournament.application_deadline_at)}T${localTime(tournament.application_deadline_at)}` : "", venue_name: tournament.venue_name ?? "", court_count: String(tournament.court_count ?? ""), recruit_count: String(tournament.recruit_count ?? "") });

export default function TournamentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error: loadError } = useGetTournamentQuery(id, { skip: !id });
  const [update, { isLoading: saving }] = useUpdateTournamentMutation();
  const [openTournament, { isLoading: opening }] = useOpenTournamentMutation();
  const [loadDeletePreview, { isFetching: loadingDeletePreview }] = useLazyGetTournamentDeletePreviewQuery();
  const [deleteTournament, { isLoading: deleting }] = useDeleteTournamentMutation();
  const [draft, setDraft] = useState<DetailDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState<DetailDraft | null>(null);
  const initializedId = useRef("");
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const programRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [clubsOpen, setClubsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<TournamentDeleteSummary | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [tossQrOpen, setTossQrOpen] = useState(false);
  const [paymentGroupId, setPaymentGroupId] = useState("");
  const { data: participantsData } = useGetTournamentParticipantsAllQuery(id, { skip: !id });
  const tournament = data?.tournament;
  useEffect(() => {
    if (tournament && initializedId.current !== tournament.id) {
      const initial = draftFromTournament(tournament);
      setDraft(initial);
      setSavedDraft(initial);
      initializedId.current = tournament.id;
    }
  }, [tournament]);
  const hasChanges = Boolean(draft && savedDraft && JSON.stringify(draft) !== JSON.stringify(savedDraft));
  const exportProgram = async (print = false) => {
    if (!programRef.current || exporting) return;
    const printWindow = print ? window.open("", "_blank") : null;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(programRef.current, { scale: 2, useCORS: true, backgroundColor: "#fff" });
      const imageUrl = canvas.toDataURL("image/png");
      if (print && printWindow) {
        printWindow.document.title = `${tournament?.title || "대회"} 프로그램`;
        const style = printWindow.document.createElement("style");
        style.textContent = "@page{size:A4 portrait;margin:10mm}body{margin:0}img{display:block;width:100%;height:auto}";
        printWindow.document.head.append(style);
        const image = printWindow.document.createElement("img"); image.onload = () => printWindow.print(); image.src = imageUrl; image.alt = "대회 프로그램"; printWindow.document.body.append(image);
      } else if (!print) {
        const link = document.createElement("a"); link.href = imageUrl; link.download = `프로그램_${tournament?.title || "대회"}.png`; link.click();
      }
    } catch { printWindow?.close(); setError("프로그램 내보내기에 실패했습니다."); }
    finally { setExporting(false); }
  };
  const openDelete = async () => {
    setDeleteOpen(true); setDeleteSummary(null); setDeleteConfirmationText(""); setDeleteError("");
    try { const preview = await loadDeletePreview(id).unwrap(); setDeleteSummary(preview.summary); }
    catch (reason) { setDeleteError((reason as { data?: { message?: string } }).data?.message ?? "삭제 대상을 확인하지 못했습니다."); }
  };
  const confirmDelete = async () => {
    if (!tournament || !deleteSummary || deleteConfirmationText !== "삭제") return;
    try {
      await deleteTournament({ id, confirmation_text: deleteConfirmationText, expected_summary: deleteSummary, confirmation_intent: "DELETE_TOURNAMENT_AND_ALL_DATA" }).unwrap();
      navigate("/league", { replace: true });
    } catch (reason) {
      setDeleteError((reason as { data?: { message?: string } }).data?.message ?? "대회를 삭제하지 못했습니다.");
      setDeleteSummary(null);
    }
  };
  const save = async (openAfterSave = false, automatic = false) => {
    if (!draft || saving || opening || (!hasChanges && !openAfterSave)) return;
    if (!draft.title.trim() || !draft.date || !draft.start) { setError("대회명, 날짜, 시작 시간을 입력해주세요."); return; }
    if (draft.entry_fee && (!Number.isInteger(Number(draft.entry_fee)) || Number(draft.entry_fee) < 0 || Number(draft.entry_fee) > 100000000)) { setError("참가비를 0원 이상 1억원 이하의 정수로 입력해주세요."); return; }
    const start = new Date(`${draft.date}T${draft.start}:00`);
    const end = draft.end ? new Date(`${draft.date}T${draft.end}:00`) : null;
    const deadline = draft.application_deadline_at ? new Date(draft.application_deadline_at) : null;
    if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end < start))) { setError("시간을 확인해주세요."); return; }
    if (deadline && (Number.isNaN(deadline.getTime()) || deadline >= start)) { setError("참가 신청 마감을 대회 시작 전으로 설정해주세요."); return; }
    if (tournament?.status === "draft" && deadline && deadline <= new Date()) { setError("참가 신청 마감은 현재 이후로 설정해주세요."); return; }
    try {
      if (hasChanges) {
        await update({ id, body: { notice: draft.notice.trim() || null, entry_fee: draft.entry_fee ? Number(draft.entry_fee) : null, bank_account: draft.bank_account.trim() || null, title: draft.title.trim(), starts_at: start.toISOString(), ends_at: end?.toISOString() ?? null, application_deadline_at: deadline?.toISOString() ?? null, venue_name: draft.venue_name.trim() || null, court_count: draft.court_count ? Number(draft.court_count) : null, recruit_count: draft.recruit_count ? Number(draft.recruit_count) : null } }).unwrap();
        setSavedDraft(draft);
        setSaveMessage(automatic ? "자동 저장되었습니다." : "저장되었습니다.");
      }
      if (openAfterSave && tournament?.status === "draft") await openTournament(id).unwrap();
      setError("");
    } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "대회 정보 저장 또는 참가 신청 열기에 실패했습니다."); }
  };
  useEffect(() => {
    if (!tournament?.can_manage || !hasChanges || saving || opening) return;
    const timer = window.setTimeout(() => { void save(false, true); }, 4000);
    return () => window.clearTimeout(timer);
  }, [draft, hasChanges, saving, opening, tournament?.can_manage]);
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}><CircularProgress /></Box>;
  if (!tournament) return <Box sx={{ p: 2 }}><Alert severity="error">{(loadError as { data?: { message?: string } })?.data?.message ?? "대회를 불러올 수 없습니다."}</Alert></Box>;
  const field = (name: keyof DetailDraft, type = "text") => <TextField fullWidth size="small" variant="standard" type={type} value={draft?.[name] ?? ""} onChange={(event) => setDraft((current) => current ? ({ ...current, [name]: event.target.value }) : current)} inputProps={type === "number" ? { min: 1 } : undefined} sx={inputSx} />;
  const timeField = (name: "start" | "end") => <Stack direction="row" alignItems="center" spacing={0.5}>
    <Select variant="standard" displayEmpty value={(draft?.[name] ?? "").split(":")[0] ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, [name]: `${event.target.value}:${current[name].split(":")[1] || "00"}` } : current)} sx={selectSx}><MenuItem value="">시</MenuItem>{hours.map((hour) => <MenuItem key={hour} value={hour}>{hour}</MenuItem>)}</Select>
    <Typography sx={labelSx}>:</Typography>
    <Select variant="standard" displayEmpty value={(draft?.[name] ?? "").split(":")[1] ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, [name]: `${current[name].split(":")[0] || "00"}:${event.target.value}` } : current)} sx={selectSx}><MenuItem value="">분</MenuItem>{minutes.map((minute) => <MenuItem key={minute} value={minute}>{minute}</MenuItem>)}</Select>
  </Stack>;
  const canEnterApplication = new Date() < new Date(tournament.starts_at) && (tournament.status === "open" || tournament.can_manage);
  const accountText = tournament.can_manage ? draft?.bank_account ?? "" : tournament.bank_account ?? "";
  const account = parseBankAccount(accountText);
  const payers = new Map<string, string>();
  for (const participant of participantsData?.participants ?? []) payers.set(participant.source_group_id ?? participant.id, participant.source_group_id ? participant.club_name : `${participant.name} (개인)`);
  const paymentParticipants = (participantsData?.participants ?? []).filter((participant) => (participant.source_group_id ?? participant.id) === paymentGroupId);
  const paymentAmount = calculateTournamentFee(paymentParticipants, tournament.divisions ?? [], tournament.entry_fee).amount ?? 0;
  const tossLink = account && paymentAmount > 0 ? createTossTransferLink(account.bankName, account.accountNumber, paymentAmount) : null;
  return <Box sx={{ pb: canEnterApplication ? 11 : 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton onClick={() => navigate("/league")} size="small" sx={{ mr: 0.5 }}><ArrowBackIcon /></IconButton><Typography fontWeight={900} fontSize={18} sx={{ flex: 1 }}>{tournament.title}</Typography><IconButton size="small" aria-label="대회 공유" onClick={async () => { const url = `${window.location.origin}/tournament/${id}`; try { if (navigator.share) await navigator.share({ title: tournament.title, url }); else { await navigator.clipboard.writeText(url); setSaveMessage("대회 링크를 복사했습니다."); } } catch (reason) { if ((reason as Error).name !== "AbortError") setError("대회 링크를 공유하지 못했습니다."); } }}><CurvedShareIcon fontSize="small" /></IconButton></Stack>
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
    <Box sx={{ bgcolor: "#fff", borderRadius: 1, border: "1px solid #E5E7EB", px: 2, py: 1, mb: 2.5 }}>
      <Box sx={rowSx}><Typography sx={labelSx}>대회명</Typography>{tournament.can_manage ? field("title") : <Typography sx={valueSx}>{tournament.title}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>날 짜</Typography>{tournament.can_manage ? field("date", "date") : <Typography sx={valueSx}>{localDate(tournament.starts_at)}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>시 간</Typography>{tournament.can_manage ? <Stack direction="row" spacing={1} alignItems="center">{timeField("start")}<Typography>~</Typography>{timeField("end")}</Stack> : <Typography sx={valueSx}>{localTime(tournament.starts_at)}{tournament.ends_at ? ` ~ ${localTime(tournament.ends_at)}` : ""}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>신청 마감</Typography>{tournament.can_manage ? field("application_deadline_at", "datetime-local") : <Typography sx={valueSx}>{tournament.application_deadline_at ? new Date(tournament.application_deadline_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "미설정"}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>장 소</Typography>{tournament.can_manage ? field("venue_name") : <Typography sx={valueSx}>{tournament.venue_name || "미정"}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>코트 수</Typography>{tournament.can_manage ? field("court_count", "number") : <Typography sx={valueSx}>{tournament.court_count ? `${tournament.court_count}개` : "미정"}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>참가자 수</Typography>{tournament.can_manage ? field("recruit_count", "number") : <Typography sx={valueSx}>{tournament.recruit_count ? `${tournament.recruit_count}명 (전체 부문 합계)` : "미정"}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>주최 클럽</Typography><Typography sx={valueSx}>{tournament.host_group_name ?? ""}</Typography></Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>안내사항</Typography>
        {tournament.can_manage ? <TextField fullWidth multiline variant="standard" size="small" placeholder="등록된 안내사항이 없습니다." value={draft?.notice ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, notice: event.target.value } : current)} sx={{ ...inputSx, "& textarea": { fontSize: 13, fontWeight: 700, p: 0 }, "& .MuiInput-root": { p: 0 } }} /> : <Typography sx={{ ...valueSx, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{tournament.notice || "등록된 안내사항이 없습니다."}</Typography>}
      </Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>참가비</Typography>
        {tournament.can_manage ? <TextField fullWidth variant="standard" size="small" type="number" placeholder="등록된 참가비가 없습니다." inputProps={{ min: 0, max: 100000000, step: 1, "aria-label": "1인 라운드당 참가비 (원)" }} value={draft?.entry_fee ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, entry_fee: event.target.value } : current)} sx={inputSx} /> : <Typography sx={valueSx}>{tournament.entry_fee == null ? "등록된 참가비가 없습니다." : `${tournament.entry_fee.toLocaleString()}원 (1인 · 라운드당)`}</Typography>}
      </Box><Divider />
      <Box sx={{ ...rowSx, alignItems: "start" }}><Typography sx={{ ...labelSx, pt: 0.4 }}>입금 계좌</Typography>
        <Box sx={{ minWidth: 0 }}><Stack direction="row" spacing={0.7} alignItems="center">
          {tournament.can_manage ? <TextField fullWidth variant="standard" size="small" placeholder="등록된 입금 계좌가 없습니다." value={draft?.bank_account ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, bank_account: event.target.value } : current)} sx={inputSx} /> : <Typography sx={{ ...valueSx, flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{accountText || "등록된 입금 계좌가 없습니다."}</Typography>}
          <IconButton size="small" aria-label="계좌번호 복사" disabled={!accountText.trim()} onClick={() => { void navigator.clipboard.writeText(account?.accountNumber || accountText.trim()).catch(() => setError("계좌번호 복사에 실패했습니다.")); }}><ContentCopyOutlinedIcon fontSize="small" /></IconButton>
        </Stack>
        <Button fullWidth variant="contained" disabled={!account || !tournament.entry_fee || !payers.size} onClick={() => setTossQrOpen(true)} startIcon={<Box component="img" src="/images/payment/toss-symbol-mono-white.png" alt="" sx={{ width: 22, height: 22 }} />} sx={{ mt: 1, bgcolor: "#0064FF", fontWeight: 800 }}>토스로 송금</Button>
        </Box>
        <Dialog open={tossQrOpen} onClose={() => setTossQrOpen(false)}><DialogTitle>토스로 송금</DialogTitle><DialogContent sx={{ textAlign: "center" }}><Select fullWidth size="small" displayEmpty value={paymentGroupId} onChange={(event) => setPaymentGroupId(String(event.target.value))} sx={{ mb: 2 }}><MenuItem value="" disabled>입금할 클럽 · 개인 선택</MenuItem>{[...payers].map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</Select>{paymentGroupId && <Typography sx={{ mb: 2 }} fontWeight={800}>입금 예정액 {paymentAmount.toLocaleString()}원</Typography>}{tossLink && (isSmartphoneBrowser() ? <Button fullWidth variant="contained" onClick={() => { window.location.href = tossLink; }}>토스 앱 열기</Button> : <QRCode value={tossLink} size={196} />)}<Typography fontSize={13} sx={{ mt: 1 }}>휴대폰 카메라로 QR코드를 스캔해주세요.</Typography></DialogContent></Dialog>
      </Box><Divider />
      {tournament.can_manage && tournament.status === "draft" && <Stack direction="row" justifyContent="flex-end" sx={{ py: 1 }}><Button size="small" variant="contained" disabled={saving || opening} onClick={() => void save(tournament.status === "draft")}>{tournament.status === "draft" ? hasChanges ? "저장하고 참가신청 열기" : "참가신청 열기" : "저장"}</Button></Stack>}
      <Divider sx={{ borderColor: "#F3F4F6" }} />
      <Stack direction="row" alignItems="center" sx={{ py: 1 }}><Typography sx={{ ...labelSx, flex: 1 }}>프로그램</Typography><Stack direction="row" sx={{ border: "1px solid #E5E7EB", borderRadius: 4 }}><IconButton size="small" aria-label="프로그램 이미지 저장" disabled={exporting} onClick={() => void exportProgram()}><DownloadOutlinedIcon sx={{ fontSize: 17 }} /></IconButton><Divider orientation="vertical" flexItem /><IconButton size="small" aria-label="프로그램 인쇄" disabled={exporting} onClick={() => void exportProgram(true)}><PrintOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Stack></Stack>
      <Box ref={programRef}>
      {(tournament.divisions ?? []).map((division) => <Box key={division.id} sx={{ mb: 1.2 }}>
        <Stack direction="row" alignItems="center" sx={{ mb: 0.7 }}><Typography fontWeight={900} fontSize={14} sx={{ flex: 1 }}>{division.name} <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>신청 {division.applicant_count}명 · 확정 {division.confirmed_count}명</Typography></Typography>{tournament.can_manage && <Button size="small" variant="outlined" onClick={() => navigate(`/tournament/${id}/divisions/${division.id}/program`)} sx={{ minWidth: 44, height: 24, borderRadius: 1, px: 1.25, fontSize: 11, fontWeight: 800 }}>수정</Button>}</Stack>
        <LeagueProgramList embedded resourceKey={tournamentLeagueKey(id ?? "", division.id)} />
      </Box>)}
      </Box>
      <Divider sx={{ borderColor: "#F3F4F6" }} /><Box sx={{ py: 1 }}><Typography sx={labelSx}>이벤트</Typography><Stack spacing={1} sx={{ mt: 1 }}><Button fullWidth variant="outlined" startIcon={<EmojiEventsOutlinedIcon />} onClick={() => navigate(`/tournament/${id}/ranking`)} sx={{ height: 40, fontWeight: 700, color: '#9A4D00', borderColor: '#F59E0B', bgcolor: '#FFF7D6' }}>순위</Button><Button fullWidth variant="outlined" startIcon={<CardGiftcardOutlinedIcon />} onClick={() => navigate(`/tournament/${id}/draw`)} sx={{ height: 40, fontWeight: 700, color: '#7C3AED', borderColor: '#A78BFA', bgcolor: '#F5F3FF' }}>경품 추첨</Button><Button fullWidth variant="outlined" startIcon={<RestaurantOutlinedIcon />} onClick={() => navigate(`/tournament/${id}/after-party`)} sx={{ height: 40, fontWeight: 700, color: '#0F766E', borderColor: '#5EEAD4', bgcolor: '#F0FDFA' }}>뒤풀이 정산</Button></Stack></Box>
      <Divider sx={{ borderColor: "#F3F4F6" }} /><Stack direction="row" alignItems="center" sx={{ py: 0.8 }}><Typography sx={{ ...labelSx, flex: 1 }}>참여 클럽</Typography><Button size="small" variant="outlined" onClick={() => setClubsOpen(true)} sx={{ minWidth: 44, height: 24, borderRadius: 1, px: 1.25, fontSize: 11, fontWeight: 800 }}>보기</Button></Stack>
    </Box>
    <TournamentParticipants tournament={tournament} />
    <Dialog open={clubsOpen} onClose={() => setClubsOpen(false)} fullWidth maxWidth="xs"><DialogTitle sx={{ fontWeight: 900 }}>참여 클럽</DialogTitle><DialogContent>{[...payers].filter(([key]) => (participantsData?.participants ?? []).some((participant) => participant.source_group_id === key)).map(([key, name]) => <Box key={key} sx={{ py: 1, borderBottom: "1px solid #E5E7EB" }}><Typography fontWeight={800}>{name}</Typography>{tournament.divisions?.map((division) => { const count = (participantsData?.participants ?? []).filter((participant) => participant.source_group_id === key && participant.division_id === division.id).length; return count ? <Typography key={division.id} fontSize={13} color="text.secondary">{division.name} · {count}명</Typography> : null; })}</Box>)}{!(participantsData?.participants ?? []).some((participant) => participant.source_group_id) && <Typography color="text.secondary">아직 등록된 참여 클럽이 없습니다.</Typography>}</DialogContent><DialogActions><Button onClick={() => setClubsOpen(false)}>닫기</Button></DialogActions></Dialog>
    {tournament.can_delete && <Box sx={{ mb: 2, pb: canEnterApplication ? 7 : 0 }}><Button color="error" size="small" sx={{ p: 0, minWidth: 0, fontSize: 13, fontWeight: 700 }} onClick={() => void openDelete()}>대회 삭제</Button></Box>}
    <Dialog open={deleteOpen} onClose={() => { if (!deleting) setDeleteOpen(false); }} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 900 }}>대회 삭제</DialogTitle>
      <DialogContent>
        {loadingDeletePreview && <Box sx={{ textAlign: "center", py: 2 }}><CircularProgress size={24} /></Box>}
        {deleteError && <Alert severity="error" sx={{ mb: 1.5 }}>{deleteError}</Alert>}
        {deleteSummary && <>
          <Typography fontSize={14} fontWeight={700}>대회 정보와 안내사항·참가비·입금 계좌를 포함한 연결 데이터를 영구 삭제합니다.</Typography>
          <Typography fontSize={13} sx={{ mt: 1.2, whiteSpace: "pre-line" }}>부문 {deleteSummary.divisions}개 · 라운드 {deleteSummary.rounds}개{"\n"}참가 신청 및 참가자 {deleteSummary.participants}명 · 초대 클럽 {deleteSummary.invited_groups}개{"\n"}조 {deleteSummary.pools}개 · 경기 {deleteSummary.matches}개 (결과 기록 {deleteSummary.recorded_matches}개)</Typography>
          <Typography fontSize={13} sx={{ mt: 1 }}>경품 추첨 {deleteSummary.draws ?? 0}개 · 정산 {deleteSummary.settlements ?? 0}개 · 입금 확인 {deleteSummary.settlement_payments ?? 0}건 · 영수증 {deleteSummary.receipt_scans ?? 0}건</Typography><Typography fontSize={13} color="error" sx={{ mt: 1.2 }}>경품 당첨 결과와 정산·입금 확인을 포함하여 참가자 상태, 조 배정, 경기 점수와 결과도 함께 삭제되며 복구할 수 없습니다.</Typography>
          <TextField fullWidth size="small" label={'삭제하려면 "삭제"를 입력하세요'} value={deleteConfirmationText} onChange={(event) => setDeleteConfirmationText(event.target.value)} sx={{ mt: 2 }} />
        </>}
      </DialogContent>
      <DialogActions><Button onClick={() => setDeleteOpen(false)} disabled={deleting}>취소</Button><Button color="error" variant="contained" disabled={deleting || !deleteSummary || deleteConfirmationText !== "삭제"} onClick={() => void confirmDelete()}>{deleting ? "삭제 중" : "영구 삭제"}</Button></DialogActions>
    </Dialog>
    <Snackbar open={!!saveMessage} autoHideDuration={3000} onClose={() => setSaveMessage("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
      <Alert severity="success" onClose={() => setSaveMessage("")} sx={{ fontWeight: 700 }}>{saveMessage}</Alert>
    </Snackbar>
    {tournament.can_manage && hasChanges && <Button variant="contained" disableElevation disabled={saving || opening} onClick={() => void save(false)} sx={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(124px + env(safe-area-inset-bottom))", zIndex: 21, minWidth: 86, height: 54, px: 2, borderRadius: 999, bgcolor: "#2F80ED", color: "#fff", fontSize: 13, fontWeight: 900, boxShadow: "0 6px 18px rgba(37, 99, 235, 0.3)", border: "2px solid rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#256FD1" }, "&.Mui-disabled": { bgcolor: "#93C5FD", color: "#fff" } }}>{saving ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "저장"}</Button>}
    {canEnterApplication && <Box sx={floatingBoxSx}><Button fullWidth variant="contained" disableElevation onClick={() => navigate(`/tournament/${id}/apply`)} sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}>참가 신청</Button></Box>}
  </Box>;
}
