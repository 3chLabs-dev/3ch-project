import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
    Box,
    Stack,
    Typography,
    Card,
    CardContent,
    Button,
    Chip,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Divider,
    Menu,
    MenuItem,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAppSelector } from "../../app/hooks";
import { useGetGroupDetailQuery, useUpdateMemberRoleMutation } from "../../features/group/groupApi";
import { getRoleLabel } from "../../utils/permissions";

export default function GroupManage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const token = useAppSelector((s) => s.auth.token);
    const isLoggedIn = !!token;

    const { data, isLoading } = useGetGroupDetailQuery(id || "", {
        skip: !isLoggedIn || !id,
    });

    const [updateMemberRole] = useUpdateMemberRoleMutation();
    const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; userId: string } | null>(null);

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

    if (!canManage) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>관리 권한이 없습니다.</Typography>
                <Button onClick={() => navigate("/group")} sx={{ mt: 2 }}>
                    돌아가기
                </Button>
            </Box>
        );
    }

    const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>, userId: string) => {
        setMenuAnchor({ element: event.currentTarget, userId });
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
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

    return (
        <Stack spacing={2.5} sx={{ pb: 3 }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate("/group")} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>
                    모임 관리
                </Typography>
                <IconButton size="small">
                    <SettingsIcon />
                </IconButton>
            </Stack>

            {/* 모임 정보 카드 */}
            <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <CardContent sx={{ py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
                    <Stack spacing={1.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography fontWeight={800} fontSize={18}>
                                {group.name}
                            </Typography>
                            <Chip
                                label={getRoleLabel(myRole)}
                                size="small"
                                sx={{
                                    bgcolor: myRole === "owner" ? "#FEE2E2" : "#DBEAFE",
                                    color: myRole === "owner" ? "#991B1B" : "#1E40AF",
                                    fontWeight: 700,
                                    fontSize: 11,
                                }}
                            />
                        </Stack>
                        {group.description && (
                            <Typography color="text.secondary" fontSize={14}>
                                {group.description}
                            </Typography>
                        )}
                        <Stack direction="row" spacing={2}>
                            <Typography fontSize={13} color="text.secondary">
                                생성일: {new Date(group.created_at).toLocaleDateString()}
                            </Typography>
                            <Typography fontSize={13} color="text.secondary">
                                멤버: {members.length}명
                            </Typography>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            {/* 멤버 관리 섹션 */}
            <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={900}>
                        멤버 목록
                    </Typography>
                    <Button
                        startIcon={<PersonAddIcon />}
                        size="small"
                        variant="outlined"
                        sx={{ borderRadius: 1, fontWeight: 700 }}
                    >
                        멤버 추가
                    </Button>
                </Stack>

                <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    <List disablePadding>
                        {members.map((member, idx) => (
                            <Box key={member.id}>
                                {idx > 0 && <Divider />}
                                <ListItem
                                    sx={{ py: 1.5, px: 2.5 }}
                                    secondaryAction={
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Chip
                                                label={getRoleLabel(member.role)}
                                                size="small"
                                                sx={{
                                                    bgcolor: member.role === "owner"
                                                        ? "#FEE2E2"
                                                        : member.role === "admin"
                                                        ? "#DBEAFE"
                                                        : "#F3F4F6",
                                                    color: member.role === "owner"
                                                        ? "#991B1B"
                                                        : member.role === "admin"
                                                        ? "#1E40AF"
                                                        : "#374151",
                                                    fontWeight: 600,
                                                    fontSize: 11,
                                                    height: 22,
                                                }}
                                            />
                                            {isOwner && member.role !== "owner" && (
                                                <Button
                                                    size="small"
                                                    onClick={(e) => handleOpenMenu(e, String(member.user_id))}
                                                    sx={{
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        minWidth: "auto",
                                                        px: 1,
                                                    }}
                                                >
                                                    관리
                                                </Button>
                                            )}
                                        </Stack>
                                    }
                                >
                                    <ListItemText
                                        primary={
                                            <Typography fontWeight={700} fontSize={15}>
                                                {member.name || member.email}
                                            </Typography>
                                        }
                                        secondary={
                                            <Typography fontSize={12} color="text.secondary">
                                                가입일: {new Date(member.joined_at).toLocaleDateString()}
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                            </Box>
                        ))}
                    </List>
                </Card>
            </Box>

            {/* 관리 메뉴 */}
            <Box>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1.5 }}>
                    모임 관리
                </Typography>
                <Stack spacing={1}>
                    <Button
                        fullWidth
                        variant="outlined"
                        sx={{ borderRadius: 1, fontWeight: 700, py: 1.2, justifyContent: "flex-start", px: 2 }}
                    >
                        모임 정보 수정
                    </Button>
                    {isOwner && (
                        <>
                            <Button
                                fullWidth
                                variant="outlined"
                                sx={{ borderRadius: 1, fontWeight: 700, py: 1.2, justifyContent: "flex-start", px: 2 }}
                            >
                                운영진 관리
                            </Button>
                            <Button
                                fullWidth
                                variant="outlined"
                                color="error"
                                sx={{ borderRadius: 1, fontWeight: 700, py: 1.2, justifyContent: "flex-start", px: 2 }}
                            >
                                모임 삭제
                            </Button>
                        </>
                    )}
                </Stack>
            </Box>

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
        </Stack>
    );
}
