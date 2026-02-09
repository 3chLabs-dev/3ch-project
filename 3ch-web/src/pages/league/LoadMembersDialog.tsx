import React, { useMemo, useState } from "react";
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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";

export type MemberRow = {
    id: string;
    division: string; // 부수
    name: string;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onConfirm: (selected: MemberRow[]) => void;

    // 나중에 API 붙이면 rows를 prop으로 넣거나, 내부에서 바꾸면 됨
    rows?: MemberRow[];
};

export default function LoadMembersDialog({
    open,
    onClose,
    onConfirm,
    rows = mockRows,
}: Props) {
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [checked, setChecked] = useState<Record<string, boolean>>({});

    const pageSize = 5;

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
                },
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 18 }}>코리아 모임원</Typography>
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
                    placeholder="모임원 검색"
                    size="small"
                    fullWidth
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
                {/* 헤더 */}
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

                {/* 리스트 */}
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

                {/* 페이지네이션 */}
                <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
                    <Pagination
                        count={pageCount}
                        page={page}
                        onChange={(_, p) => setPage(p)}
                        size="small"
                    />
                </Box>
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
                        disabled={selectedList.length === 0}
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

const mockRows: MemberRow[] = [
    { id: "1", division: "1부", name: "가가가" },
    { id: "2", division: "2부", name: "나나나" },
    { id: "3", division: "3부", name: "다다다" },
    { id: "4", division: "4부", name: "라라라" },
    { id: "5", division: "5부", name: "마마마" },
    { id: "6", division: "6부", name: "바바바" },
    { id: "7", division: "7부", name: "사사사" },
];
