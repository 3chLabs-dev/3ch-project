import { useParams, useNavigate, Navigate } from "react-router-dom";
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
    CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useGetGroupDetailQuery, useJoinGroupMutation } from "../../features/group/groupApi";
import { useAppSelector } from "../../app/hooks";
import { getRoleLabel } from "../../utils/permissions";

const SPORT_EMOJI: Record<string, string> = {
    "탁구": "\uD83C\uDFD3",
    "배드민턴": "\uD83C\uDFF8",
    "테니스": "\uD83C\uDFBE",
};

export default function GroupDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const token = useAppSelector((s) => s.auth.token);
    const authUser = useAppSelector((s) => s.auth.user);
    const isLoggedIn = !!token;

    const { data, isLoading } = useGetGroupDetailQuery(id ?? "", {
        skip: !isLoggedIn || !id,
        refetchOnMountOrArgChange: true,
    });

    const [joinGroup, { isLoading: isJoining }] = useJoinGroupMutation();

    const handleJoin = async () => {
        if (!isLoggedIn) {
            navigate("/login");
            return;
        }
        try {
            await joinGroup(id!).unwrap();
            navigate(`/club/${id}/manage`);
        } catch (error) {
            console.error("Failed to join group:", error);
        }
    };

    if (!isLoggedIn) {
        return <Navigate to={`/login?redirect=/club/${id}`} replace />;
    }

    if (isLoading) {
        return (
            <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
                <CircularProgress />
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
    const isAlreadyMember = !!myRole && myRole !== "" && myRole !== "none";
    const emoji = group.sport ? (SPORT_EMOJI[group.sport] ?? "\uD83C\uDFD3") : "\uD83C\uDFD3";

    return (
        <Stack spacing={2.5} sx={{ pb: 3 }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>
                    클럽 정보
                </Typography>
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

                        {/* 클럽 소개 */}
                        <Typography fontSize={14} color={group.description ? "text.secondary" : "#C0C0C0"} sx={{ whiteSpace: "pre-line", lineHeight: 1.7 }}>
                            {group.description || "클럽 소개를 작성해보세요."}
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>

            {/* 클럽 회원 섹션 */}
            <Box>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1.5 }}>
                    클럽 회원 ({members.length}명)
                </Typography>

                <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    <List disablePadding>
                        <ListItem
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                py: 1.5,
                                px: 2.5,
                                bgcolor: "#f5f5f5",
                            }}
                        >
                            <Typography fontWeight={700} fontSize={14} sx={{ flex: 1, textAlign: "left" }}>구분</Typography>
                            <Typography fontWeight={700} fontSize={14} sx={{ flex: 1, textAlign: "left" }}>부수</Typography>
                            <Typography fontWeight={700} fontSize={14} sx={{ flex: 1, textAlign: "left" }}>이름</Typography>
                        </ListItem>
                        {members.map((member, idx) => (
                            <Box key={member.id}>
                                {idx > 0 && <Divider />}
                                <ListItem
                                    sx={{
                                        py: 1.5,
                                        px: 2.5,
                                        bgcolor: member.role === "owner"
                                            ? "rgba(255, 193, 7, 0.08)"
                                            : member.role === "admin"
                                            ? "rgba(33, 150, 243, 0.08)"
                                            : "transparent",
                                    }}
                                >
                                    <ListItemText sx={{ flex: 1 }}
                                        primary={
                                            <Typography fontWeight={700} fontSize={14}>
                                                {getRoleLabel(member.role)}
                                            </Typography>
                                        }
                                    />
                                    <ListItemText sx={{ flex: 1 }}
                                        primary={
                                            <Typography fontWeight={700} fontSize={14}>
                                                {member.division}
                                            </Typography>
                                        }
                                    />
                                    <ListItemText sx={{ flex: 1 }}
                                        primary={
                                            <Typography fontWeight={700} fontSize={14} sx={{ color: Number(member.user_id) === Number(authUser?.id) ? "#2F80ED" : "inherit" }}>
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

            {/* 가입 / 관리 버튼 */}
            {isAlreadyMember ? (
                <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate(`/club/${id}/manage`)}
                    sx={{ borderRadius: 1, fontWeight: 700 }}
                >
                    클럽 관리
                </Button>
            ) : (
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
                    onClick={handleJoin}
                    disabled={isJoining}
                    sx={{ borderRadius: 1, fontWeight: 700 }}
                >
                    {isJoining ? "가입 중..." : "가입하기"}
                </Button>
                </Box>
            )}
        </Stack>
    );
}
