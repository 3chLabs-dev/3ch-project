import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
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
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    FormControl,
    InputLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import SettingsIcon from "@mui/icons-material/Settings";
import QRCode from "react-qr-code";
import { useAppSelector } from "../../app/hooks";
import { useGetGroupDetailQuery, useUpdateMemberRoleMutation, useUpdateGroupMutation, useDeleteGroupMutation } from "../../features/group/groupApi";
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
    });

    const [updateMemberRole] = useUpdateMemberRoleMutation();
    const [updateGroup, { isLoading: isUpdating }] = useUpdateGroupMutation();
    const [deleteGroup, { isLoading: isDeleting }] = useDeleteGroupMutation();
    const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; userId: string } | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        sport: "",
        region_city: "",
        region_district: "",
        founded_at: "",
    });

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
                <Typography>모임을 찾을 수 없습니다.</Typography>
            </Box>
        );
    }

    const { group, members, myRole } = data;
    const canManage = myRole === "owner" || myRole === "admin";
    const isOwner = myRole === "owner";
    const emoji = group.sport ? (SPORT_EMOJI[group.sport] ?? "🏓") : "🏓";

    const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>, userId: string) => {
        setMenuAnchor({ element: event.currentTarget, userId });
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
    };

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

    const handleChangeRole = async (newRole: "member" | "admin") => {
        if (!menuAnchor || !id) return;
        try {
            await updateMemberRole({
                groupId: id,
                userId: menuAnchor.userId,
                role: newRole,
            }).unwrap();
            handleCloseMenu();
        } catch (error) {
            console.error("Failed to update role:", error);
        }
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

    return (
        <Stack spacing={2.5} sx={{ pb: 3 }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate("/group")} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>
                    모임 정보
                </Typography>
                {isOwner && (
                    <IconButton size="small" onClick={handleOpenEditDialog}>
                        <EditIcon />
                    </IconButton>
                )}
            </Stack>

            {/* 모임 정보 카드 */}
            <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <CardContent sx={{ py: 2.5, px: 2.5, "&:last-child": { pb: 2.5 } }}>
                    <Stack spacing={2}>
                        {/* 모임명 + 이모지 + 지역 */}
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
                            spacing={3}
                            sx={{
                                bgcolor: "#F9FAFB",
                                borderRadius: 1,
                                px: 2,
                                py: 1.5,
                            }}
                        >
                            <Box>
                                <Typography fontSize={12} color="text.secondary" fontWeight={600}>
                                    종목
                                </Typography>
                                <Typography fontWeight={800} fontSize={14}>
                                    {group.sport || "-"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography fontSize={12} color="text.secondary" fontWeight={600}>
                                    창단일
                                </Typography>
                                <Typography fontWeight={800} fontSize={14}>
                                    {group.founded_at ? new Date(group.founded_at).toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "") : "-"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography fontSize={12} color="text.secondary" fontWeight={600}>
                                    회원수
                                </Typography>
                                <Typography fontWeight={800} fontSize={14}>
                                    {members.length}
                                </Typography>
                            </Box>
                        </Stack>

                        {/* 리그·대회 개최내역 */}
                        <Button
                            variant="outlined"
                            fullWidth
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

            {/* 모임원 섹션 */}
            <Box>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1.5 }}>
                    모임원
                </Typography>

                <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    <List disablePadding>
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
                                            <Typography fontSize={12} color="text.secondary" fontWeight={600}>
                                                {getRoleLabel(member.role)}
                                            </Typography>
                                            {isOwner && member.role !== "owner" && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => handleOpenMenu(e, String(member.user_id))}
                                                >
                                                    <SettingsIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </Stack>
                                    }
                                >
                                    <ListItemText
                                        primary={
                                            <Typography fontWeight={700} fontSize={14}>
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

            {/* 모임 초대 버튼 */}
            {canManage && (
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
                    모임 초대
                </Button>
            )}

            {/* 권한 변경 메뉴 */}
            <Menu
                anchorEl={menuAnchor?.element}
                open={Boolean(menuAnchor)}
                onClose={handleCloseMenu}
            >
                <MenuItem onClick={() => handleChangeRole("admin")}>
                    운영진으로 임명
                </MenuItem>
                <MenuItem onClick={() => handleChangeRole("member")}>
                    일반 멤버로 변경
                </MenuItem>
            </Menu>

            {/* 모임 정보 수정 다이얼로그 */}
            <Dialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        mx: 2,
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
                    모임 기본정보 수정
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {/* 모임코드 */}
                        <TextField
                            label="모임코드"
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

                        {/* 모임명 */}
                        <TextField
                            label="모임명"
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

                        {/* 모임장 */}
                        <TextField
                            label="모임장"
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
                            모임 삭제
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

            {/* 모임 삭제 확인 다이얼로그 */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        mx: 2,
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
                    모임 삭제
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        정말로 "{group.name}" 모임을 삭제하시겠습니까?
                    </Typography>
                    <Typography sx={{ mt: 1, color: "error.main", fontSize: 14 }}>
                        이 작업은 되돌릴 수 없으며, 모든 모임 데이터가 삭제됩니다.
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

            {/* 모임 초대 다이얼로그 */}
            <Dialog
                open={inviteDialogOpen}
                onClose={() => setInviteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        mx: 2,
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
                    모임 초대하기
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
                                    const message = `${group.name} 모임에 초대합니다! ${link}`;
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
        </Stack>
    );
}
