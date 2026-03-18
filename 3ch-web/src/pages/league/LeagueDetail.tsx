import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Divider,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  InputAdornment,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import QRCode from "react-qr-code";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import IosShareIcon from "@mui/icons-material/IosShare";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery,
  useUpdateParticipantMutation,
  useUpdateLeagueMutation,
  useAddParticipantsMutation,
  useDeleteLeagueMutation,
  useDeleteParticipantMutation,
} from "../../features/league/leagueApi";
import { toUTCDate, formatLeagueDate, formatLeagueTime } from "../../utils/dateUtils";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { useAppSelector } from "../../app/hooks";
import LoadMembersDialog from "./LoadMembersDialog";
import type { MemberRow } from "./LoadMembersDialog";

function parseLocation(description?: string) {
  if (!description) return "-";
  return description.startsWith("장소: ") ? description.slice(4) : description;
}

const infoRowSx = {
  display: "grid",
  gridTemplateColumns: "72px 1fr",
  alignItems: "center",
  py: 0.7,
};

const labelSx = { fontSize: 13, fontWeight: 700, color: "#6B7280" };
const valueSx = { fontSize: 13, fontWeight: 700 };
const selectSx = {
  fontSize: 13,
  fontWeight: 700,
  "&:before": { display: "none" },
  "&:after": { display: "none" },
  "& .MuiSelect-select": { py: 0.2, pl: 0 },
};

const inputSx = {
  "& .MuiInput-underline:before": { display: "none" },
  "& .MuiInput-underline:after": { display: "none" },
  "& input": { fontSize: 13, fontWeight: 700, p: 0 },
};

const TYPE_OPTIONS = [
  { label: "단식", disabled: false },
  { label: "복식", disabled: false },
  { label: "단체전", disabled: true },
  { label: "교류전", disabled: true },
];
const FORMAT_OPTIONS = [
  { label: "단일리그", disabled: false },
  { label: "조별리그", disabled: false },
  { label: "조별리그 + 본선리그", disabled: false },
  { label: "단일리그 + 토너먼트", disabled: true },
  { label: "조별리그 + 토너먼트", disabled: true },
  { label: "상·하위 토너먼트", disabled: true },
];
const RULES_OPTIONS = ["3전 2선승제", "5전 3선승제", "7전 4선승제", "3세트제"];
const SORT_OPTIONS = ["부수", "이름", "랜덤"];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"];
const RECRUIT_OPTIONS = [4, 6, 8, 10, 12, 16, 20, 24, 32];

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editType, setEditType] = useState("");
  const [editFormat, setEditFormat] = useState("");
  const [editRules, setEditRules] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("부수");
  const [editRecruitCount, setEditRecruitCount] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputDivision, setInputDivision] = useState("");
  const [inputName, setInputName] = useState("");
  const [openLoadDialog, setOpenLoadDialog] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"success" | "warning" | "error">("warning");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [cancelJoinConfirm, setCancelJoinConfirm] = useState(false);
  const [guestJoinOpen, setGuestJoinOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestDivision, setGuestDivision] = useState("");
  const [deleteParticipantTarget, setDeleteParticipantTarget] = useState<{ id: string; division: string; name: string } | null>(null);
  const [editingParticipants, setEditingParticipants] = useState<Record<string, { division: string; name: string }>>({});

  const { data: leagueData, isLoading: leagueLoading, refetch: refetchLeague } = useGetLeagueQuery(id ?? "", {
    skip: !id,
  });
  const { data: participantData, isLoading: participantsLoading, refetch: refetchParticipants } = useGetLeagueParticipantsQuery(
    id ?? "",
    { skip: !id, pollingInterval: 15000 },
  );

  const authUser = useAppSelector((state) => state.auth.user);

  const [updateParticipant] = useUpdateParticipantMutation();
  const [updateLeague, { isLoading: saving }] = useUpdateLeagueMutation();
  const [addParticipants] = useAddParticipantsMutation();
  const [deleteLeague] = useDeleteLeagueMutation();
  const [deleteParticipant] = useDeleteParticipantMutation();

  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(leagueData?.league?.group_id ?? "", {
    skip: !leagueData?.league?.group_id,
  });
  // groupLoading 중엔 판단 보류 (플리커 방지)
  const canManage = !groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin");
  const isMember = !groupLoading && !!groupData?.myRole;

  const league = leagueData?.league;

  const isPublicLeague = league?.join_permission === "public";
  const canInteract = isMember || isPublicLeague;

  const myMember = useMemo(
    () => groupData?.members?.find((m) => m.user_id === authUser?.id),
    [groupData, authUser],
  );

  const rawParticipants = participantData?.participants ?? [];

  const handleJoin = async (name?: string, division?: string) => {
    if (!id) return;
    const isFull = league?.recruit_count != null && rawParticipants.length >= league.recruit_count;
    if (isFull) {
      setAlertSeverity("warning");
      setAlertMsg(`모집 인원(${league!.recruit_count}명)이 마감되었습니다.`);
      return;
    }
    const participantName = name ?? myMember?.name ?? "";
    const participantDivision = division ?? myMember?.division ?? "";
    if (!participantName) {
      setAlertSeverity("error");
      setAlertMsg("이름을 입력해주세요.");
      return;
    }
    try {
      await addParticipants({
        leagueId: id,
        participants: [{ division: participantDivision, name: participantName }],
      }).unwrap();
      setAlertSeverity("success");
      setAlertMsg("참가 신청이 완료되었습니다.");
      setGuestJoinOpen(false);
      setGuestName("");
      setGuestDivision("");
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message;
      setAlertSeverity("error");
      setAlertMsg(msg ?? "참가 신청에 실패했습니다.");
    }
  };

  const handleCancelJoin = async () => {
    if (!id) return;
    const myParticipant = rawParticipants.find((p) => p.name === myMember?.name);
    if (!myParticipant) return;
    try {
      await deleteParticipant({ leagueId: id, participantId: myParticipant.id }).unwrap();
      setCancelJoinConfirm(false);
      setAlertSeverity("success");
      setAlertMsg("리그 참가 신청이 취소되었습니다.");
    } catch {
      setCancelJoinConfirm(false);
      setAlertSeverity("error");
      setAlertMsg("취소에 실패했습니다.");
    }
  };

  // 참가자 목록은 항상 부수 오름차순 + 이름 ㄱㄴㄷ 고정
  // (대진 순서는 대진표 생성 시 별도 사용)
  const participants = useMemo(() => {
    return [...(participantData?.participants ?? [])].sort((a, b) => {
      const numA = parseInt(a.division ?? "", 10);
      const numB = parseInt(b.division ?? "", 10);
      const aNum = isNaN(numA) ? 9999 : numA;
      const bNum = isNaN(numB) ? 9999 : numB;
      if (aNum !== bNum) return aNum - bNum;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [participantData?.participants]);

  // 뷰 모드 검색 필터
  const filteredParticipants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.division ?? "").toLowerCase().includes(q)
    );
  }, [participants, searchQuery]);

  const handleAddParticipant = async () => {
    if (!id || !inputName.trim()) return;
    const isFull = league?.recruit_count != null && rawParticipants.length >= league.recruit_count;
    if (isFull) {
      setAlertSeverity("warning");
      setAlertMsg(`모집 인원(${league!.recruit_count}명)을 초과할 수 없습니다.`);
      return;
    }
    try {
      await addParticipants({
        leagueId: id,
        participants: [{ division: inputDivision.trim(), name: inputName.trim() }],
      }).unwrap();
      setInputDivision("");
      setInputName("");
    } catch {
      setAlertSeverity("error");
      setAlertMsg("참가자 추가에 실패했습니다.");
    }
  };

  const handleLoadMembers = async (selected: MemberRow[]) => {
    if (!id || selected.length === 0) return;
    const remaining = league?.recruit_count != null
      ? league.recruit_count - rawParticipants.length
      : Infinity;
    if (selected.length > remaining) {
      setAlertSeverity("warning");
      setAlertMsg(`모집 인원(${league!.recruit_count}명)을 초과합니다. 최대 ${remaining}명 추가 가능합니다.`);
      return;
    }
    try {
      await addParticipants({
        leagueId: id,
        participants: selected.map((m) => ({ division: m.division, name: m.name, member_id: m.member_id })),
      }).unwrap();
    } catch {
      setAlertSeverity("error");
      setAlertMsg("불러오기에 실패했습니다.");
    }
    setOpenLoadDialog(false);
  };

  const handleToggle = (
    participantId: string,
    field: "paid" | "arrived" | "after",
    current: boolean,
  ) => {
    if (!id) return;
    updateParticipant({
      leagueId: id,
      participantId,
      updates: { [field]: !current },
    });
  };

  const handleStart = async () => {
    if (!id) return;
    if (league?.status !== "active") {
      await updateLeague({ id, updates: { status: "active" } });
    }
    navigate(`/league/${id}/matches`);
  };

  const handleEnterEdit = () => {
    if (!league) return;
    const d = toUTCDate(league.start_date);
    setEditDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    const rawMin = d.getMinutes();
    const snappedMin = String(Math.round(rawMin / 10) * 10 % 60).padStart(2, "0");
    setEditTime(`${String(d.getHours()).padStart(2, "0")}:${snappedMin}`);
    setEditLocation(parseLocation(league.description));
    setEditType(league.type ?? "단식");
    setEditFormat(league.format ?? "");
    setEditRules(league.rules ?? "");
    setNotice(league.notice ?? "");
    setEditSortOrder(league.sort_order ?? "부수");
    setEditRecruitCount(league.recruit_count ?? 20);
    const editMap: Record<string, { division: string; name: string }> = {};
    participants.forEach((p) => { editMap[p.id] = { division: p.division ?? "", name: p.name }; });
    setEditingParticipants(editMap);
    setIsEditing(true);
  };

  const handleParticipantFieldBlur = (participantId: string, field: "division" | "name", originalValue: string) => {
    if (!id) return;
    const current = (editingParticipants[participantId]?.[field] ?? "").trim();
    if (current === originalValue.trim()) return;
    updateParticipant({ leagueId: id, participantId, updates: { [field]: current } });
  };

  const handleDeleteParticipant = async () => {
    if (!id || !deleteParticipantTarget) return;
    try {
      await deleteParticipant({ leagueId: id, participantId: deleteParticipantTarget.id }).unwrap();
      setDeleteParticipantTarget(null);
    } catch {
      setAlertSeverity("error");
      setAlertMsg("참가자 삭제에 실패했습니다.");
      setDeleteParticipantTarget(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    try {
      const start_date = new Date(`${editDate}T${editTime}:00`).toISOString();
      await updateLeague({
        id,
        updates: {
          start_date,
          description: editLocation ? `장소: ${editLocation}` : "",
          type: editType,
          format: editFormat || undefined,
          rules: editRules || undefined,
          notice: notice || undefined,
          sort_order: editSortOrder,
          recruit_count: editRecruitCount,
        },
      }).unwrap();
      setIsEditing(false);
      setAlertSeverity("success");
      setAlertMsg("수정되었습니다.");
    } catch {
      setAlertSeverity("error");
      setAlertMsg("수정에 실패했습니다.");
    }
  };

  if (leagueLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!league) {
    return (
      <Box sx={{ pt: 4, textAlign: "center" }}>
        <Typography fontWeight={700} color="text.secondary">
          리그 정보를 불러올 수 없습니다.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={() => isEditing ? setIsEditing(false) : navigate(-1)} size="small" sx={{ mr: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography fontWeight={900} fontSize={18} sx={{ flex: 1 }}>
          {isEditing ? "리그 수정" : "리그 상세"}
        </Typography>
        {!isEditing && (
          <>
            {canManage && (
              <IconButton size="small" onClick={handleEnterEdit}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            )}
            {canInteract && (
              <IconButton size="small" onClick={() => setShareDialogOpen(true)}>
                <IosShareIcon fontSize="small" />
              </IconButton>
            )}
          </>
        )}
      </Stack>

      {/* 리그 정보 */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: 1,
          border: "1px solid #E5E7EB",
          px: 2,
          py: 1,
          mb: 2.5,
        }}
      >
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>날 짜</Typography>
          {isEditing ? (
            <TextField type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
              size="small" variant="standard"
              sx={{ ...inputSx, "& input::-webkit-calendar-picker-indicator": { display: "none" } }}
              slotProps={{ input: { endAdornment: (
                <InputAdornment position="end">
                  <CalendarTodayIcon sx={{ fontSize: 14, color: "#9CA3AF" }} />
                </InputAdornment>
              )}}} />
          ) : (
            <Typography sx={valueSx}>{formatLeagueDate(league.start_date)}</Typography>
          )}
        </Box>
        <Divider sx={{ borderColor: "#F3F4F6" }} />
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>시 간</Typography>
          {isEditing ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Select
                value={editTime.split(":")[0] || ""}
                onChange={(e) => setEditTime(`${e.target.value}:${editTime.split(":")[1] || "00"}`)}
                variant="standard" sx={selectSx}
              >
                {HOUR_OPTIONS.map((h) => <MenuItem key={h} value={h} sx={{ fontSize: 13 }}>{h}</MenuItem>)}
              </Select>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>:</Typography>
              <Select
                value={editTime.split(":")[1] || ""}
                onChange={(e) => setEditTime(`${editTime.split(":")[0] || "00"}:${e.target.value}`)}
                variant="standard" sx={selectSx}
              >
                {MINUTE_OPTIONS.map((m) => <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{m}</MenuItem>)}
              </Select>
            </Box>
          ) : (
            <Typography sx={valueSx}>{formatLeagueTime(league.start_date)}</Typography>
          )}
        </Box>
        <Divider sx={{ borderColor: "#F3F4F6" }} />
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>장 소</Typography>
          {isEditing ? (
            <TextField value={editLocation} onChange={(e) => setEditLocation(e.target.value)}
              size="small" variant="standard" fullWidth sx={inputSx} />
          ) : (
            <Typography sx={valueSx}>{parseLocation(league.description)}</Typography>
          )}
        </Box>
        <Divider sx={{ borderColor: "#F3F4F6" }} />
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>유 형</Typography>
          {isEditing ? (
            <Select value={editType} onChange={(e) => setEditType(e.target.value)}
              variant="standard" sx={selectSx}>
              {TYPE_OPTIONS.map((o) => <MenuItem key={o.label} value={o.label} disabled={o.disabled} sx={{ fontSize: 13 }}>{o.label}{o.disabled ? " (준비중)" : ""}</MenuItem>)}
            </Select>
          ) : (
            <Typography sx={valueSx}>{league.type}</Typography>
          )}
        </Box>
        <Divider sx={{ borderColor: "#F3F4F6" }} />
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>방 식</Typography>
          {isEditing ? (
            <Select value={editFormat} onChange={(e) => setEditFormat(e.target.value)}
              variant="standard" displayEmpty sx={selectSx}>
              <MenuItem value="" sx={{ fontSize: 13, color: "#9CA3AF" }}>없음</MenuItem>
              {FORMAT_OPTIONS.map((o) => <MenuItem key={o.label} value={o.label} disabled={o.disabled} sx={{ fontSize: 13 }}>{o.label}{o.disabled ? " (준비중)" : ""}</MenuItem>)}
            </Select>
          ) : (
            <Typography sx={valueSx}>{league.format || "-"}</Typography>
          )}
        </Box>
        <Divider sx={{ borderColor: "#F3F4F6" }} />
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>규 칙</Typography>
          {isEditing ? (
            <Select value={editRules} onChange={(e) => setEditRules(e.target.value)}
              variant="standard" displayEmpty sx={selectSx}>
              <MenuItem value="" sx={{ fontSize: 13, color: "#9CA3AF" }}>없음</MenuItem>
              {RULES_OPTIONS.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>)}
            </Select>
          ) : (
            <Typography sx={valueSx}>{league.rules || "-"}</Typography>
          )}
        </Box>
        <Divider sx={{ borderColor: "#F3F4F6" }} />
        <Box sx={infoRowSx}>
          <Typography sx={labelSx}>대진 순서</Typography>
          {isEditing ? (
            <Select value={editSortOrder} onChange={(e) => setEditSortOrder(e.target.value)}
              variant="standard" sx={selectSx}>
              {SORT_OPTIONS.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>)}
            </Select>
          ) : (
            <Typography sx={valueSx}>{league.sort_order ?? "부수"}</Typography>
          )}
        </Box>
      </Box>

      {/* 참가자 */}
      <Box sx={{ mb: 2.5 }}>
        {/* 참가자 헤더 */}
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.3} sx={{ flex: 1 }}>
            <Typography fontWeight={900} fontSize={16}>참가자</Typography>
            <Typography fontSize={13} fontWeight={700} color="text.secondary">
              ( {participants.length} /
            </Typography>
            {isEditing ? (
              <Select
                value={editRecruitCount}
                onChange={(e) => setEditRecruitCount(Number(e.target.value))}
                variant="standard"
                sx={{
                  fontSize: 13, fontWeight: 700,
                  "&:before": { display: "none" }, "&:after": { display: "none" },
                  "& .MuiSelect-select": { py: 0, pl: 0.3, pr: "20px !important", color: "#6B7280" },
                  "& .MuiSvgIcon-root": { fontSize: 16, color: "#6B7280" },
                }}
              >
                {RECRUIT_OPTIONS.map((n) => (
                  <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}명</MenuItem>
                ))}
              </Select>
            ) : (
              <Typography fontSize={13} fontWeight={700} color="text.secondary">
                {league.recruit_count ?? "-"}명
              </Typography>
            )}
            <Typography fontSize={13} fontWeight={700} color="text.secondary">)</Typography>
          </Stack>
          {isEditing && (
            <Button
              variant="contained"
              disableElevation
              size="small"
              onClick={() => setOpenLoadDialog(true)}
              sx={{ borderRadius: 1, height: 28, px: 1.5, fontWeight: 900, fontSize: 12, bgcolor: "#87B8FF", "&:hover": { bgcolor: "#79AEFF" } }}
            >
              불러오기
            </Button>
          )}
        </Stack>

        {/* 뷰 모드: 검색 */}
        {!isEditing && (
          <TextField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름 또는 부수 검색"
            size="small"
            fullWidth
            sx={{ mb: 1, "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: "#fff", height: 34 }, "& input": { fontSize: 13 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: "#9CA3AF" }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}

        <Box sx={{ bgcolor: "#fff", borderRadius: 1, border: "1px solid #E5E7EB", overflow: "hidden" }}>
          {/* 테이블 헤더 */}
          <Box sx={{ display: "grid", gridTemplateColumns: isEditing ? "64px 1fr 40px 56px" : "56px 1fr 130px", px: 1.5, py: 0.8, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>부수</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>이름</Typography>
            {isEditing && <Box />}
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>상태</Typography>
          </Box>

          {/* 수정 모드: 수기입력 행 (헤더 바로 아래) */}
          {isEditing && (
            <>
              <Box sx={{ display: "grid", gridTemplateColumns: "64px 1fr 40px 56px", gap: 0.8, px: 1.5, py: 0.8, borderBottom: "1px solid #E5E7EB" }}>
                <TextField
                  placeholder="부수"
                  value={inputDivision}
                  onChange={(e) => setInputDivision(e.target.value)}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.6, height: 30, bgcolor: "#fff" }, "& input": { fontSize: 12, py: 0.3, textAlign: "center" } }}
                />
                <TextField
                  placeholder="이름"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddParticipant(); }}
                  size="small"
                  sx={{ mx: 0.5, "& .MuiOutlinedInput-root": { borderRadius: 0.6, height: 30, bgcolor: "#fff" }, "& input": { fontSize: 13, py: 0.3 } }}
                />
                <Box />
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleAddParticipant}
                    disabled={!inputName.trim()}
                    sx={{
                      borderRadius: 0.6, height: 30, px: 1, fontWeight: 900, fontSize: 12, minWidth: 0, width: "100%",
                      bgcolor: "#BDBDBD", "&:hover": { bgcolor: "#BDBDBD" },
                      "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#fff" },
                    }}
                  >
                    추가
                  </Button>
                </Box>
              </Box>
            </>
          )}

          {participantsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (isEditing ? participants : filteredParticipants).length === 0 ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <Typography fontSize={13} fontWeight={700} color="text.secondary">
                {!isEditing && searchQuery ? "검색 결과가 없습니다." : "참가자가 없습니다."}
              </Typography>
            </Box>
          ) : (
            (isEditing ? participants : filteredParticipants).map((p, idx) => {
              const isMe = !isEditing && p.name === myMember?.name;
              const isManual = p.member_id == null;
              const editDiv = editingParticipants[p.id]?.division ?? p.division ?? "";
              const editName = editingParticipants[p.id]?.name ?? p.name;
              return (
              <Box
                key={p.id}
                sx={{ display: "grid", gridTemplateColumns: isEditing ? "64px 1fr 40px 56px" : "56px 1fr 130px", alignItems: "center", px: 1.5, py: 0.9, borderTop: idx === 0 ? "none" : "1px solid #F3F4F6", bgcolor: isMe ? "#EFF6FF" : "transparent" }}
              >
                {/* 부수 */}
                {isEditing ? (
                  <TextField
                    value={editDiv}
                    onChange={(e) => setEditingParticipants((prev) => ({ ...prev, [p.id]: { ...prev[p.id] ?? { division: p.division ?? "", name: p.name }, division: e.target.value } }))}
                    onBlur={() => handleParticipantFieldBlur(p.id, "division", p.division ?? "")}
                    size="small" placeholder="부수"
                    disabled={!isManual}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.6, height: 30, bgcolor: "#fff" }, "& input": { fontSize: 12, py: 0.3, px: 0.8, textAlign: "center" } }}
                  />
                ) : (
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: "#FAAA47", color: "#000000", fontSize: 11, fontWeight: 900 }}>
                      {p.division || "-"}
                    </Avatar>
                  </Box>
                )}

                {/* 이름 */}
                {isEditing ? (
                  <TextField
                    value={editName}
                    onChange={(e) => setEditingParticipants((prev) => ({ ...prev, [p.id]: { ...prev[p.id] ?? { division: p.division ?? "", name: p.name }, name: e.target.value } }))}
                    onBlur={() => handleParticipantFieldBlur(p.id, "name", p.name)}
                    size="small"
                    disabled={!isManual}
                    sx={{ mx: 0.5, "& .MuiOutlinedInput-root": { borderRadius: 0.6, height: 30, bgcolor: "#fff" }, "& input": { fontSize: 13, py: 0.3 } }}
                  />
                ) : (
                  <Typography fontWeight={800} fontSize={14} sx={{ textAlign: "center", color: isMe ? "#2F80ED" : "inherit" }}>{p.name}</Typography>
                )}

                {/* 구분 배지 */}
                {isEditing && (
                  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <Box sx={{
                      px: 0.6, py: 0.3, borderRadius: 0.5, fontSize: 10, fontWeight: 700, lineHeight: 1, userSelect: "none",
                      ...(isManual
                        ? { bgcolor: "#F3F4F6", color: "#6B7280", border: "1px solid #D1D5DB" }
                        : { bgcolor: "#EFF6FF", color: "#1D6FBF", border: "1px solid #BFDBFE" }),
                    }}>
                      {isManual ? "수동" : "클럽"}
                    </Box>
                  </Box>
                )}

                {/* 상태 / 삭제 */}
                {isEditing ? (
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Button
                      size="small" variant="outlined" color="error"
                      onClick={() => setDeleteParticipantTarget({ id: p.id, division: p.division ?? "", name: p.name })}
                      sx={{ height: 28, minWidth: 0, px: 1, fontSize: 12, fontWeight: 700, borderRadius: 0.6 }}
                    >
                      삭제
                    </Button>
                  </Box>
                ) : (
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    {(
                      [
                        { key: "paid",    label: "입금",   value: p.paid,    on: { border: "#27AE60", bgcolor: "#ECFDF5", color: "#16A34A" } },
                        { key: "arrived", label: "도착",   value: p.arrived, on: { border: "#2F80ED", bgcolor: "#EFF6FF", color: "#1D6FBF" } },
                        { key: "after",   label: "뒷풀이", value: p.after,   on: { border: "#9C27B0", bgcolor: "#F3E5F5", color: "#7B1FA2" } },
                      ] as const
                    ).map(({ key, label, value, on }) => (
                      <Box
                        key={key}
                        onClick={() => canInteract && handleToggle(p.id, key, value)}
                        sx={{
                          height: 24, px: 0.8, borderRadius: 0.6,
                          border: `1px solid ${value ? on.border : "#D1D5DB"}`,
                          bgcolor: value ? on.bgcolor : "#F9FAFB",
                          color: value ? on.color : "#9CA3AF",
                          fontSize: 11, fontWeight: 700,
                          cursor: canInteract ? "pointer" : "default",
                          display: "flex", alignItems: "center", userSelect: "none", whiteSpace: "nowrap",
                          "&:hover": { opacity: canInteract ? 0.8 : 1 },
                        }}
                      >
                        {label}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            )})
          )}
        </Box>

        {!isEditing && canInteract && (
          <Button
            fullWidth variant="outlined" disableElevation
            sx={{ mt: 1.5, borderRadius: 1, height: 40, fontWeight: 700 }}
            onClick={() => navigate(`/draw/${id}`)}
          >
            경품 추첨
          </Button>
        )}
        {((!isEditing && league.status === "active") || !isEditing && canManage) && (
          <Button
            fullWidth variant="contained" disableElevation
            sx={{ mt: 1, borderRadius: 1, height: 40, fontWeight: 700, bgcolor: "#87B8FF", "&:hover": { bgcolor: "#79AEFF" } }}
            onClick={() => { navigate(`/league/${id}/bracket`) }}
          >
            {canManage && league.format && league.status === "draft" ? `${league.format} 대진표 생성` : ""}
            {canManage && league.format && league.status === "active" ? `${league.format} 대진표 보기` : ""}
            {!canManage && league.format ? `${league.format} 대진표 보기` : ""}
          </Button>
        )}
      </Box>

      <LoadMembersDialog
        open={openLoadDialog}
        onClose={() => setOpenLoadDialog(false)}
        onConfirm={handleLoadMembers}
        groupId={league.group_id}
      />

      {/* 리그 공유 다이얼로그 */}
      <Dialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 1, mx: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>리그 공유</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1, alignItems: "center" }}>
            {canManage && (
              <Box sx={{ width: "100%" }}>
                <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ mb: 0.8 }}>
                  참가 권한
                </Typography>
                <ToggleButtonGroup
                  value={league?.join_permission ?? "public"}
                  exclusive
                  onChange={(_e, val) => {
                    if (val && id) updateLeague({ id, updates: { join_permission: val } });
                  }}
                  size="small"
                  fullWidth
                  sx={{ "& .MuiToggleButton-root": { fontWeight: 700, fontSize: 13, py: 0.8 } }}
                >
                  <ToggleButton value="public">아무나</ToggleButton>
                  <ToggleButton value="club_only">클럽 회원만</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
            <Box sx={{ p: 2, bgcolor: "#fff", borderRadius: 1, border: "1px solid #E0E0E0" }}>
              <QRCode
                value={`${window.location.origin}/league/${id}`}
                size={200}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </Box>
            <Box sx={{ width: "100%" }}>
              <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ mb: 0.5 }}>
                공유 링크
              </Typography>
              <TextField
                value={`${window.location.origin}/league/${id}`}
                fullWidth
                size="small"
                slotProps={{ input: { readOnly: true } }}
                sx={{ "& .MuiInputBase-input": { fontSize: 13 } }}
              />
            </Box>
            <Stack direction="row" justifyContent="space-around" sx={{ width: "100%", pt: 0.5 }}>
              {/* 카카오톡 */}
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.8 }}>
                <IconButton
                  onClick={() => {
                    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
                    const link = `${appUrl}/league/${id}`;
                    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
                    if (window.Kakao && kakaoKey && !window.Kakao.isInitialized()) {
                      window.Kakao.init(kakaoKey);
                    }
                    if (window.Kakao?.Share) {
                      window.Kakao.Share.sendDefault({
                        objectType: "feed",
                        content: {
                          title: league?.name ?? "리그",
                          description: "리그에 참가해보세요!",
                          imageUrl: `${appUrl}/og-image.png`,
                          link: { mobileWebUrl: link, webUrl: link },
                        },
                        buttons: [{ title: "리그 보기", link: { mobileWebUrl: link, webUrl: link } }],
                      });
                    } else {
                      navigator.clipboard?.writeText(link);
                      alert("링크가 복사되었습니다.");
                    }
                  }}
                  sx={{ width: 56, height: 56, bgcolor: "#FEE500", "&:hover": { bgcolor: "#E6CE00" } }}
                >
                  <Typography fontWeight={900} fontSize={20} lineHeight={1}>K</Typography>
                </IconButton>
                <Typography fontSize={11} fontWeight={700} color="text.secondary">카카오톡</Typography>
              </Box>

              {/* 문자 */}
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.8 }}>
                <IconButton
                  onClick={() => {
                    const link = `${window.location.origin}/league/${id}`;
                    const message = `리그에 초대합니다! ${link}`;
                    window.location.href = `sms:?body=${encodeURIComponent(message)}`;
                  }}
                  sx={{ width: 56, height: 56, bgcolor: "#4CAF50", color: "#fff", "&:hover": { bgcolor: "#43A047" } }}
                >
                  <SmsOutlinedIcon />
                </IconButton>
                <Typography fontSize={11} fontWeight={700} color="text.secondary">문자</Typography>
              </Box>

              {/* 링크 복사 */}
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.8 }}>
                <IconButton
                  onClick={async () => {
                    const link = `${window.location.origin}/league/${id}`;
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(link);
                      } else {
                        const el = document.createElement("textarea");
                        el.value = link;
                        el.style.position = "fixed";
                        el.style.opacity = "0";
                        document.body.appendChild(el);
                        el.focus();
                        el.select();
                        document.execCommand("copy");
                        document.body.removeChild(el);
                      }
                      setAlertSeverity("success");
                      setAlertMsg("링크가 복사되었습니다!");
                      setShareDialogOpen(false);
                    } catch {
                      setAlertMsg("링크 복사에 실패했습니다.");
                    }
                  }}
                  sx={{ width: 56, height: 56, bgcolor: "#E5E7EB", color: "#374151", "&:hover": { bgcolor: "#D1D5DB" } }}
                >
                  <ContentCopyOutlinedIcon />
                </IconButton>
                <Typography fontSize={11} fontWeight={700} color="text.secondary">링크 복사</Typography>
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setShareDialogOpen(false)}
            variant="contained"
            disableElevation
            sx={{ borderRadius: 1, px: 3, fontWeight: 700 }}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 참가자 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteParticipantTarget} onClose={() => setDeleteParticipantTarget(null)}>
        <DialogTitle sx={{ fontWeight: 900, fontSize: 17 }}>참가자 삭제</DialogTitle>
        <DialogContent>
          <Typography fontWeight={700}>
            {deleteParticipantTarget?.division ? `(${deleteParticipantTarget.division}) ` : ""}
            {deleteParticipantTarget?.name} 님을 참가자 명단에서 삭제하겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteParticipantTarget(null)} sx={{ fontWeight: 700 }}>취소</Button>
          <Button variant="contained" color="error" disableElevation sx={{ fontWeight: 700 }} onClick={handleDeleteParticipant}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* 참가신청 취소 확인 다이얼로그 */}
      <Dialog open={cancelJoinConfirm} onClose={() => setCancelJoinConfirm(false)}>
        <DialogTitle sx={{ fontWeight: 900, fontSize: 17 }}>참가신청 취소</DialogTitle>
        <DialogContent>
          <Typography fontWeight={700}>리그 참가 신청을 취소하겠습니까?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setCancelJoinConfirm(false)} sx={{ fontWeight: 700 }}>아니오</Button>
          <Button variant="contained" color="error" disableElevation sx={{ fontWeight: 700 }} onClick={handleCancelJoin}>
            취소하기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 리그 삭제 확인 다이얼로그 */}
      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}>
        <DialogTitle sx={{ fontWeight: 900, fontSize: 17 }}>리그 삭제</DialogTitle>
        <DialogContent>
          <Typography fontWeight={700}>
            <b>{league?.name}</b> 리그를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            삭제된 리그는 복구할 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(false)} sx={{ fontWeight: 700 }}>취소</Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            sx={{ fontWeight: 700 }}
            onClick={async () => {
              if (!id) return;
              setDeleteConfirm(false);
              try {
                await deleteLeague({ leagueId: id }).unwrap();
                navigate(-1);
              } catch {
                setAlertSeverity("error");
                setAlertMsg("리그 삭제에 실패했습니다.");
              }
            }}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 비회원 참가 신청 다이얼로그 */}
      <Dialog
        open={guestJoinOpen}
        onClose={() => { setGuestJoinOpen(false); setGuestName(""); setGuestDivision(""); }}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 1, mx: 2, overflow: "hidden" } } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>참가 신청</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="부수"
              value={guestDivision}
              onChange={(e) => setGuestDivision(e.target.value)}
              fullWidth
              size="small"
              placeholder="예: 3부"
            />
            <TextField
              label="이름"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              fullWidth
              size="small"
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button
            onClick={() => { setGuestJoinOpen(false); setGuestName(""); setGuestDivision(""); }}
            variant="outlined"
            disableElevation
            sx={{ borderRadius: 1, fontWeight: 700 }}
          >
            취소
          </Button>
          <Button
            onClick={() => handleJoin(guestName.trim(), guestDivision.trim())}
            variant="contained"
            disableElevation
            disabled={!guestName.trim()}
            sx={{ borderRadius: 1, fontWeight: 700 }}
          >
            신청
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!alertMsg}
        autoHideDuration={3000}
        onClose={() => setAlertMsg("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={alertSeverity} onClose={() => setAlertMsg("")} sx={{ fontWeight: 700 }}>
          {alertMsg}
        </Alert>
      </Snackbar>

      {/* 안내사항 */}
      <Box sx={{ mb: 2.5 }}>
        <Typography fontWeight={900} fontSize={16} sx={{ mb: 1 }}>
          안내사항
        </Typography>
        {isEditing ? (
          <TextField
            multiline
            rows={3}
            fullWidth
            placeholder="내용을 입력해주세요"
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1,
                bgcolor: "#fff",
                fontSize: 13,
              },
            }}
          />
        ) : (
          <Box
            sx={{
              bgcolor: "#fff",
              borderRadius: 1,
              border: "1px solid #E5E7EB",
              px: 1.75,
              py: 1.5,
              minHeight: 72,
            }}
          >
            <Typography fontSize={13} fontWeight={600} color={league.notice ? "#111827" : "#9CA3AF"}>
              {league.notice || "안내사항이 없습니다."}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 수정 모드 리그 삭제 버튼 */}
      {isEditing && (
        <Box sx={{ mb: 1 }}>
          <Button
            size="small"
            sx={{ color: "error.main", p: 0, fontWeight: 700, minWidth: 0, fontSize: 13 }}
            onClick={() => setDeleteConfirm(true)}
          >
            리그 삭제
          </Button>
        </Box>
      )}

      {/* 수정 모드 플로팅 저장 버튼 */}
      {isEditing && (
        <Box
          sx={{
            position: "fixed",
            bottom: "calc(56px + env(safe-area-inset-bottom))",
            left: 0,
            right: 0,
            px: 2,
            pb: 1,
            zIndex: 10,
          }}
        >
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={handleSaveEdit}
            disabled={saving}
            sx={{
              borderRadius: 1,
              height: 44,
              fontWeight: 700,
              fontSize: 15,
              bgcolor: "#2F80ED",
              "&:hover": { bgcolor: "#256FD1" },
              "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" },
            }}
          >
            수정
          </Button>
        </Box>
      )}

      {/* 새로고침 플로팅 버튼 */}
      {!isEditing && (
        <IconButton
          onClick={() => { refetchLeague(); refetchParticipants(); }}
          sx={{
            position: "fixed",
            bottom: "calc(56px + env(safe-area-inset-bottom) + 16px)",
            right: 16,
            zIndex: 10,
            bgcolor: "#fff",
            border: "1px solid #E5E7EB",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            "&:hover": { bgcolor: "#F9FAFB" },
          }}
        >
          <RefreshIcon sx={{ fontSize: 22, color: "#6B7280" }} />
        </IconButton>
      )}

      {/* 뷰 모드 리그 시작 버튼 (관리자) */}
      {!isEditing && canManage && (
        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={handleStart}
          sx={{
            borderRadius: 1,
            height: 40,
            fontWeight: 700,
            fontSize: 14,
            bgcolor: "#2F80ED",
            "&:hover": { bgcolor: "#256FD1" },
          }}
        >
          {league.status === "active" ? "리그 진행 중" : "리그 시작"}
        </Button>
      )}

      {/* 비회원 + club_only: 차단 메시지 */}
      {!isEditing && !canManage && !isMember && league?.join_permission === "club_only" && (
        <Button
          fullWidth variant="contained" disableElevation disabled
          sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#E5E7EB", color: "#9CA3AF", "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF" } }}
        >
          클럽 회원만 참가 가능
        </Button>
      )}

      {/* 비회원 + public: 참가 신청 가능 */}
      {!isEditing && !canManage && !isMember && league?.join_permission === "public" && (() => {
        const myEntry = rawParticipants.find((p) => p.name === authUser?.name);
        if (league.status === "active") {
          if (!myEntry) return null;
          return (
            <Button fullWidth variant="contained" disableElevation
              sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
              onClick={() => navigate(`/league/${id}/matches`)}
            >
              리그 진행 중
            </Button>
          );
        }
        if (myEntry) {
          return (
            <Button fullWidth variant="contained" disableElevation disabled
              sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#E5E7EB", color: "#9CA3AF", "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF" } }}
            >
              리그 대기중
            </Button>
          );
        }
        const isFull = league?.recruit_count != null && rawParticipants.length >= league.recruit_count;
        return (
          <Button fullWidth variant="contained" disableElevation disabled={isFull}
            sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
            onClick={() => setGuestJoinOpen(true)}
          >
            {isFull ? `마감 (${league!.recruit_count}/${league!.recruit_count}명)` : "참가 신청"}
          </Button>
        );
      })()}

      {/* 참가자(클럽 회원)용 버튼 */}
      {!isEditing && !canManage && isMember && (() => {
        const myParticipant = rawParticipants.find((p) => p.name === myMember?.name);
        if (league.status === "active") {
          if (!myParticipant) return null;
          return (
            <Button
              fullWidth variant="contained" disableElevation
              sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
              onClick={() => navigate(`/league/${id}/matches`)}
            >
              리그 진행 중
            </Button>
          );
        }
        if (myParticipant) {
          return (
            <Stack spacing={1}>
              <Button
                fullWidth variant="contained" disableElevation disabled
                sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#E5E7EB", color: "#9CA3AF", "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF" } }}
              >
                리그 대기중
              </Button>
              <Button
                fullWidth variant="outlined" disableElevation
                sx={{ borderRadius: 1, height: 36, fontWeight: 700, fontSize: 13, color: "#EF4444", borderColor: "#FCA5A5", "&:hover": { borderColor: "#EF4444", bgcolor: "#FEF2F2" } }}
                onClick={() => setCancelJoinConfirm(true)}
              >
                참가신청 취소
              </Button>
            </Stack>
          );
        }
        const isFull = league?.recruit_count != null && rawParticipants.length >= league.recruit_count;
        return (
          <Button
            fullWidth variant="contained" disableElevation disabled={isFull}
            sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
            onClick={() => handleJoin()}
          >
            {isFull ? `마감 (${league!.recruit_count}/${league!.recruit_count}명)` : "참가 신청"}
          </Button>
        );
      })()}
    </Box>
  );
}
