  import { useMemo, useState } from "react";
  import { useNavigate, useParams } from "react-router-dom";
  import { useEffect } from "react";
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
  // import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
  import IosShareIcon from "@mui/icons-material/IosShare";
  import SearchIcon from "@mui/icons-material/Search";
  import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
  import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
  import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
  import RefreshIcon from "@mui/icons-material/Refresh";
  import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
  import LanguageIcon from "@mui/icons-material/Language";
  import {
    useGetLeagueQuery,
    useGetLeagueProgramQuery,
    useGetLeagueParticipantsQuery,
    useUpdateParticipantMutation,
    useUpdateLeagueMutation,
    useAddParticipantsMutation,
    useDeleteLeagueMutation,
    useDeleteParticipantMutation,
    useReplaceParticipantMutation,
    useGetLeagueMatchesQuery,
  } from "../../features/league/leagueApi";
  import { toUTCDate, formatLeagueDate, formatLeagueTime } from "../../utils/dateUtils";
  import { useGetGroupDetailQuery } from "../../features/group/groupApi";
  import { useAppSelector } from "../../app/hooks";
  import LoadMembersDialog from "./LoadMembersDialog";
  import type { MemberRow } from "./LoadMembersDialog";
  import LeagueProgramList from "./LeagueProgramList";

  import MemberEditDialog from "./MemberEditDialog.tsx";

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

  const floatingBoxSx = {
    position: "fixed",
    bottom: "calc(56px + env(safe-area-inset-bottom))",
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(calc(100% - 32px), 398px)",
    pb: 1,
    zIndex: 10,
  } as const;

  const TYPE_OPTIONS = [
    { label: "단식", disabled: false },
    { label: "복식", disabled: false },
    { label: "단체전", disabled: true },
    { label: "교류전", disabled: true },
  ];
  const FORMAT_OPTIONS = [
    { label: "단일리그", disabled: false },
    { label: "4인 리그 (OMR)", disabled: false },
    { label: "OCR 텍스트 인식", disabled: false },
    { label: "GPT 인식", disabled: false },
    { label: "조별리그", disabled: false },
    { label: "조별리그 + 본선리그", disabled: false },
    { label: "단일리그 + 토너먼트", disabled: false },
    { label: "조별리그 + 토너먼트", disabled: true },
    { label: "상·하위 토너먼트", disabled: false },
    { label: "이벤트 프로그램", disabled: false },
  ];
  const TOURNAMENT_SEEDING_OPTIONS = [
    { value: "manual", label: "수동" },
    { value: "seed", label: "시드" },
    { value: "random", label: "랜덤" },
  ];
  const TOURNAMENT_ADVANCEMENT_OPTIONS = [
    { value: "upper-only", label: "상위만" },
    { value: "upper-lower", label: "상·하위" },
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
    const [editDate, setEditDate] = useState("");
    const [editTime, setEditTime] = useState("");
    const [editEndTime, setEditEndTime] = useState("");
    const [editCourtCount, setEditCourtCount] = useState<number | "">("");
    const [editLocation, setEditLocation] = useState("");
    const [editType, setEditType] = useState("");
    const [editFormat, setEditFormat] = useState("");
    const [editRules, setEditRules] = useState("");
    const [editSortOrder, setEditSortOrder] = useState("");
    const [editTournamentSeeding, setEditTournamentSeeding] = useState("seed");
    const [editTournamentAdvancement, setEditTournamentAdvancement] = useState("upper-lower");
    // 단일리그+토너먼트 본선 편성
    const [editTournamentRules] = useState("");
    const [editAdvanceCount] = useState<number>(8);
    const [editAdvanceMethod] = useState("rank");
    const [editMainSeeding] = useState("seed");
    const [editFinalsAdvance] = useState<number>(2);
    const [editRecruitCount, setEditRecruitCount] = useState<number | null>(null);
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
    const [openMemberEditDialog, setOpenMemberEditDialog] = useState(false);
    const [replaceParticipantTarget, setReplaceParticipantTarget] = useState<{ id: string; division?: string | null; name: string } | null>(null);
    const [replacementDivision, setReplacementDivision] = useState("");
    const [replacementName, setReplacementName] = useState("");
    const [replacementMemberId, setReplacementMemberId] = useState<number | null>(null);
    const [loadMemberPurpose, setLoadMemberPurpose] = useState<"add" | "replace">("add");
    const [tournamentPlacementOpen, setTournamentPlacementOpen] = useState(false);
    const [selectedTournamentPlacement, setSelectedTournamentPlacement] = useState<{ program_round: number; match_id: string; slot: "a" | "b" } | null>(null);

    const { data: leagueData, isLoading: leagueLoading, refetch: refetchLeague } = useGetLeagueQuery(id ?? "", {
      skip: !id,
    });
    const { data: participantData, isLoading: participantsLoading, refetch: refetchParticipants } = useGetLeagueParticipantsQuery(
      id ?? "",
      { skip: !id, pollingInterval: 15000 },
    );
    const { data: programData } = useGetLeagueProgramQuery(id ?? "", {
      skip: !id,
    });
    const { data: leagueMatchesData } = useGetLeagueMatchesQuery(id ?? "", { skip: !id });

    const authUser = useAppSelector((state) => state.auth.user);

    const [updateParticipant] = useUpdateParticipantMutation();
    const [updateLeague, { isLoading: saving }] = useUpdateLeagueMutation();
    const [addParticipants] = useAddParticipantsMutation();
    const [deleteLeague] = useDeleteLeagueMutation();
    const [deleteParticipant] = useDeleteParticipantMutation();
    const [replaceParticipant, { isLoading: replacingParticipant }] = useReplaceParticipantMutation();

    const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(leagueData?.league?.group_id ?? "", {
      skip: !leagueData?.league?.group_id,
    });
    // groupLoading 중엔 판단 보류 (플리커 방지)
    const canManage = !groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin");
    const isMember = !groupLoading && !!groupData?.myRole;

    const league = leagueData?.league;

    const isPublicLeague = league?.join_permission === "public";
    const canInteract = isMember || isPublicLeague;
    const isClubEventLeague = league?.type === "클럽 이벤트" || league?.type === "클럽 교류전";
    const isEventProgramFormat = league?.format === "이벤트 프로그램" || league?.format === "프로그램별 설정";
    const canViewProgram = isClubEventLeague && (canManage || (!canManage && league?.status === "active"));

    // const isEditing = canManage;

    const myMember = useMemo(
      () => groupData?.members?.find((m) => m.user_id === authUser?.id),
      [groupData, authUser],
    );
    const myName = myMember?.name ?? authUser?.name ?? (id ? localStorage.getItem(`guestName_${id}`) : null) ?? null;
    const isMyParticipant = (participant: { member_id?: number | null; name: string }) => {
      if (myMember?.user_id != null && participant.member_id != null) {
        return participant.member_id === myMember.user_id;
      }
      if (authUser?.id != null && participant.member_id != null) {
        return participant.member_id === authUser.id;
      }
      return !!myName && participant.name === myName;
    };

    const rawParticipants = participantData?.participants ?? [];
    const hasEventProgram = isEventProgramFormat && Boolean(programData?.program);

    const tournamentByeSlots = useMemo(() => {
      const program = programData?.program?.program_data as { blocks?: Array<{ type?: string; format?: string }> } | null;
      const blocks = program?.blocks ?? [];
      const matches = leagueMatchesData?.matches ?? [];
      const matchMap = new Map(matches.map((match) => [match.id, match]));
      return matches.flatMap((match) => {
        const programRound = match.program_round ?? 0;
        const block = blocks[programRound - 1];
        if (!match.is_program || match.round_number !== 1 || match.status !== "pending" ||
            block?.type !== "SINGLES" || block?.format !== "TOURNAMENT") return [];
        const parent = match.next_match_id ? matchMap.get(match.next_match_id) : null;
        if (parent && parent.status !== "pending") return [];
        const slots: Array<{ program_round: number; match_id: string; slot: "a" | "b"; label: string }> = [];
        if (!match.participant_a_id) slots.push({ program_round: programRound, match_id: match.id, slot: "a", label: `${programRound}라운드 ${match.match_label ?? "1회전"} 상단 BYE` });
        if (!match.participant_b_id) slots.push({ program_round: programRound, match_id: match.id, slot: "b", label: `${programRound}라운드 ${match.match_label ?? "1회전"} 하단 BYE` });
        return slots;
      });
    }, [leagueMatchesData?.matches, programData?.program?.program_data]);

    const canAddParticipantToProgram = useMemo(() => {
      if (!hasEventProgram) return true;
      const data = programData?.program?.program_data as {
        blocks?: Array<{ type?: string; format?: string }>;
      } | null;
      return Boolean(data?.blocks?.length) && data!.blocks!.every(
        (block) => block.type === "SINGLES" && block.format === "LEAGUE",
      );
    }, [hasEventProgram, programData?.program?.program_data]);

    const confirmParticipantChange = (changeType: "add" | "edit" | "delete") => {
      if (!hasEventProgram) return true;
      if (!canAddParticipantToProgram) {
        setAlertSeverity("warning");
        setAlertMsg("현재는 단식 단일리그 프로그램에서만 참가자를 변경할 수 있습니다. 조별리그, 단체전, 토너먼트 참가자 변경은 추후 지원됩니다.");
        return false;
      }
      return window.confirm(
        changeType === "add"
          ? "참가자를 추가하면 새 참가자의 경기가 각 단일리그 라운드 마지막에 추가됩니다. 계속하시겠습니까?"
          : "참가자 정보 변경에 맞춰 프로그램 경기 데이터가 동기화됩니다. 계속하시겠습니까?",
      );
    };

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
      if (!confirmParticipantChange("add")) return;
      try {
        await addParticipants({
          leagueId: id,
          participants: [{ division: participantDivision, name: participantName }],
        }).unwrap();
        setAlertSeverity("success");
        setAlertMsg("참가 신청이 완료되었습니다.");
        // 비로그인 게스트 하이라이트용: 입력한 이름을 리그별로 저장
        if (!authUser && id) localStorage.setItem(`guestName_${id}`, participantName);
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
      if (!confirmParticipantChange("delete")) return;
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

    const submitAddedParticipant = async (placement?: { program_round: number; match_id: string; slot: "a" | "b" }) => {
      if (!id || !inputName.trim()) return;
      try {
        await addParticipants({
          leagueId: id,
          participants: [{ division: inputDivision.trim(), name: inputName.trim() }],
          placement: placement ? { kind: "tournament", ...placement } : undefined,
        }).unwrap();
        setInputDivision("");
        setInputName("");
        setTournamentPlacementOpen(false);
        setSelectedTournamentPlacement(null);
      } catch (e: unknown) {
        const msg = (e as { data?: { message?: string } })?.data?.message;
        setAlertSeverity("warning");
        setAlertMsg(msg ?? "참가자 추가에 실패했습니다.");
      }
    };

    const handleLoadMembers = async (selected: MemberRow[]) => {
      if (!id || selected.length === 0) return;
      if (loadMemberPurpose === "replace") {
        const member = selected[0];
        setReplacementDivision(member.division ?? "");
        setReplacementName(member.name);
        setReplacementMemberId(member.member_id);
        setOpenLoadDialog(false);
        return;
      }
      const remaining = league?.recruit_count != null
        ? league.recruit_count - rawParticipants.length
        : Infinity;
      if (selected.length > remaining) {
        setAlertSeverity("warning");
        setAlertMsg(`모집 인원(${league!.recruit_count}명)을 초과합니다. 최대 ${remaining}명 추가 가능합니다.`);
        return;
      }
      if (!confirmParticipantChange("add")) return;
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

    const openReplaceParticipantDialog = (participant: { id: string; division?: string | null; name: string }) => {
      setReplaceParticipantTarget(participant);
      setReplacementDivision("");
      setReplacementName("");
      setReplacementMemberId(null);
    };

    const handleReplaceParticipant = async () => {
      if (!id || !replaceParticipantTarget || !replacementName.trim()) return;
      try {
        await replaceParticipant({
          leagueId: id,
          participantId: replaceParticipantTarget.id,
          division: replacementDivision.trim(),
          name: replacementName.trim(),
          member_id: replacementMemberId,
        }).unwrap();
        setReplaceParticipantTarget(null);
        setAlertSeverity("success");
        setAlertMsg("참가자가 교체되었습니다. 기존 경기 결과와 남은 대진이 새 참가자에게 승계됩니다.");
      } catch (error: unknown) {
        const message = (error as { data?: { message?: string } })?.data?.message;
        setAlertSeverity("error");
        setAlertMsg(message ?? "참가자 교체에 실패했습니다.");
      }
    };

    const handleAddParticipant = async () => {
      if (!id || !inputName.trim()) return;
      if (hasEventProgram && !canAddParticipantToProgram) {
        if (tournamentByeSlots.length > 0) {
          setSelectedTournamentPlacement(tournamentByeSlots[0]);
          setTournamentPlacementOpen(true);
        } else {
          setAlertSeverity("warning");
          setAlertMsg("현재 프로그램에는 참가자를 추가할 수 있는 BYE 자리가 없습니다.");
        }
        return;
      }
      if (!confirmParticipantChange("add")) return;
      await submitAddedParticipant();
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
      navigate(getProgressPath());
    };

    const getProgressPath = () => {
      if (isEventProgramFormat) {
        const hasProgram = Boolean(programData?.program);
        const activeRound = Number.parseInt(localStorage.getItem(`league-program-active-round-${id}`) ?? "1", 10) || 1;
        return hasProgram
          ? `/league/${id}/program/matches?program=1&round=${activeRound}`
          : `/league/${id}/program`;
      }
      if (league?.format?.includes("토너먼트") && league?.format !== "단일리그 + 토너먼트") {
        return `/league/${id}/tournament/matches`;
      }
      if (league?.format === "4인 리그 (OMR)") {
        return `/league/${id}/omr`;
      }
      if (league?.format === "OCR 텍스트 인식") {
        return `/league/${id}/ocr`;
      }
      return `/league/${id}/matches`;
    };

    //상시 수정모드 전용 변환 함수
    const toDateInputValue = (dateString?: string) => {
      if (!dateString) return "";
      const d = toUTCDate(dateString);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const toTimeInputValue = (dateString?: string) => {
      if (!dateString) return "";
      const d = toUTCDate(dateString);
      const rawMin = d.getMinutes();
      const snappedMin = String((Math.round(rawMin / 10) * 10) % 60).padStart(2, "0");
      return `${String(d.getHours()).padStart(2, "0")}:${snappedMin}`;
    };

    // const toEditingParticipants = (
    //   participants: Array<{ id: string; division?: string | null; name: string }>
    // ) => {
    //   const editMap: Record<string, { division: string; name: string }> = {};
    //   participants.forEach((p) => {
    //     editMap[p.id] = {
    //       division: p.division ?? "",
    //       name: p.name,
    //     };
    //   });
    //   return editMap;
    // };

    // const handleEnterEdit = () => {
    //   if (!league) return;
    //   const d = toUTCDate(league.start_date);
    //   setEditDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    //   const rawMin = d.getMinutes();
    //   const snappedMin = String(Math.round(rawMin / 10) * 10 % 60).padStart(2, "0");
    //   setEditTime(`${String(d.getHours()).padStart(2, "0")}:${snappedMin}`);
    //   setEditLocation(parseLocation(league.description));
    //   setEditType(league.type ?? "단식");
    //   setEditFormat(league.format ?? "");
    //   setEditRules(league.rules ?? "");
    //   setNotice(league.notice ?? "");
    //   setEditSortOrder(league.sort_order ?? "부수");
    //   setEditRecruitCount(league.recruit_count ?? 20);
    //   setEditTournamentSeeding(league.tournament_seeding ?? "seed");
    //   setEditTournamentAdvancement(league.tournament_advancement ?? "upper-lower");
    //   setEditTournamentRules(league.tournament_rules ?? "5전 3선승제");
    //   setEditAdvanceCount(league.advance_count ?? 8);
    //   setEditAdvanceMethod(league.advance_method ?? "rank");
    //   setEditMainSeeding(league.tournament_seeding ?? "seed");
    //   setEditFinalsAdvance(league.finals_advance ?? 2);
    //   const editMap: Record<string, { division: string; name: string }> = {};
    //   participants.forEach((p) => { editMap[p.id] = { division: p.division ?? "", name: p.name }; });
    //   setEditingParticipants(editMap);
    //   // setIsEditing(true);
    // };
    const hasLeagueChanges = useMemo(() => {
      if (!league) return false;

      const currentDate = editDate || toDateInputValue(league.start_date);
      const currentTime = editTime || toTimeInputValue(league.start_date);
      const currentEndTime = editEndTime || toTimeInputValue(league.end_date ?? undefined);
      const currentCourtCount = editCourtCount === "" ? (league.court_count ?? "") : editCourtCount;
      const currentLocation = editLocation || parseLocation(league.description);
      const currentType = editType || league.type;
      const currentFormat = editFormat || league.format;
      const currentRules = editRules || league.rules;
      const currentSortOrder = editSortOrder || league.sort_order;
      const currentRecruitCount = editRecruitCount ?? league.recruit_count ?? 20;
      const currentNotice = notice || league.notice || "";

      return (
        currentDate !== toDateInputValue(league.start_date) ||
        currentTime !== toTimeInputValue(league.start_date) ||
        currentEndTime !== toTimeInputValue(league.end_date ?? undefined) ||
        currentCourtCount !== (league.court_count ?? "") ||
        currentLocation !== parseLocation(league.description) ||
        currentType !== league.type ||
        currentFormat !== league.format ||
        currentRules !== league.rules ||
        currentSortOrder !== league.sort_order ||
        currentRecruitCount !== league.recruit_count ||
        currentNotice !== (league.notice || "")
      );
    }, [
      league,
      editDate,
      editTime,
      editEndTime,
      editCourtCount,
      editLocation,
      editType,
      editFormat,
      editRules,
      editSortOrder,
      editRecruitCount,
      notice,
    ]);

    const hasChanges = hasLeagueChanges;

    const handleParticipantFieldBlur = async (participantId: string, field: "division" | "name", originalValue: string) => {
      if (!id) return;
      const current = (editingParticipants[participantId]?.[field] ?? "").trim();
      if (current === originalValue.trim()) return;
      if (!confirmParticipantChange("edit")) return;
      try {
        await updateParticipant({ leagueId: id, participantId, updates: { [field]: current } }).unwrap();
      } catch {
        setAlertSeverity("error");
        setAlertMsg("참가자 정보 수정에 실패했습니다.");
      }
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
  if (!id || !league) return;

  const safeDate = editDate || toDateInputValue(league.start_date);
  const safeTime = editTime || toTimeInputValue(league.start_date);
  const safeEndTime = editEndTime || toTimeInputValue(league.end_date ?? undefined);

  const safeLocation = editLocation || parseLocation(league.description);

  const safeType = editType || league.type;
  const safeFormat = editFormat || league.format;
  const safeRules = editRules || league.rules;
  const safeNotice = notice || league.notice;
  const safeSortOrder = editSortOrder || league.sort_order;

  const safeRecruitCount =
    editRecruitCount ?? league.recruit_count ?? 20;

  if (!safeDate || !safeTime) {
    setAlertSeverity("error");
    setAlertMsg("날짜와 시간을 입력해주세요.");
    return;
  }

  try {
    const startDateTime = new Date(`${safeDate}T${safeTime}:00`);

    if (Number.isNaN(startDateTime.getTime())) {
      console.log("날짜 값 확인:", {
        safeDate,
        safeTime,
        editDate,
        editTime,
      });

      setAlertSeverity("error");
      setAlertMsg("날짜 또는 시간 값이 올바르지 않습니다.");
      return;
    }

    const start_date = startDateTime.toISOString();
    const endDateTime = safeEndTime ? new Date(`${safeDate}T${safeEndTime}:00`) : null;

    await updateLeague({
      id,
      updates: {
        start_date,
        end_date: endDateTime ? endDateTime.toISOString() : null,
        court_count: editCourtCount === "" ? (league.court_count ?? null) : Number(editCourtCount),

        description:
          safeLocation && safeLocation !== "-"
            ? `장소: ${safeLocation}`
            : "",

        type: safeType,
        format: safeFormat || undefined,
        rules: safeRules || undefined,
        notice: safeNotice || undefined,
        sort_order: safeSortOrder,
        recruit_count: safeRecruitCount,

        ...(safeFormat === "상·하위 토너먼트" && {
          tournament_seeding:
            editTournamentSeeding ||
            league.tournament_seeding ||
            "seed",

          tournament_advancement:
            editTournamentAdvancement ||
            league.tournament_advancement ||
            "upper-lower",
        }),

        ...(safeFormat === "단일리그 + 토너먼트" && {
          tournament_rules:
            editTournamentRules ||
            league.tournament_rules ||
            "5전 3선승제",

          advance_count:
            editAdvanceCount ||
            league.advance_count ||
            8,

          advance_method:
            editAdvanceMethod ||
            league.advance_method ||
            "rank",

          tournament_seeding:
            editMainSeeding ||
            league.tournament_seeding ||
            "seed",

          finals_advance:
            editFinalsAdvance ||
            league.finals_advance ||
            2,
        }),
      },
    }).unwrap();

    setAlertSeverity("success");
    setAlertMsg("수정되었습니다.");

    refetchLeague();
  } catch (err) {
    console.error("updateLeague 실패:", err);

    setAlertSeverity("error");
    setAlertMsg("수정에 실패했습니다.");
  }
};

    useEffect(() => {
      if (!canManage || !hasChanges || saving) return;

      const timer = window.setTimeout(() => {
        void handleSaveEdit();
      }, 4000);

      return () => window.clearTimeout(timer);
    }, [
      canManage,
      hasChanges,
      saving,
      editDate,
      editTime,
      editEndTime,
      editCourtCount,
      editLocation,
      editType,
      editFormat,
      editRules,
      editSortOrder,
      editRecruitCount,
      editTournamentSeeding,
      editTournamentAdvancement,
      notice,
    ]);


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
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 0.5 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography fontWeight={900} fontSize={18} sx={{ flex: 1 }}>
            {league.title}
          </Typography>
          {/* {!isEditing && ( */}
          <>

            {canInteract && (
              <IconButton size="small" onClick={() => setShareDialogOpen(true)}>
                <IosShareIcon fontSize="small" />
              </IconButton>
            )}
          </>
          {/* // )} */}
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
            {canManage ? (
              <TextField
                type="date"
                value={editDate || toDateInputValue(league.start_date)}
                onChange={(e) => setEditDate(e.target.value)}
                size="small"
                variant="standard"
                sx={{ ...inputSx, "& input::-webkit-calendar-picker-indicator": { display: "none" } }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <CalendarTodayIcon sx={{ fontSize: 14, color: "#9CA3AF" }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            ) : (
              <Typography sx={valueSx}>{formatLeagueDate(league.start_date)}</Typography>
            )}
          </Box>

          <Divider sx={{ borderColor: "#F3F4F6" }} />

          <Box sx={infoRowSx}>
            <Typography sx={labelSx}>시 간</Typography>
            {canManage  ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <Select
                  value={(editTime || toTimeInputValue(league.start_date)).split(":")[0] || ""}
                  onChange={(e) => {
                    const baseTime = editTime || toTimeInputValue(league.start_date) || "00:00";
                    setEditTime(`${e.target.value}:${baseTime.split(":")[1] || "00"}`);
                  }}
                  variant="standard"
                  sx={selectSx}
                >
                  {HOUR_OPTIONS.map((h) => (
                    <MenuItem key={h} value={h} sx={{ fontSize: 13 }}>
                      {h}
                    </MenuItem>
                  ))}
                </Select>

                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>:</Typography>

                <Select
                  value={(editTime || toTimeInputValue(league.start_date)).split(":")[1] || ""}
                  onChange={(e) => {
                    const baseTime = editTime || toTimeInputValue(league.start_date) || "00:00";
                    setEditTime(`${baseTime.split(":")[0] || "00"}:${e.target.value}`);
                  }}
                  variant="standard"
                  sx={selectSx}
                >
                  {MINUTE_OPTIONS.map((m) => (
                    <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>

                <Typography sx={{ mx: 0.5, fontSize: 13, fontWeight: 700, color: "#6B7280" }}>~</Typography>

                <Select
                  value={(editEndTime || toTimeInputValue(league.end_date ?? undefined)).split(":")[0] || ""}
                  onChange={(e) => {
                    const baseTime = editEndTime || toTimeInputValue(league.end_date ?? undefined) || "00:00";
                    setEditEndTime(`${e.target.value}:${baseTime.split(":")[1] || "00"}`);
                  }}
                  variant="standard"
                  displayEmpty
                  sx={selectSx}
                >
                  <MenuItem value="" sx={{ fontSize: 13, color: "#9CA3AF" }}>시</MenuItem>
                  {HOUR_OPTIONS.map((h) => (
                    <MenuItem key={h} value={h} sx={{ fontSize: 13 }}>{h}</MenuItem>
                  ))}
                </Select>

                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>:</Typography>

                <Select
                  value={(editEndTime || toTimeInputValue(league.end_date ?? undefined)).split(":")[1] || ""}
                  onChange={(e) => {
                    const baseTime = editEndTime || toTimeInputValue(league.end_date ?? undefined) || "00:00";
                    setEditEndTime(`${baseTime.split(":")[0] || "00"}:${e.target.value}`);
                  }}
                  variant="standard"
                  displayEmpty
                  sx={selectSx}
                >
                  <MenuItem value="" sx={{ fontSize: 13, color: "#9CA3AF" }}>분</MenuItem>
                  {MINUTE_OPTIONS.map((m) => (
                    <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{m}</MenuItem>
                  ))}
                </Select>
              </Box>
            ) : (
              <Typography sx={valueSx}>
                {formatLeagueTime(league.start_date)}
                {league.end_date ? ` ~ ${formatLeagueTime(league.end_date)}` : ""}
              </Typography>
            )}
          </Box>

          <Divider sx={{ borderColor: "#F3F4F6" }} />

          <Box sx={infoRowSx}>
            <Typography sx={labelSx}>장 소</Typography>
            {canManage  ? (
              <TextField
                value={editLocation || parseLocation(league.description)}
                onChange={(e) => setEditLocation(e.target.value)}
                size="small"
                variant="standard"
                fullWidth
                sx={inputSx}
              />
            ) : (
              <Typography sx={valueSx}>{parseLocation(league.description)}</Typography>
            )}
          </Box>

          <Divider sx={{ borderColor: "#F3F4F6" }} />

          <Box sx={infoRowSx}>
            <Typography sx={labelSx}>탁구대</Typography>
            {canManage ? (
              <TextField
                type="number"
                value={editCourtCount === "" ? (league.court_count ?? "") : editCourtCount}
                onChange={(e) => setEditCourtCount(e.target.value ? Number(e.target.value) : "")}
                size="small"
                variant="standard"
                sx={{ ...inputSx, width: 64 }}
                slotProps={{ htmlInput: { min: 1 } }}
              />
            ) : (
              <Typography sx={valueSx}>{league.court_count ? `${league.court_count}대` : "-"}</Typography>
            )}
          </Box>

          {!isEventProgramFormat && <>
          <Divider sx={{ borderColor: "#F3F4F6" }} />

          <Box sx={infoRowSx}>
            <Typography sx={labelSx}>유 형</Typography>
            {canManage  ? (
              <Select
                value={editType || (league.type ?? "단식")}
                onChange={(e) => setEditType(e.target.value)}
                variant="standard"
                sx={selectSx}
              >
                {TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.label} value={o.label} disabled={o.disabled} sx={{ fontSize: 13 }}>
                    {o.label}
                    {o.disabled ? " (준비중)" : ""}
                  </MenuItem>
                ))}
              </Select>
            ) : (
              <Typography sx={valueSx}>{league.type}</Typography>
            )}
          </Box>

          <Divider sx={{ borderColor: "#F3F4F6" }} />

          <Box sx={infoRowSx}>
            <Typography sx={labelSx}>방 식</Typography>
            {canManage  ? (
              <Select
                value={editFormat || (league.format ?? "")}
                onChange={(e) => setEditFormat(e.target.value)}
                variant="standard"
                displayEmpty
                sx={selectSx}
              >
                <MenuItem value="" sx={{ fontSize: 13, color: "#9CA3AF" }}>
                  없음
                </MenuItem>
                {FORMAT_OPTIONS.map((o) => (
                  <MenuItem key={o.label} value={o.label} disabled={o.disabled} sx={{ fontSize: 13 }}>
                    {o.label}
                    {o.disabled ? " (준비중)" : ""}
                  </MenuItem>
                ))}
              </Select>
            ) : (
              <Typography sx={valueSx}>{league.format || "-"}</Typography>
            )}
          </Box>

          <Divider sx={{ borderColor: "#F3F4F6" }} />

          <Box sx={infoRowSx}>
            <Typography sx={labelSx}>규 칙</Typography>
            {canManage  ? (
              <Select
                value={editRules || (league.rules ?? "")}
                onChange={(e) => setEditRules(e.target.value)}
                variant="standard"
                displayEmpty
                sx={selectSx}
              >
                <MenuItem value="" sx={{ fontSize: 13, color: "#9CA3AF" }}>
                  없음
                </MenuItem>
                {RULES_OPTIONS.map((o) => (
                  <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>
                    {o}
                  </MenuItem>
                ))}
              </Select>
            ) : (
              <Typography sx={valueSx}>{league.rules || "-"}</Typography>
            )}
          </Box>

          <Divider sx={{ borderColor: "#F3F4F6" }} />

          <Box sx={infoRowSx}>
            <Typography sx={labelSx}>정 렬</Typography>
            {canManage  ? (
              <Select
                value={editSortOrder || (league.sort_order ?? "부수")}
                onChange={(e) => setEditSortOrder(e.target.value)}
                variant="standard"
                sx={selectSx}
              >
                {SORT_OPTIONS.map((o) => (
                  <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>
                    {o}
                  </MenuItem>
                ))}
              </Select>
            ) : (
              <Typography sx={valueSx}>{league.sort_order ?? "부수"}</Typography>
            )}
          </Box>

          {/* 토너먼트 옵션: 상·하위 토너먼트일 때만 표시 */}
          {(canManage  ? (editFormat || league.format) : league.format) === "상·하위 토너먼트" && (
            <>
              <Divider sx={{ borderColor: "#F3F4F6" }} />

              <Box sx={infoRowSx}>
                <Typography sx={labelSx}>편 성</Typography>
                {canManage  ? (
                  <Select
                    value={editTournamentSeeding || (league.tournament_seeding ?? "seed")}
                    onChange={(e) => setEditTournamentSeeding(e.target.value)}
                    variant="standard"
                    sx={selectSx}
                  >
                    {TOURNAMENT_SEEDING_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                ) : (
                  <Typography sx={valueSx}>
                    {TOURNAMENT_SEEDING_OPTIONS.find((o) => o.value === league.tournament_seeding)?.label ?? "미설정"}
                  </Typography>
                )}
              </Box>

              <Divider sx={{ borderColor: "#F3F4F6" }} />

              <Box sx={infoRowSx}>
                <Typography sx={labelSx}>진 출</Typography>
                {canManage  ? (
                  <Select
                    value={editTournamentAdvancement || (league.tournament_advancement ?? "upper-lower")}
                    onChange={(e) => setEditTournamentAdvancement(e.target.value)}
                    variant="standard"
                    sx={selectSx}
                  >
                    {TOURNAMENT_ADVANCEMENT_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                ) : (
                  <Typography sx={valueSx}>
                    {TOURNAMENT_ADVANCEMENT_OPTIONS.find((o) => o.value === league.tournament_advancement)?.label ?? "미설정"}
                  </Typography>
                )}
              </Box>
            </>
          )}
          </>}

          {isEventProgramFormat && canViewProgram && (
            <>
              <Divider sx={{ borderColor: "#F3F4F6" }} />
              <Stack direction="row" alignItems="center" sx={{ py: 0.8 }}>
                <Typography sx={{ ...labelSx, flex: 1 }}>프로그램</Typography>
                {canManage && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/league/${id}/program/new${hasEventProgram ? "?edit=true" : ""}`)}
                    sx={{ minWidth: 44, height: 24, borderRadius: 1, px: 1.25, fontSize: 11, fontWeight: 800 }}
                  >
                    수정
                  </Button>
                )}
              </Stack>
              <LeagueProgramList embedded />
            </>
          )}
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
              {canManage  ? (
                <Select
                  value={editRecruitCount ?? league.recruit_count ?? 20}
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
            {canManage && (
              <Button
                variant="outlined"
                disableElevation
                size="small"
                onClick={() => setOpenMemberEditDialog(true)}
                sx={{
                  borderRadius: 1,
                  height: 28,
                  px: 1.5,
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                추가/삭제
              </Button>
            )}
          </Stack>

          {/* 뷰 모드: 검색 */}

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

          <Box sx={{ bgcolor: "#fff", borderRadius: 1, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            {/* 테이블 헤더 */}
            <Box sx={{ display: "flex", alignItems: "center", px: 1.5, py: 0.8, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <Box sx={{ width: 40, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>부수</Typography>
              </Box>
              <Box sx={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>이름</Typography>
              </Box>
              <Box sx={{ width: 146, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>상태</Typography>
              </Box>
            </Box>

            {participantsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (canManage  ? participants : filteredParticipants).length === 0 ? (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <Typography fontSize={13} fontWeight={700} color="text.secondary">
                  {!canManage  && searchQuery ? "검색 결과가 없습니다." : "참가자가 없습니다."}
                </Typography>
              </Box>
            ) : (
              (canManage  ? participants : filteredParticipants).map((p, idx) => {
                const isMe = isMyParticipant(p);
                return (
                  <Box
                    key={p.id}
                    sx={{ display: "flex", alignItems: "center", px: 1.5, py: 0.9, borderTop: idx === 0 ? "none" : "1px solid #F3F4F6", bgcolor: isMe ? "#EFF6FF" : "transparent" }}
                  >
                      <Box sx={{ width: 40, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: "#FAAA47", color: "#000000", fontSize: 10, fontWeight: 900 }}>
                          {p.division || "-"}
                        </Avatar>
                      </Box>

                      <Typography fontWeight={800} fontSize={14} sx={{ textAlign: "center", color: isMe ? "#2F80ED" : "inherit", flex: 1, minWidth: 0 }}>{p.name}</Typography>

                      <Box sx={{ width: 146, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="center"
                          sx={{ width: "fit-content" }}
                        >
                        {(
                          [
                            { key: "paid", label: "입금", value: p.paid, on: { border: "#27AE60", bgcolor: "#ECFDF5", color: "#16A34A" } },
                            { key: "arrived", label: "도착", value: p.arrived, on: { border: "#2F80ED", bgcolor: "#EFF6FF", color: "#1D6FBF" } },
                            { key: "after", label: "뒷풀이", value: p.after, on: { border: "#9C27B0", bgcolor: "#F3E5F5", color: "#7B1FA2" } },
                          ] as const
                        ).map(({ key, label, value, on }) => (
                          <Box
                            key={key}
                            onClick={() => canInteract && handleToggle(p.id, key, value)}
                            sx={{
                              width: 44,
                              height: 24,
                              px: 0,
                              borderRadius: 0.6,
                              border: `1px solid ${value ? on.border : "#D1D5DB"}`,
                              bgcolor: value ? on.bgcolor : "#F9FAFB",
                              color: value ? on.color : "#9CA3AF",
                              fontSize: 11, fontWeight: 700,
                              cursor: canInteract ? "pointer" : "default",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              userSelect: "none",
                              whiteSpace: "nowrap",
                              textAlign: "center",
                              flexShrink: 0,
                              "&:hover": { opacity: canInteract ? 0.8 : 1 },
                            }}
                          >
                            {label}
                          </Box>
                        ))}
                        </Stack>
                      </Box>
                    {/* )} */}
                  </Box>
                )
              })
            )}
          </Box>

          <MemberEditDialog
            open={openMemberEditDialog}
            onClose={() => setOpenMemberEditDialog(false)}
            participants={participants}
            participantsLoading={participantsLoading}
            editingParticipants={editingParticipants}
            setEditingParticipants={setEditingParticipants}
            inputDivision={inputDivision}
            setInputDivision={setInputDivision}
            inputName={inputName}
            setInputName={setInputName}
            handleAddParticipant={handleAddParticipant}
            handleParticipantFieldBlur={handleParticipantFieldBlur}
            setDeleteParticipantTarget={setDeleteParticipantTarget}
            onOpenLoadMembers={() => { setLoadMemberPurpose("add"); setOpenLoadDialog(true); }}
            onReplaceParticipant={openReplaceParticipantDialog}
          />

          {canInteract && (
            <Button
              fullWidth variant="outlined" disableElevation
              sx={{ mt: 1.5, borderRadius: 1, height: 40, fontWeight: 700 }}
              onClick={() => navigate(`/draw/${id}`)}
            >
              경품 추첨
            </Button>
          )}
          {!isEventProgramFormat && ((!canManage  && league.status === "active") || canManage) && (
            league.format === "조별리그" && (
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Button
                  fullWidth variant="outlined" disableElevation
                  sx={{ mt: 1, borderRadius: 1, height: 40, fontWeight: 700, bgcolor: "#87B8FF", borderColor: "#87B8FF", color: "#FFF", "&:hover": { bgcolor: "#79AEFF" } }}
                  onClick={() => navigate(`/league/${id}/grouping`)}
                >
                  {canManage && league.status === "draft" ? "조별리그 조편성 생성" : "조별리그 조편성 보기"}
                </Button>
              </Stack>
            )
          )}
          {league.format === "OCR 텍스트 인식" && ((!canManage  && league.status === "active") || canManage) && (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Button
                fullWidth variant="outlined" disableElevation
                sx={{ mt: 1, borderRadius: 1, height: 40, fontWeight: 700, bgcolor: "#87B8FF", borderColor: "#87B8FF", color: "#FFF", "&:hover": { bgcolor: "#79AEFF" } }}
                onClick={() => navigate(`/league/${id}/ocr`)}
              >
                OCR 텍스트 인식 열기
              </Button>
            </Stack>
          )}
          {!isEventProgramFormat && league.format !== "OCR 텍스트 인식" && ((!canManage  && league.status === "active") || canManage) && (
            league.format === "단일리그 + 토너먼트" ? (
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Button
                  fullWidth variant="outlined" disableElevation
                  sx={{ borderRadius: 1, height: 40, fontWeight: 700, bgcolor: "#87B8FF", color: "#FFF", "&:hover": { borderColor: "#79AEFF", bgcolor: "#EFF6FF" } }}
                  onClick={() => navigate(`/league/${id}/bracket`)}
                >
                  {canManage && league.status === "draft" ? "단일리그 대진표 생성" : "단일리그 대진표 보기"}
                </Button>
                <Button
                  fullWidth variant="contained" disableElevation
                  sx={{ borderRadius: 1, height: 40, fontWeight: 700, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
                  onClick={() => navigate(`/league/${id}/tournament`)}
                >
                  {canManage && league.status === "draft" ? "본선 토너먼트 대진표 생성" : "본선 토너먼트 대진표 보기"}
                </Button>
              </Stack>
            ) : (
              <Button
                fullWidth variant="contained" disableElevation
                sx={{ mt: 1, borderRadius: 1, height: 40, fontWeight: 700, bgcolor: "#87B8FF", "&:hover": { bgcolor: "#79AEFF" } }}
                onClick={() => {
                  if (league.format?.includes("토너먼트")) {
                    navigate(`/league/${id}/tournament`);
                  } else if (league.format === "GPT 인식") {
                    navigate(`/league/${id}/gpt-vision`);
                  } else {
                    navigate(`/league/${id}/bracket`);
                  }
                }}
              >
                {canManage && league.format && league.status === "draft" ? `${league.format} 대진표 생성` : ""}
                {canManage && league.format && league.status === "active" ? `${league.format} 대진표 보기` : ""}
                {!canManage && league.format ? `${league.format} 대진표 보기` : ""}
              </Button>
            )
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
                    <ToggleButton value="club_only" sx={{ gap: 0.5 }}><LockOutlinedIcon sx={{ fontSize: 16 }} />클럽에 가입한 회원만</ToggleButton>
                    <ToggleButton value="public" sx={{ gap: 0.5 }}><LanguageIcon sx={{ fontSize: 16 }} />링크가 있는 모든 사람</ToggleButton>
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
                    // sx={{ width: 56, height: 56, bgcolor: "#FFEB3A", "&:hover": { bgcolor: "#E6CE00" }, p: 0, overflow: "hidden" }}
                    sx={{ width: 56, height: 56, bgcolor: "#FFEB3A", transition: "none", "&:hover": { bgcolor: "#E6CE00", img: { filter: "brightness(0.89)",}, }, }}
                  >
                    <Box component="img" src="/kakao-logo.png" alt="카카오톡" sx={{ width: 40, height: 40, objectFit: "contain" }} />
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

        <Dialog
          open={tournamentPlacementOpen}
          onClose={() => setTournamentPlacementOpen(false)}
          maxWidth="xs"
          fullWidth
          slotProps={{ paper: { sx: { borderRadius: 1, mx: 2 } } }}
        >
          <DialogTitle sx={{ fontWeight: 900, fontSize: 17 }}>대진 위치 선택</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2, fontSize: 14 }}>
              <b>{inputName.trim()}</b> 참가자를 추가할 BYE 위치를 선택해주세요.
            </Typography>
            <Select
              fullWidth
              size="small"
              value={selectedTournamentPlacement ? `${selectedTournamentPlacement.match_id}:${selectedTournamentPlacement.slot}` : ""}
              onChange={(event) => {
                const [matchId, slot] = String(event.target.value).split(":");
                const selected = tournamentByeSlots.find((item) => item.match_id === matchId && item.slot === slot);
                if (selected) setSelectedTournamentPlacement(selected);
              }}
            >
              {tournamentByeSlots.map((item) => (
                <MenuItem key={`${item.match_id}:${item.slot}`} value={`${item.match_id}:${item.slot}`}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setTournamentPlacementOpen(false)}>취소</Button>
            <Button
              variant="contained"
              disableElevation
              disabled={!selectedTournamentPlacement}
              onClick={() => selectedTournamentPlacement && submitAddedParticipant(selectedTournamentPlacement)}
            >
              확인
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={!!replaceParticipantTarget}
          onClose={() => !replacingParticipant && setReplaceParticipantTarget(null)}
          maxWidth="xs"
          fullWidth
          slotProps={{ paper: { sx: { borderRadius: 1, mx: 2 } } }}
        >
          <DialogTitle>
            <Stack direction="row" alignItems="center">
              <Typography sx={{ flex: 1, fontWeight: 900, fontSize: 17 }}>참가자 교체</Typography>
              <Button
                variant="contained"
                disableElevation
                size="small"
                onClick={() => { setLoadMemberPurpose("replace"); setOpenLoadDialog(true); }}
                sx={{ height: 28, borderRadius: 1, px: 1.5, fontSize: 11, fontWeight: 900 }}
              >
                클럽회원 불러오기
              </Button>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2, fontSize: 14 }}>
              <b>{replaceParticipantTarget?.name}</b> 님을 누구와 교체하시겠습니까?
            </Typography>
            <Typography sx={{ mb: 2, fontSize: 12, color: "text.secondary" }}>
              기존 경기 결과와 남은 경기, 승패 및 순위가 교체 참가자에게 이전됩니다.
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                label="부수"
                value={replacementDivision}
                onChange={(event) => { setReplacementDivision(event.target.value); setReplacementMemberId(null); }}
                size="small"
                sx={{ width: 92 }}
              />
              <TextField
                label="이름"
                value={replacementName}
                onChange={(event) => { setReplacementName(event.target.value); setReplacementMemberId(null); }}
                size="small"
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setReplaceParticipantTarget(null)} disabled={replacingParticipant}>취소</Button>
            <Button
              variant="contained"
              disableElevation
              disabled={!replacementName.trim() || replacingParticipant}
              onClick={handleReplaceParticipant}
            >
              완료
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
            <Typography sx={{ mt: 1, fontSize: 12, color: "text.secondary" }}>
              완료된 경기 결과는 유지되며, 시작하지 않은 남은 경기에서는 해당 참가자가 제외됩니다.
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
          {canManage  ? (
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
        {canManage  && (
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

        {/* 새로고침 플로팅 버튼 */}
        {!canManage  && (
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
        { canManage && (
          <Box
            sx={{
              position: "fixed",
              bottom: "calc(56px + env(safe-area-inset-bottom))",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(calc(100% - 32px), 398px)",
              pb: 1,
              zIndex: 10,
            }}
          >
            <Button
              fullWidth
              variant="contained"
              disableElevation
              onClick={handleStart}
              sx={{
                borderRadius: 1,
                height: 40,
                fontWeight: 700,
                fontSize: 15,
                bgcolor: "#2F80ED",
                "&:hover": { bgcolor: "#256FD1" },
              }}
            >
              {league.status === "active" ? "리그 진행 중" : "리그 시작"}
            </Button>
          </Box>
        )}

        {/* 비회원 + club_only: 차단 메시지 */}
        { !canManage && !isMember && league?.join_permission === "club_only" && (
          <Button
            fullWidth variant="contained" disableElevation disabled
            sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#E5E7EB", color: "#9CA3AF", "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF" } }}
          >
            클럽 회원만 참가 가능
          </Button>
        )}

        {/* 비회원 + public: 참가 신청 가능 */}
        { !canManage && !isMember && league?.join_permission === "public" && (() => {
          const myEntry = myName ? rawParticipants.find((p) => p.name === myName) : null;
          if (league.status === "active") {
            return (
              <Box sx={floatingBoxSx}>
                <Button fullWidth variant="contained" disableElevation
                  sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
                  onClick={() => navigate(getProgressPath())}
                >
                  리그 진행 중
                </Button>
              </Box>
            );
          }
          if (myEntry) {
            return (
              <Box sx={floatingBoxSx}>
                <Button fullWidth variant="contained" disableElevation disabled
                  sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#E5E7EB", color: "#9CA3AF", "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF" } }}
                >
                  리그 대기중
                </Button>
              </Box>
            );
          }
          const isFull = league?.recruit_count != null && rawParticipants.length >= league.recruit_count;
          return (
            <Box sx={floatingBoxSx}>
              <Button fullWidth variant="contained" disableElevation disabled={isFull}
                sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
                onClick={() => setGuestJoinOpen(true)}
              >
                {isFull ? `마감 (${league!.recruit_count}/${league!.recruit_count}명)` : "참가 신청"}
              </Button>
            </Box>
          );
        })()}

        {/* 참가자(클럽 회원)용 버튼 */}
        { !canManage && isMember && (() => {
          const myParticipant = rawParticipants.find((p) => p.name === myMember?.name);
          if (league.status === "active") {
            if (!myParticipant) return null;
            return (
              <Box sx={floatingBoxSx}>
                <Button
                  fullWidth variant="contained" disableElevation
                  sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
                  onClick={() => navigate(getProgressPath())}
                >
                  리그 진행 중
                </Button>
              </Box>
            );
          }
          if (myParticipant) {
            return (
              <Stack spacing={1}>
                <Box sx={floatingBoxSx}>
                  <Button
                    fullWidth variant="contained" disableElevation disabled
                    sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#E5E7EB", color: "#9CA3AF", "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF" } }}
                  >
                    리그 대기중
                  </Button>
                </Box>
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
            <Box sx={floatingBoxSx}>
              <Button
                fullWidth variant="contained" disableElevation disabled={isFull}
                sx={{ borderRadius: 1, height: 44, fontWeight: 900, fontSize: 15, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
                onClick={() => handleJoin()}
              >
                {isFull ? `마감 (${league!.recruit_count}/${league!.recruit_count}명)` : "참가 신청"}
              </Button>
            </Box>
          );
        })()}
      </Box>
    );
  }
