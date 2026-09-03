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
    MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { useAppSelector } from "../../app/hooks";
import { useLazyGetGroupDetailQuery } from "../../features/group/groupApi";

export type MemberRow = {
    id: string;
    member_id: number | null;
    division: string;
    name: string;
    is_pre_member?: boolean;
    role?: string;
    claim_status?: string | null;
    joined_at?: string | null;
};

type MemberSortOption = "division" | "name" | "joinedAt";

const MEMBER_SORT_OPTIONS: Array<{ value: MemberSortOption; label: string }> = [
    { value: "division", label: "부수 순" },
    { value: "name", label: "이름 순" },
    { value: "joinedAt", label: "가입일 순" },
];

const compareMemberName = (left: MemberRow, right: MemberRow) =>
    left.name.localeCompare(right.name, "ko", { numeric: true, sensitivity: "base" });

const divisionSortKey = (division?: string | null) => {
    const normalized = division?.trim() ?? "";
    if (!normalized) return { category: 2, number: Number.POSITIVE_INFINITY, text: "" };
    const leadingNumber = normalized.match(/^\d+(?:\.\d+)?/)?.[0];
    if (leadingNumber) return { category: 0, number: Number(leadingNumber), text: normalized };
    return { category: 1, number: Number.POSITIVE_INFINITY, text: normalized };
};

type Props = {
    open: boolean;
    onClose: () => void;
    onConfirm: (selected: MemberRow[]) => void;
    /** 외부에서 groupId를 직접 전달할 경우 Redux 값 대신 사용 */
    groupId?: string;
};

export default function LoadMembersDialog({
    open,
    onClose,
    onConfirm,
    groupId: propGroupId,
}: Props) {
    const reduxGroupId = useAppSelector((s) => s.leagueCreation.groupId);
    const preferredGroupId = useAppSelector((s) => s.leagueCreation.preferredGroupId);
    const effectiveGroupId = propGroupId || reduxGroupId || preferredGroupId;
    const token = useAppSelector((s) => s.auth.token);
    const [getGroupDetail] = useLazyGetGroupDetailQuery();

    const [rows, setRows] = useState<MemberRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groupName, setGroupName] = useState("클럽 회원");

    const [q, setQ] = useState("");
    const [memberSort, setMemberSort] = useState<MemberSortOption>("division");
    const [page, setPage] = useState(1);
    const [checked, setChecked] = useState<Record<string, boolean>>({});

    const pageSize = 20;

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
                const { group, members } = await getGroupDetail(effectiveGroupId, true).unwrap();
                setGroupName(group?.name || "클럽 회원");

                const memberRows: MemberRow[] = members.map((m) => ({
                    id: m.is_pre_member ? `pre:${m.id}` : `member:${m.user_id}`,
                    member_id: m.user_id,
                    division: (m.division ?? "").trim(),
                    name: (m.name ?? m.email ?? "").trim(),
                    is_pre_member: m.is_pre_member,
                    role: m.role,
                    claim_status: m.claim_status,
                    joined_at: m.joined_at,
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
    }, [open, effectiveGroupId, getGroupDetail]);

    const filtered = useMemo(() => {
        const keyword = q.trim().toLowerCase();
        const matchingRows = keyword ? rows.filter((r) =>
            `${r.name} ${r.division}`.toLowerCase().includes(keyword)
        ) : rows;

        return [...matchingRows].sort((left, right) => {
            if (memberSort === "name") return compareMemberName(left, right);
            if (memberSort === "joinedAt") {
                const leftTime = Date.parse(left.joined_at ?? "") || Number.MAX_SAFE_INTEGER;
                const rightTime = Date.parse(right.joined_at ?? "") || Number.MAX_SAFE_INTEGER;
                return leftTime - rightTime || compareMemberName(left, right);
            }

            const leftDivision = divisionSortKey(left.division);
            const rightDivision = divisionSortKey(right.division);
            if (leftDivision.category !== rightDivision.category) return leftDivision.category - rightDivision.category;
            if (leftDivision.category === 0 && leftDivision.number !== rightDivision.number) {
                return leftDivision.number - rightDivision.number;
            }
            if (leftDivision.category === 1) {
                const textDifference = leftDivision.text.localeCompare(rightDivision.text, "ko", { numeric: true, sensitivity: "base" });
                if (textDifference !== 0) return textDifference;
            }
            return compareMemberName(left, right);
        });
    }, [memberSort, q, rows]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const view = filtered.slice((page - 1) * pageSize, page * pageSize);

    const selectedList = useMemo(
        () => rows.filter((r) => checked[r.id]),
        [rows, checked]
    );

    const selectedPageCount = view.reduce(
        (count, row) => count + (checked[row.id] ? 1 : 0),
        0
    );
    const isCurrentPageSelected =
        view.length > 0 && selectedPageCount === view.length;
    const isCurrentPageIndeterminate =
        selectedPageCount > 0 && selectedPageCount < view.length;

    const toggle = (id: string) =>
        setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

    const toggleCurrentPage = () => {
        if (view.length === 0) return;
        setChecked((prev) => {
            const next = { ...prev };
            const shouldSelect = !view.every((row) => prev[row.id]);
            view.forEach((row) => {
                next[row.id] = shouldSelect;
            });
            return next;
        });
    };

    const resetLocal = () => {
        setQ("");
        setMemberSort("division");
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

                <TextField
                    select
                    label="정렬"
                    value={memberSort}
                    onChange={(event) => {
                        setMemberSort(event.target.value as MemberSortOption);
                        setPage(1);
                    }}
                    size="small"
                    fullWidth
                    disabled={loading}
                    sx={{
                        mt: 1,
                        "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: "#fff" },
                    }}
                >
                    {MEMBER_SORT_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))}
                </TextField>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ p: 0 }}>
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
                                px: 3.5,
                                py: 1,
                                borderBottom: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Checkbox
                                checked={isCurrentPageSelected}
                                indeterminate={isCurrentPageIndeterminate}
                                disabled={view.length === 0}
                                onChange={toggleCurrentPage}
                                size="small"
                                inputProps={{ "aria-label": "현재 페이지 회원 전체 선택" }}
                                sx={{ p: 0 }}
                            />
                            <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 900, textAlign: "center" }}>
                                부수
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 900, textAlign: "center" }}>
                                이름
                            </Typography>
                        </Box>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, px: 3, pt: 1 }}>
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
                                        {r.division || "-"}
                                    </Typography>
                                    <Typography sx={{ fontWeight: 800, textAlign: "center" }}>{r.name}</Typography>
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
