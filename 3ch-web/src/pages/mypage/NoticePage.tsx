import { useEffect, useMemo, useState } from "react";
import {
    Box, Typography, IconButton, Divider, Stack, Pagination,
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ButtonBase from "@mui/material/ButtonBase";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const LIMIT = 15;

type Notice = {
    id: number;
    title: string;
    created_at: string;
};

type NoticeDetail = {
    id: number;
    title: string;
    content: string;
    created_at: string
};

type NoticeListResponse = {
    notices: Notice[];
    total: number;
};

export default function NoticePage() {
    const navigate = useNavigate();

    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    const [items, setItems] = useState<Notice[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);


    const [open, setOpen] = useState<boolean>(false);
    const [detail, setDetail] = useState<NoticeDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState<boolean>(false);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / LIMIT)), [total]);

    const loadList = async (p: number): Promise<void> => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/notices?page=${p}&limit=${LIMIT}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as NoticeListResponse; // 서버 응답 확정이면 OK
            setItems(data.notices ?? []);
            setTotal(data.total ?? 0);
        } finally {
            setLoading(false);
        }
    };


    const loadDetail = async (id: number): Promise<void> => {
        setDetailLoading(true);
        setDetail(null);
        setOpen(true);
        try {
            const res = await fetch(`${API}/notices/${id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as NoticeDetail;
            setDetail(data);
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        loadList(page);
    }, [page]);


    return (
        <Box sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <IconButton
                    onClick={() => navigate(-1)}
                    disableRipple
                    sx={{ p: 0, "&:hover": { background: "transparent" } }}
                >
                    <ChevronLeftIcon sx={{ fontSize: 28 }} />
                </IconButton>

                <Typography sx={{ fontSize: 20, fontWeight: 900 }}>공지사항</Typography>
            </Box>

            <Box sx={{ mt: 2, mx: 2 }}>
                <Stack divider={<Divider />} sx={{ border: "1px solid", borderColor: "divider", }}>
                    {items.map((n) => (
                        <Box key={n.id} sx={{ px: 1.5, py: 1.4, display: "flex", alignItems: "center" }}>
                            <Typography sx={{ width: 24, fontSize: 12, color: "text.secondary", mr: 1, flexShrink: 0 }}>
                                {n.id}
                            </Typography>

                            {/* 제목만 클릭 (ButtonBase로 버튼티 제거) */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <ButtonBase
                                    onClick={() => loadDetail(n.id)}
                                    disableRipple
                                    sx={{
                                        display: "block",
                                        width: "100%",
                                        textAlign: "left",
                                        p: 0,
                                        backgroundColor: "transparent",
                                        "&:hover": { backgroundColor: "transparent" },
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: 14,
                                            fontWeight: 800,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {n.title}
                                    </Typography>
                                </ButtonBase>
                            </Box>

                            <Typography sx={{ fontSize: 12, color: "text.secondary", ml: 1.5, flexShrink: 0 }}>
                                {n.created_at.slice(0, 10)}
                            </Typography>
                        </Box>
                    ))}
                </Stack>

                {!loading && total > LIMIT && (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                        <Pagination count={totalPages} page={page} size="small" shape="rounded" onChange={(_, p) => setPage(p)} />
                    </Box>
                )}
            </Box>

            {/* 상세 다이얼로그 */}
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                fullScreen={fullScreen}
                scroll="paper"
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle sx={{ fontWeight: 900, textAlign: "center" }}>
                    {detailLoading ? "불러오는 중..." : detail?.title ?? "공지사항"}
                </DialogTitle>

                <DialogContent dividers>
                    {detailLoading ? (
                        <Typography sx={{ color: "text.secondary", fontSize: 14 }}>불러오는 중...</Typography>
                    ) : (
                        <>
                            <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
                                {detail?.created_at?.slice(0, 10)}
                            </Typography>
                            <Box sx={{ whiteSpace: "pre-line", fontSize: 14, lineHeight: 1.7 }}>
                                {detail?.content ?? ""}
                            </Box>
                        </>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setOpen(false)}>닫기</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}