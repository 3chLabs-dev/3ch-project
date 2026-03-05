import { useParams, useNavigate } from "react-router-dom";
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
        return (
            <Box sx={{ p: 2 }}>
                <Typography>로그인이 필요합니다.</Typography>
            </Box>
        );
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

                        {/* 기본 정보 */}
                        <Stack
                            direction="row"
                            sx={{
                                bgcolor: "#F9FAFB",
                                borderRadius: 1,
                                px: 2,
                                py: 1.5,
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                alignItems: "center",
                                textAlign: "center",
                            }}
                        >
                            <Box>
                                <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ textAlign: "center" }}>
                                    종목
                                </Typography>
                                <Typography fontWeight={800} fontSize={14} sx={{ textAlign: "center" }}>
                                    {group.sport || "-"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ textAlign: "center" }}>
                                    창단일
                                </Typography>
                                <Typography fontWeight={800} fontSize={14} sx={{ textAlign: "center" }}>
                                    {group.founded_at
                                        ? new Date(group.founded_at).toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "")
                                        : "-"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ textAlign: "center" }}>
                                    회원수
                                </Typography>
                                <Typography fontWeight={800} fontSize={14} sx={{ textAlign: "center" }}>
                                    {members.length}
                                </Typography>
                            </Box>
                        </Stack>
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
                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleJoin}
                    disabled={isJoining}
                    sx={{ borderRadius: 1, fontWeight: 700 }}
                >
                    {isJoining ? "가입 중..." : "가입하기"}
                </Button>
            )}
        </Stack>
    );
}
