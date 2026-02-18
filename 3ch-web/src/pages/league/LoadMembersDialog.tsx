import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Typography,
    Box,
    TextField,
    InputAdornment,
    Checkbox,
    Button,
    Divider,
    Pagination,
    Stack,
    CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { useAppSelector } from "../../app/hooks";
import axios from "axios";

export type MemberRow = {
    id: string;
    division: string;
    name: string;
};

type GroupMember = {
    id: string;
    user_id: number;
    name?: string | null;
    email: string;
    role: string;
    division?: string | null;
    joined_at: string;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onConfirm: (selected: MemberRow[]) => void;
};

export default function LoadMembersDialog({
    open,
    onClose,
    onConfirm,
}: Props) {
    const groupId = useAppSelector((s) => s.leagueCreation.groupId);
    const preferredGroupId = useAppSelector((s) => s.leagueCreation.preferredGroupId);
    const effectiveGroupId = groupId || preferredGroupId;
    const token = useAppSelector((s) => s.auth.token);

    const [rows, setRows] = useState<MemberRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState("클럽 회원");

    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [checked, setChecked] = useState<Record<string, boolean>>({});

    const pageSize = 5;

    // 클럽 멤버 불러오기
    useEffect(() => {
        if (!open) return;
        if (!effectiveGroupId) {
            setRows([]);
            setError("클럽이 선택되지 않았습니다. 리그 메인에서 클럽을 먼저 선택해 주세요.");
            return;
        }
        if (!token) {
            setRows([]);
            setError("로그인이 필요합니다.");
            return;
        }

        const fetchMembers = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(
                    `${import.meta.env.VITE_API_BASE_URL}/group/${effectiveGroupId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const { group, members } = response.data as {
                    group: { name?: string };
                    members: GroupMember[];
                };
                setGroupName(group?.name || "클럽 회원");

                const memberRows: MemberRow[] = members.map((m) => ({
                    id: String(m.user_id),
                    division: (m.division ?? "").trim(),
                    name: (m.name ?? m.email ?? "").trim(),
                }));

                setRows(memberRows);
            } catch (err) {
                console.error("Error fetching group members:", err);
                setError("클럽 멤버를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchMembers();
    }, [open, effectiveGroupId, token]);

    const filtered = useMemo(() => {
        const keyword = q.trim().toLowerCase();
        if (!keyword) return rows;
        return rows.filter((r) =>
            `${r.name} ${r.division}`.toLowerCase().includes(keyword)
        );
    }, [q, rows]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const view = filtered.slice((page - 1) * pageSize, page * pageSize);

    const selectedList = useMemo(
        () => rows.filter((r) => checked[r.id]),
        [rows, checked]
    );

    const toggle = (id: string) =>
        setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

    const resetLocal = () => {
        setQ("");
        setPage(1);
        setChecked({});
    };

    const handleClose = () => {
        resetLocal();
        onClose();
    };

    const handleConfirm = () => {
        onConfirm(selectedList);
        resetLocal();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            maxWidth="xs"
            PaperProps={{
                sx: {
                    borderRadius: 1,
                    overflow: "hidden",
                    maxWidth: 430,
                },
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{groupName}</Typography>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                <TextField
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                    }}
                    placeholder="클럽 회원 검색"
                    size="small"
                    fullWidth
                    disabled={loading}
                    sx={{
                        mt: 1,
                        "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: "#fff" },
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ pt: 1.2 }}>
                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress size={32} />
                    </Box>
                ) : error ? (
                    <Typography sx={{ color: "#E53935", textAlign: "center", py: 3 }}>
                        {error}
                    </Typography>
                ) : (
                    <>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "34px 1fr 1fr",
                                alignItems: "center",
                                px: 0.5,
                                mb: 0.7,
                            }}
                        >
                            <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 900 }}>선택</Typography>
                            <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 900, textAlign: "center" }}>
                                부수
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 900 }}>
                                이름
                            </Typography>
                        </Box>

                        <Divider sx={{ mb: 1 }} />

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                            {view.map((r) => (
                                <Box
                                    key={r.id}
                                    onClick={() => toggle(r.id)}
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: "34px 1fr 1fr",
                                        alignItems: "center",
                                        px: 0.5,
                                        py: 0.6,
                                        cursor: "pointer",
                                        borderRadius: 1,
                                        "&:hover": { bgcolor: "#F3F4F6" },
                                    }}
                                >
                                    <Checkbox checked={!!checked[r.id]} size="small" />
                                    <Typography sx={{ textAlign: "center", fontWeight: 800 }}>
                                        {r.division}
                                    </Typography>
                                    <Typography sx={{ fontWeight: 800 }}>{r.name}</Typography>
                                </Box>
                            ))}

                            {view.length === 0 && (
                                <Typography sx={{ color: "#6B7280", textAlign: "center", py: 3 }}>
                                    검색 결과가 없습니다.
                                </Typography>
                            )}
                        </Box>

                        <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
                            <Pagination
                                count={pageCount}
                                page={page}
                                onChange={(_, p) => setPage(p)}
                                size="small"
                            />
                        </Box>
                    </>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 2, pb: 2 }}>
                <Stack direction="row" spacing={1.5} sx={{ width: "100%" }}>
                    <Button
                        fullWidth
                        variant="contained"
                        disableElevation
                        onClick={handleClose}
                        sx={{
                            borderRadius: 1,
                            height: 40,
                            fontWeight: 900,
                            bgcolor: "#BDBDBD",
                            "&:hover": { bgcolor: "#BDBDBD" },
                        }}
                    >
                        취소
                    </Button>

                    <Button
                        fullWidth
                        variant="contained"
                        disableElevation
                        onClick={handleConfirm}
                        disabled={selectedList.length === 0 || loading}
                        sx={{
                            borderRadius: 1,
                            height: 40,
                            fontWeight: 900,
                            bgcolor: "#2F80ED",
                            "&:hover": { bgcolor: "#256FD1" },
                            "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" },
                        }}
                    >
                        완료
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}
