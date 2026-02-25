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
} from "@mui/material";
import QRCode from "react-qr-code";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import IosShareIcon from "@mui/icons-material/IosShare";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import {
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery,
  useUpdateParticipantMutation,
  useUpdateLeagueMutation,
  useAddParticipantsMutation,
  useDeleteLeagueMutation,
} from "../../features/league/leagueApi";
import { toUTCDate, formatLeagueDate, formatLeagueTime } from "../../utils/dateUtils";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
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

const TYPE_OPTIONS = ["단식", "복식", "2인 단체전", "3인 단체전", "4인 단체전"];
const FORMAT_OPTIONS = ["단일리그", "조별리그", "조별리그 + 본선리그"];
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

  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id ?? "", {
    skip: !id,
  });
  const { data: participantData, isLoading: participantsLoading } = useGetLeagueParticipantsQuery(
    id ?? "",
    { skip: !id, pollingInterval: 15000 },
  );

  const [updateParticipant] = useUpdateParticipantMutation();
  const [updateLeague, { isLoading: saving }] = useUpdateLeagueMutation();
  const [addParticipants] = useAddParticipantsMutation();
  const [deleteLeague] = useDeleteLeagueMutation();

  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(leagueData?.league?.group_id ?? "", {
    skip: !leagueData?.league?.group_id,
  });
  // groupLoading 중엔 판단 보류 (플리커 방지)
  const canManage = !groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin");
  const isMember = !groupLoading && !!groupData?.myRole;

  const league = leagueData?.league;
  const rawParticipants = useMemo(() => participantData?.participants ?? [], [participantData]);

  // 참가자 목록은 항상 부수 오름차순 + 이름 ㄱㄴㄷ 고정
  // (대진 순서는 대진표 생성 시 별도 사용)
  const participants = useMemo(() => {
    return [...rawParticipants].sort((a, b) => {
      const numA = parseInt(a.division ?? "", 10);
      const numB = parseInt(b.division ?? "", 10);
      const aNum = isNaN(numA) ? 9999 : numA;
      const bNum = isNaN(numB) ? 9999 : numB;
      if (aNum !== bNum) return aNum - bNum;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [rawParticipants]);

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
        participants: selected.map((m) => ({ division: m.division, name: m.name })),
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

  const handleStart = () => {
    if (!id) return;
    updateLeague({ id, updates: { status: "active" } });
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
    setIsEditing(true);
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
            {isMember && (
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
              {TYPE_OPTIONS.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>)}
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
              {FORMAT_OPTIONS.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>)}
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
          <Box sx={{ display: "grid", gridTemplateColumns: "56px 1fr 130px", px: 1.5, py: 0.8, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>부수</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>이름</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>상태</Typography>
          </Box>

          {/* 수정 모드: 수기입력 행 (헤더 바로 아래) */}
          {isEditing && (
            <>
              <Box sx={{ display: "grid", gridTemplateColumns: "56px 1fr 130px", gap: 0.8, px: 1.5, py: 0.8, borderBottom: "1px solid #E5E7EB" }}>
                <TextField
                  placeholder="부수"
                  value={inputDivision}
                  onChange={(e) => setInputDivision(e.target.value)}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.6, height: 30, bgcolor: "#fff" }, "& input": { fontSize: 13, py: 0.3 } }}
                />
                <TextField
                  placeholder="이름"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddParticipant(); }}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.6, height: 30, bgcolor: "#fff" }, "& input": { fontSize: 13, py: 0.3 } }}
                />
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleAddParticipant}
                    disabled={!inputName.trim()}
                    sx={{
                      borderRadius: 0.6, height: 30, px: 1.5, fontWeight: 900, fontSize: 12, minWidth: 0,
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
            (isEditing ? participants : filteredParticipants).map((p, idx) => (
              <Box
                key={p.id}
                sx={{ display: "grid", gridTemplateColumns: "56px 1fr 130px", alignItems: "center", px: 1.5, py: 0.9, borderTop: idx === 0 ? "none" : "1px solid #F3F4F6" }}
              >
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <Box sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 22, px: 1, borderRadius: 999, bgcolor: "#E5E7EB", fontSize: 11, fontWeight: 900, color: "#111827", minWidth: 28 }}>
                    {p.division || "-"}
                  </Box>
                </Box>
                <Typography fontWeight={800} fontSize={14} sx={{ textAlign: "center" }}>{p.name}</Typography>
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
                      onClick={() => isMember && handleToggle(p.id, key, value)}
                      sx={{
                        height: 24, px: 0.8, borderRadius: 0.6,
                        border: `1px solid ${value ? on.border : "#D1D5DB"}`,
                        bgcolor: value ? on.bgcolor : "#F9FAFB",
                        color: value ? on.color : "#9CA3AF",
                        fontSize: 11, fontWeight: 700,
                        cursor: isMember ? "pointer" : "default",
                        display: "flex", alignItems: "center", userSelect: "none", whiteSpace: "nowrap",
                        "&:hover": { opacity: isMember ? 0.8 : 1 },
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))
          )}
        </Box>

        {!isEditing && isMember && (
          <Button
            fullWidth variant="outlined" disableElevation
            sx={{ mt: 1.5, borderRadius: 1, height: 40, fontWeight: 700 }}
            onClick={() => navigate(`/draw/${id}`)}
          >
            경품 추첨
          </Button>
        )}
        {!isEditing && canManage && (
          <Button
            fullWidth variant="contained" disableElevation
            sx={{ mt: 1, borderRadius: 1, height: 40, fontWeight: 700, bgcolor: "#87B8FF", "&:hover": { bgcolor: "#79AEFF" } }}
            onClick={() => {/* TODO */}}
          >
            대진표 생성하기
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
            <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => { alert("카카오톡 공유 기능은 준비 중입니다."); }}
                sx={{
                  borderRadius: 1, py: 1.2, fontWeight: 700,
                  borderColor: "#FEE500", color: "#000",
                  "&:hover": { borderColor: "#FEE500", bgcolor: "rgba(254,229,0,0.1)" },
                }}
              >
                카카오톡 공유
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  const link = `${window.location.origin}/league/${id}`;
                  const message = `리그에 초대합니다! ${link}`;
                  window.location.href = `sms:?body=${encodeURIComponent(message)}`;
                }}
                sx={{ borderRadius: 1, py: 1.2, fontWeight: 700 }}
              >
                문자 공유
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={async () => {
                  const link = `${window.location.origin}/league/${id}`;
                  try {
                    await navigator.clipboard.writeText(link);
                    setAlertSeverity("success");
                    setAlertMsg("링크가 복사되었습니다!");
                    setShareDialogOpen(false);
                  } catch {
                    setAlertMsg("링크 복사에 실패했습니다.");
                  }
                }}
                sx={{ borderRadius: 1, py: 1.2, fontWeight: 700 }}
              >
                URL 복사
              </Button>
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

      {/* 뷰 모드 리그 시작 버튼 */}
      {!isEditing && canManage && (
        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={handleStart}
          disabled={league.status === "active"}
          sx={{
            borderRadius: 1,
            height: 40,
            fontWeight: 700,
            fontSize: 14,
            bgcolor: "#2F80ED",
            "&:hover": { bgcolor: "#256FD1" },
            "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" },
          }}
        >
          {league.status === "active" ? "리그 진행 중" : "리그 시작"}
        </Button>
      )}
    </Box>
  );
}
