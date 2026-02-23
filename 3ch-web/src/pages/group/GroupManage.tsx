import { useParams, useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import {
    Box,
    Stack,
    Typography,
    Card,
    CardContent,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Divider,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    FormControl,
    InputLabel,
    Collapse,
    Chip,
    CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import QRCode from "react-qr-code";
import { useAppSelector } from "../../app/hooks";
import {
    useGetGroupDetailQuery,
    useUpdateMemberRoleMutation,
    useUpdateMemberMutation,
    useRemoveMemberMutation,
    useUpdateGroupMutation,
    useDeleteGroupMutation,
    useLeaveGroupMutation,
} from "../../features/group/groupApi";
import { useGetLeaguesQuery, useGetLeagueParticipantsQuery, useUpdateParticipantMutation } from "../../features/league/leagueApi";
import type { LeagueParticipantItem } from "../../features/league/leagueApi";
import ParticipantDetailDialog from "../league/ParticipantDetailDialog";
import MemberEditDialog from "./MemberEditDialog";
import type { Participant } from "../../features/league/leagueCreationSlice";
import { getRoleLabel } from "../../utils/permissions";
import { REGION_DATA } from "./regionData";

const SPORT_EMOJI: Record<string, string> = {
    "탁구": "🏓",
    "배드민턴": "🏸",
    "테니스": "🎾",
};

export default function GroupManage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const token = useAppSelector((s) => s.auth.token);
    const isLoggedIn = !!token;

    const { data, isLoading } = useGetGroupDetailQuery(id || "", {
        skip: !isLoggedIn || !id,
        refetchOnMountOrArgChange: true,
        refetchOnFocus: true,
        refetchOnReconnect: true,
    });

    const [updateMemberRole] = useUpdateMemberRoleMutation();
    const [updateMember] = useUpdateMemberMutation();
    const [removeMember] = useRemoveMemberMutation();
    const [updateGroup, { isLoading: isUpdating }] = useUpdateGroupMutation();
    const [deleteGroup, { isLoading: isDeleting }] = useDeleteGroupMutation();
    const [leaveGroup, { isLoading: isLeaving }] = useLeaveGroupMutation();
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [showLeagueManagement] = useState(false);
    const [expandedLeagueId, setExpandedLeagueId] = useState<string | null>(null);
    const [participantDetailOpen, setParticipantDetailOpen] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState<{ leagueId: string; participant: LeagueParticipantItem } | null>(null);
    const [memberEditOpen, setMemberEditOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; email: string; role: "owner" | "admin" | "member"; division?: string } | null>(null);

    const leagueManagementRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        name: "",
        sport: "",
        region_city: "",
        region_district: "",
        founded_at: "",
    });

    // 현재 클럽의 리그 목록 조회
    const { data: leagueData } = useGetLeaguesQuery(
        id ? { group_id: id } : undefined,
        {
            skip: !isLoggedIn || !id,
            refetchOnMountOrArgChange: true,
            refetchOnFocus: true,
            refetchOnReconnect: true,
        }
    );
    const leagues = leagueData?.leagues ?? [];

    // 펼쳐진 리그의 참가자 목록 조회
    const { data: participantData, isLoading: isLoadingParticipants, refetch: refetchParticipants } = useGetLeagueParticipantsQuery(
        expandedLeagueId ?? "",
        {
            skip: !expandedLeagueId,
            refetchOnMountOrArgChange: true,
            refetchOnFocus: true,
            refetchOnReconnect: true,
        }
    );
    const participants = participantData?.participants ?? [];

    const [updateParticipant] = useUpdateParticipantMutation();

    if (!isLoggedIn) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>로그인이 필요합니다.</Typography>
            </Box>
        );
    }

    if (isLoading) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>로딩 중...</Typography>
            </Box>
        );
    }

    if (!data) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>클럽을 찾을 수 없습니다.</Typography>
            </Box>
        );
    }

    const { group, members, myRole } = data;
    const canManage = myRole === "owner" || myRole === "admin";
    const canInvite = myRole === "owner" || myRole === "admin" || myRole === "member";
    const isOwner = myRole === "owner";
    const emoji = group.sport ? (SPORT_EMOJI[group.sport] ?? "🏓") : "🏓";

    const handleOpenEditDialog = () => {
        if (!group) return; // 데이터가 없으면 다이얼로그를 열지 않음

        setFormData({
            name: group.name || "",
            sport: group.sport || "",
            region_city: group.region_city || "",
            region_district: group.region_district || "",
            founded_at: group.founded_at ? group.founded_at.split('T')[0] : "",
        });
        setEditDialogOpen(true);
    };

    const handleUpdateGroup = async () => {
        if (!id) return;
        try {
            await updateGroup({
                groupId: id,
                data: formData,
            }).unwrap();
            setEditDialogOpen(false);
        } catch (error) {
            console.error("Failed to update group:", error);
        }
    };

    const handleDeleteGroup = async () => {
        if (!id) return;
        try {
            await deleteGroup(id).unwrap();
            setDeleteDialogOpen(false);
            navigate("/group");
        } catch (error) {
            console.error("Failed to delete group:", error);
        }
    };

    const handleLeaveGroup = async () => {
        if (!id) return;
        try {
            await leaveGroup(id).unwrap();
            setLeaveDialogOpen(false);
            navigate("/group");
        } catch (error) {
            console.error("Failed to leave group:", error);
        }
    };

    const handleToggleLeague = (leagueId: string) => {
        setExpandedLeagueId((prev) => (prev === leagueId ? null : leagueId));
    };

    const handleOpenParticipantDetail = (leagueId: string, participant: LeagueParticipantItem) => {
        setSelectedParticipant({ leagueId, participant });
        setParticipantDetailOpen(true);
    };

    const handleCloseParticipantDetail = () => {
        setParticipantDetailOpen(false);
        setSelectedParticipant(null);
    };

    const handleSaveParticipant = async (updated: Participant) => {
        if (!selectedParticipant) return;
        try {
            await updateParticipant({
                leagueId: selectedParticipant.leagueId,
                participantId: selectedParticipant.participant.id,
                updates: {
                    division: updated.division,
                    name: updated.name,
                    paid: updated.paid,
                    arrived: updated.arrived,
                    after: updated.after,
                },
            }).unwrap();
            await refetchParticipants();
            handleCloseParticipantDetail();
        } catch (error) {
            console.error("Failed to update participant:", error);
        }
    };

    const handleOpenMemberEdit = (member: typeof members[0]) => {
        setSelectedMember({
            id: String(member.user_id),
            name: member.name || member.email,
            email: member.email,
            role: member.role as "owner" | "admin" | "member",
            division: member.division || "",
        });
        setMemberEditOpen(true);
    };

    const handleCloseMemberEdit = () => {
        setMemberEditOpen(false);
        setSelectedMember(null);
    };

    const handleSaveMemberEdit = async (updated: { role: "owner" | "admin" | "member"; division: string }) => {
        if (!selectedMember || !id) return;
        try {
            if (updated.role !== selectedMember.role && updated.role !== "owner" && selectedMember.role !== "owner") {
                await updateMemberRole({
                    groupId: id,
                    userId: selectedMember.id,
                    role: updated.role as "member" | "admin",
                }).unwrap();
            }

            await updateMember({
                groupId: id,
                userId: selectedMember.id,
                division: updated.division.trim(),
            }).unwrap();

            handleCloseMemberEdit();
        } catch (error) {
            console.error("Failed to update member:", error);
        }
    };

    const handleRemoveMember = async () => {
        if (!selectedMember || !id) return;
        if (!window.confirm(`"${selectedMember.name}"님을 클럽에서 내보내시겠습니까?`)) {
            return;
        }
        try {
            await removeMember({ groupId: id, userId: selectedMember.id }).unwrap();
            handleCloseMemberEdit();
        } catch (error) {
            console.error("Failed to remove member:", error);
        }
    };

    const formatLeagueDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const days = ["일", "월", "화", "수", "목", "금", "토"];
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const day = days[d.getDay()];
        return `${yyyy}-${mm}-${dd}(${day})`;
    };

    return (
        <Stack spacing={2.5} sx={{ pb: 3 }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate("/group")} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>
                    클럽 정보
                </Typography>
                {isOwner && (
                    <IconButton size="small" onClick={handleOpenEditDialog}>
                        <EditIcon />
                    </IconButton>
                )}
            </Stack>

            {/* 클럽 정보 카드 */}
            <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <CardContent sx={{ py: 2.5, px: 2.5, "&:last-child": { pb: 2.5 } }}>
                    <Stack spacing={2}>
                        {/* 클럽명 + 이모지 + 지역 */}
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Typography sx={{ fontSize: 32, lineHeight: 1 }}>{emoji}</Typography>
                            <Box flex={1}>
                                <Typography fontWeight={900} fontSize={20}>
                                    {group.name}
                                </Typography>
                                {(group.region_city || group.region_district) && (
                                    <Typography fontSize={13} color="text.secondary" fontWeight={600}>
                                        {group.region_city} {group.region_district}
                                    </Typography>
                                )}
                            </Box>
                        </Stack>

                        {/* 기본 정보 */}
                        <Stack
                            direction="row"
                            // spacing={3}
                            sx={{
                                bgcolor: "#F9FAFB",
                                borderRadius: 1,
                                px: 2,
                                py: 1.5,
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                alignItems: "center",
                                textAlign: "center"
                            }}
                        >
                            <Box>
                                <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{textAlign : "center"}}>
                                    종목
                                </Typography>
                                <Typography fontWeight={800} fontSize={14} sx={{textAlign : "center"}}>
                                    {group.sport || "-"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{textAlign : "center"}}>
                                    창단일
                                </Typography>
                                <Typography fontWeight={800} fontSize={14} sx={{textAlign : "center"}}>
                                    {group.founded_at ? new Date(group.founded_at).toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "") : "-"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{textAlign : "center"}}>
                                    회원수
                                </Typography>
                                <Typography fontWeight={800} fontSize={14} sx={{textAlign : "center"}}>
                                    {members.length}
                                </Typography>
                            </Box>
                        </Stack>

                        {/* 리그·대회 개최내역 */}
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => navigate(`/group/${id}/manage/league`)}
                            sx={{
                                borderRadius: 1,
                                py: 1.2,
                                fontWeight: 700,
                                justifyContent: "space-between",
                            }}
                        >
                            리그·대회 개최내역
                            <span>→</span>
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* 클럽 회원 섹션 */}
            <Box>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1.5 }}>
                    클럽 회원
                </Typography>

                <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    <List disablePadding>
                        <ListItem
                            sx={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            py: 1.5,
                            px: 2.5,
                            spacing: 0.5,
                            bgcolor: "#f5f5f5"
                            }}
                        >
                            <Typography fontWeight={700} fontSize={14} sx={{flex: 1, textAlign : "left"}}>구분</Typography>
                            <Typography fontWeight={700} fontSize={14} sx={{flex: 1, textAlign : "left"}}>부수</Typography>
                            <Typography fontWeight={700} fontSize={14} sx={{flex: 1, textAlign : "left"}}>이름</Typography>
                        </ListItem>
                        {members.map((member, idx) => (
                            <Box key={member.id}>
                                {idx > 0 && <Divider />}
                                <ListItem
                                    sx={{
                                        py: 1.5,
                                        px: 2.5,
                                        bgcolor: member.role === "owner"
                                            ? "rgba(255, 193, 7, 0.08)" // 황금색 배경 for owner
                                            : member.role === "admin"
                                            ? "rgba(33, 150, 243, 0.08)" // 파란색 배경 for admin
                                            : "transparent"
                                    }}
                                    secondaryAction={
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            {canManage && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenMemberEdit(member)}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </Stack>
                                    }
                                >
                                    <ListItemText sx={{ flex: 1, textAlign: "center" }}
                                        primary={
                                            <Typography fontWeight={700} fontSize={14} sx={{textAlign : "left"}}>
                                                {getRoleLabel(member.role)}
                                            </Typography>
                                        }
                                    />
                                    <ListItemText sx={{ flex: 1, textAlign: "center" }}
                                        primary={
                                            <Typography fontWeight={700} fontSize={14} sx={{textAlign : "left"}}>
                                                {member.division}
                                            </Typography>
                                        }
                                    />
                                    <ListItemText sx={{ flex: 1, textAlign: "center" }}
                                        primary={
                                            <Typography fontWeight={700} fontSize={14} sx={{textAlign : "left"}}>
                                                {member.name || member.email}
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                            </Box>
                        ))}
                    </List>
                </Card>
            </Box>

            {/* 리그 관리 섹션 */}
            {showLeagueManagement && (
            <Box ref={leagueManagementRef}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1.5 }}>
                    리그 관리
                </Typography>

                {leagues.length > 0 ? (
                    <Stack spacing={1}>
                        {leagues.map((league) => (
                            <Card key={league.id} elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                                <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                                    <Box
                                        onClick={() => handleToggleLeague(league.id)}
                                        sx={{
                                            px: 2.5,
                                            py: 1.8,
                                            cursor: "pointer",
                                            "&:hover": { bgcolor: "#F9FAFB" },
                                        }}
                                    >
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Box flex={1}>
                                                <Typography fontWeight={700} fontSize={15}>
                                                    {formatLeagueDate(league.start_date)}
                                                </Typography>
                                                <Typography fontSize={12} color="text.secondary" fontWeight={600}>
                                                    {league.type} · {league.participant_count} / {league.recruit_count}명
                                                </Typography>
                                            </Box>
                                            <IconButton size="small">
                                                {expandedLeagueId === league.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                            </IconButton>
                                        </Stack>
                                    </Box>

                                    {/* 참가자 목록 (확장된 리그만) */}
                                    <Collapse in={expandedLeagueId === league.id} timeout="auto" unmountOnExit>
                                        <Divider />
                                        <Box sx={{ px: 2.5, py: 2 }}>
                                            <Typography fontSize={13} fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
                                                참가자 목록
                                            </Typography>

                                            {isLoadingParticipants ? (
                                                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                                                    <CircularProgress size={24} />
                                                </Box>
                                            ) : participants.length > 0 ? (
                                                <Stack spacing={0.8}>
                                                    {participants.map((participant) => (
                                                        <Box
                                                            key={participant.id}
                                                            onClick={() => canManage && handleOpenParticipantDetail(league.id, participant)}
                                                            sx={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 1.5,
                                                                px: 1.5,
                                                                py: 1,
                                                                borderRadius: 1,
                                                                bgcolor: "#F9FAFB",
                                                                cursor: canManage ? "pointer" : "default",
                                                                "&:hover": canManage ? { bgcolor: "#F3F4F6" } : {},
                                                            }}
                                                        >
                                                            {participant.division && (
                                                                <Chip
                                                                    label={participant.division}
                                                                    size="small"
                                                                    sx={{ height: 20, fontSize: 11, fontWeight: 800 }}
                                                                />
                                                            )}
                                                            <Typography fontWeight={700} fontSize={14} flex={1}>
                                                                {participant.name}
                                                            </Typography>
                                                            <Stack direction="row" spacing={0.5}>
                                                                {participant.paid && (
                                                                    <Chip label="입금" size="small" color="success" sx={{ height: 20, fontSize: 10 }} />
                                                                )}
                                                                {participant.arrived && (
                                                                    <Chip label="도착" size="small" color="primary" sx={{ height: 20, fontSize: 10 }} />
                                                                )}
                                                                {participant.after && (
                                                                    <Chip label="뒷풀이" size="small" color="secondary" sx={{ height: 20, fontSize: 10 }} />
                                                                )}
                                                            </Stack>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            ) : (
                                                <Typography fontSize={13} color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                                                    참가자가 없습니다.
                                                </Typography>
                                            )}
                                        </Box>
                                    </Collapse>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                ) : (
                    <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                        <CardContent sx={{ py: 2.5, textAlign: "center" }}>
                            <Typography color="text.secondary" fontWeight={700}>
                                개설된 리그가 없습니다.
                            </Typography>
                        </CardContent>
                    </Card>
                )}
            </Box>
            )}

            {canInvite && (
                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    onClick={() => setInviteDialogOpen(true)}
                    sx={{
                        borderRadius: 1,
                        py: 1.5,
                        fontWeight: 900,
                    }}
                >
                    클럽 초대
                </Button>
            )}

            {!isOwner && (
                <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    disableElevation
                    onClick={() => setLeaveDialogOpen(true)}
                    sx={{
                        borderRadius: 1,
                        py: 1.5,
                        fontWeight: 900,
                    }}
                >
                    클럽 탈퇴
                </Button>
            )}

            {/* 클럽 정보 수정 다이얼로그 */}
            <Dialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 1,
                        mx: 2,
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
                    클럽 기본정보 수정
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {/* 클럽코드 */}
                        <TextField
                            label="클럽코드"
                            value={group.id}
                            disabled
                            fullWidth
                            size="small"
                            sx={{
                                "& .MuiInputBase-input": {
                                    fontSize: 14,
                                },
                            }}
                        />

                        {/* 종목 */}
                        <FormControl fullWidth size="small">
                            <InputLabel>종목</InputLabel>
                            <Select
                                value={formData.sport}
                                onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                                label="종목"
                                sx={{ fontSize: 14 }}
                            >
                                <MenuItem value="탁구">탁구</MenuItem>
                                <MenuItem value="배드민턴">배드민턴</MenuItem>
                                <MenuItem value="테니스">테니스</MenuItem>
                            </Select>
                        </FormControl>

                        {/* 지역 */}
                        <Stack direction="row" spacing={1}>
                            <FormControl fullWidth size="small">
                                <InputLabel>시/도</InputLabel>
                                <Select
                                    value={formData.region_city}
                                    onChange={(e) => {
                                        setFormData({
                                            ...formData,
                                            region_city: e.target.value,
                                            region_district: "" // 시/도 변경 시 구/군 초기화
                                        });
                                    }}
                                    label="시/도"
                                    sx={{ fontSize: 14 }}
                                >
                                    {Object.keys(REGION_DATA).map((city) => (
                                        <MenuItem key={city} value={city}>{city}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel>구/군</InputLabel>
                                <Select
                                    value={formData.region_district}
                                    onChange={(e) => setFormData({ ...formData, region_district: e.target.value })}
                                    label="구/군"
                                    disabled={!formData.region_city}
                                    sx={{ fontSize: 14 }}
                                >
                                    {formData.region_city && REGION_DATA[formData.region_city]?.map((district) => (
                                        <MenuItem key={district} value={district}>{district}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>

                        {/* 클럽명 */}
                        <TextField
                            label="클럽명"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            fullWidth
                            size="small"
                            sx={{
                                "& .MuiInputBase-input": {
                                    fontSize: 14,
                                },
                            }}
                        />

                        {/* 리더 */}
                        <TextField
                            label="리더"
                            value={group.creator_name || ""}
                            disabled
                            fullWidth
                            size="small"
                            sx={{
                                "& .MuiInputBase-input": {
                                    fontSize: 14,
                                },
                            }}
                        />

                        {/* 창단일 */}
                        <TextField
                            label="창단일"
                            type="date"
                            value={formData.founded_at}
                            onChange={(e) => setFormData({ ...formData, founded_at: e.target.value })}
                            fullWidth
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            sx={{
                                "& .MuiInputBase-input": {
                                    fontSize: 14,
                                },
                            }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
                    {isOwner && (
                        <Button
                            onClick={() => {
                                setEditDialogOpen(false);
                                setDeleteDialogOpen(true);
                            }}
                            sx={{
                                borderRadius: 1,
                                px: 3,
                                fontWeight: 700,
                                color: "error.main",
                            }}
                        >
                            클럽 삭제
                        </Button>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Button
                        onClick={() => setEditDialogOpen(false)}
                        sx={{
                            borderRadius: 1,
                            px: 3,
                            fontWeight: 700,
                            color: "text.secondary",
                        }}
                    >
                        취소
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        disabled={isUpdating}
                        onClick={handleUpdateGroup}
                        sx={{
                            borderRadius: 1,
                            px: 3,
                            fontWeight: 700,
                        }}
                    >
                        {isUpdating ? "수정 중..." : "수정"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 클럽 탈퇴 확인 다이얼로그 */}
            <Dialog
                open={leaveDialogOpen}
                onClose={() => setLeaveDialogOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 1, mx: 2 } }}
            >
                <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
                    클럽 탈퇴
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        정말로 "{group.name}" 클럽에서 탈퇴하시겠습니까?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button
                        onClick={() => setLeaveDialogOpen(false)}
                        sx={{ borderRadius: 1, px: 3, fontWeight: 700, color: "text.secondary" }}
                    >
                        취소
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        disableElevation
                        disabled={isLeaving}
                        onClick={handleLeaveGroup}
                        sx={{ borderRadius: 1, px: 3, fontWeight: 700 }}
                    >
                        {isLeaving ? "탈퇴 중..." : "탈퇴"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 클럽 삭제 확인 다이얼로그 */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 1,
                        mx: 2,
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
                    클럽 삭제
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        정말로 "{group.name}" 클럽을 삭제하시겠습니까?
                    </Typography>
                    <Typography sx={{ mt: 1, color: "error.main", fontSize: 14 }}>
                        이 작업은 되돌릴 수 없으며, 모든 클럽 데이터가 삭제됩니다.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        sx={{
                            borderRadius: 1,
                            px: 3,
                            fontWeight: 700,
                            color: "text.secondary",
                        }}
                    >
                        취소
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        disableElevation
                        disabled={isDeleting}
                        onClick={handleDeleteGroup}
                        sx={{
                            borderRadius: 1,
                            px: 3,
                            fontWeight: 700,
                        }}
                    >
                        {isDeleting ? "삭제 중..." : "삭제"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 클럽 초대 다이얼로그 */}
            <Dialog
                open={inviteDialogOpen}
                onClose={() => setInviteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 1,
                        mx: 2,
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
                    클럽 초대하기
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ pt: 1, alignItems: "center" }}>
                        {/* QR 코드 */}
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: "#fff",
                                borderRadius: 1,
                                border: "1px solid #E0E0E0",
                            }}
                        >
                            <QRCode
                                value={`${window.location.origin}/group/${id}/join`}
                                size={200}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            />
                        </Box>

                        {/* 초대 링크 */}
                        <Box sx={{ width: "100%" }}>
                            <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ mb: 0.5 }}>
                                초대 링크
                            </Typography>
                            <TextField
                                value={`${window.location.origin}/group/${id}/join`}
                                fullWidth
                                size="small"
                                InputProps={{
                                    readOnly: true,
                                }}
                                sx={{
                                    "& .MuiInputBase-input": {
                                        fontSize: 13,
                                    },
                                }}
                            />
                        </Box>

                        {/* 공유 버튼 */}
                        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={() => {
                                    // KakaoTalk 공유 (추후 구현)
                                    alert("카카오톡 공유 기능은 준비 중입니다.");
                                }}
                                sx={{
                                    borderRadius: 1,
                                    py: 1.2,
                                    fontWeight: 700,
                                    borderColor: "#FEE500",
                                    color: "#000",
                                    "&:hover": {
                                        borderColor: "#FEE500",
                                        bgcolor: "rgba(254, 229, 0, 0.1)",
                                    },
                                }}
                            >
                                카카오톡 공유
                            </Button>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={() => {
                                    const link = `${window.location.origin}/group/${id}/join`;
                                    const message = `${group.name} 클럽에 초대합니다! ${link}`;
                                    window.location.href = `sms:?body=${encodeURIComponent(message)}`;
                                }}
                                sx={{
                                    borderRadius: 1,
                                    py: 1.2,
                                    fontWeight: 700,
                                }}
                            >
                                문자 공유
                            </Button>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={async () => {
                                    const link = `${window.location.origin}/group/${id}/join`;
                                    try {
                                        await navigator.clipboard.writeText(link);
                                        alert("링크가 복사되었습니다!");
                                    } catch (err) {
                                        console.error("Failed to copy:", err);
                                        alert("링크 복사에 실패했습니다.");
                                    }
                                }}
                                sx={{
                                    borderRadius: 1,
                                    py: 1.2,
                                    fontWeight: 700,
                                }}
                            >
                                url 복사
                            </Button>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button
                        onClick={() => setInviteDialogOpen(false)}
                        variant="contained"
                        disableElevation
                        sx={{
                            borderRadius: 1,
                            px: 3,
                            fontWeight: 700,
                        }}
                    >
                        닫기
                    </Button>
                </DialogActions>
            </Dialog>

            {selectedParticipant && (
                <ParticipantDetailDialog
                    key={selectedParticipant.participant.id}
                    open={participantDetailOpen}
                    participant={{
                        division: selectedParticipant.participant.division || "",
                        name: selectedParticipant.participant.name,
                        paid: selectedParticipant.participant.paid,
                        arrived: selectedParticipant.participant.arrived,
                        after: selectedParticipant.participant.after,
                    }}
                    onClose={handleCloseParticipantDetail}
                    onSave={handleSaveParticipant}
                />
            )}

            {selectedMember && (
                <MemberEditDialog
                    key={selectedMember.id}
                    open={memberEditOpen}
                    member={selectedMember}
                    onClose={handleCloseMemberEdit}
                    onSave={handleSaveMemberEdit}
                    onRemove={canManage ? handleRemoveMember : undefined}
                    isOwner={isOwner}
                />
            )}
        </Stack>
    );
}
