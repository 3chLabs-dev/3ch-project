import { useEffect, useMemo, useState } from "react";
import {
    Box, Typography, IconButton, Stack, Pagination,
    Card, Chip, Collapse,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const LIMIT = 20;

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${iso.slice(0, 10)}(${DAYS[d.getDay()]})`;
};

const CATEGORY_STYLE: Record<string, { bgcolor: string; color: string }> = {
    "중요":   { bgcolor: "#FFF7ED", color: "#C2410C" },
    "약관":   { bgcolor: "#F0F9FF", color: "#0369A1" },
    "이벤트": { bgcolor: "#FDF4FF", color: "#7E22CE" },
    "안내":   { bgcolor: "#F3F4F6", color: "#6B7280" },
};

type Notice = { id: number; category: string; title: string; created_at: string };
type NoticeDetail = { id: number; title: string; content: string; created_at: string };

export default function NoticePage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Notice[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [details, setDetails] = useState<Record<number, NoticeDetail>>({});
    const [loadingId, setLoadingId] = useState<number | null>(null);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / LIMIT)), [total]);

    const loadList = async (p: number) => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/notices?page=${p}&limit=${LIMIT}`);
            const data = await res.json();
            setItems(data.notices ?? []);
            setTotal(data.total ?? 0);
        } finally {
            setLoading(false);
        }
    };

    const handleExpand = async (id: number) => {
        if (expandedId === id) { setExpandedId(null); return; }
        setExpandedId(id);
        if (details[id]) return;
        setLoadingId(id);
        try {
            const res = await fetch(`${API}/notices/${id}`);
            const data = await res.json();
            setDetails((prev) => ({ ...prev, [id]: data }));
        } finally {
            setLoadingId(null);
        }
    };

    useEffect(() => { loadList(page); }, [page]);

    return (
        <Stack spacing={2.5} sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>공지사항</Typography>
            </Stack>

            {loading ? (
                <Typography color="text.secondary" fontSize={14} textAlign="center" sx={{ py: 4 }}>불러오는 중...</Typography>
            ) : items.length === 0 ? (
                <Card elevation={0} sx={{ borderRadius: 1.5, border: "1px solid #E5E7EB", textAlign: "center", py: 6 }}>
                    <CampaignOutlinedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                    <Typography color="text.secondary" fontWeight={700}>공지사항이 없습니다.</Typography>
                </Card>
            ) : (
                <Stack spacing={1}>
                    {items.map((n) => {
                        const isOpen = expandedId === n.id;
                        const catStyle = CATEGORY_STYLE[n.category] ?? CATEGORY_STYLE["안내"];
                        return (
                            <Card
                                key={n.id}
                                elevation={0}
                                sx={{ borderRadius: 2, border: "1px solid", borderColor: isOpen ? "primary.light" : "#E5E7EB", overflow: "hidden", transition: "border-color 0.15s" }}
                            >
                                {/* 헤더 행 */}
                                <Box
                                    onClick={() => handleExpand(n.id)}
                                    sx={{
                                        px: 2, py: 1.5,
                                        display: "flex", alignItems: "center", gap: 1.2,
                                        cursor: "pointer",
                                        bgcolor: isOpen ? "#F8FAFF" : "#fff",
                                        "&:hover": { bgcolor: isOpen ? "#F0F4FF" : "#F9FAFB" },
                                        transition: "background 0.15s",
                                    }}
                                >
                                    <Chip
                                        label={n.category || "안내"}
                                        size="small"
                                        sx={{ height: 20, fontSize: 11, fontWeight: 700, flexShrink: 0, ...catStyle }}
                                    />
                                    <Typography
                                        fontSize={14} fontWeight={700} flex={1}
                                        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                    >
                                        {n.title}
                                    </Typography>
                                    <Typography fontSize={12} color="text.disabled" fontWeight={600} sx={{ flexShrink: 0 }}>
                                        {formatDate(n.created_at)}
                                    </Typography>
                                    <ExpandMoreIcon sx={{
                                        fontSize: 18, color: "text.disabled", flexShrink: 0,
                                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                        transition: "transform 0.2s",
                                    }} />
                                </Box>

                                {/* 펼쳐지는 내용 */}
                                <Collapse in={isOpen} timeout="auto">
                                    <Box sx={{ px: 2.5, py: 2, bgcolor: "#FAFAFA", borderTop: "1px solid #E5E7EB" }}>
                                        {loadingId === n.id ? (
                                            <Typography fontSize={13} color="text.secondary">불러오는 중...</Typography>
                                        ) : (
                                            <Box
                                                className="tiptap-content"
                                                dangerouslySetInnerHTML={{ __html: details[n.id]?.content ?? "" }}
                                                sx={{
                                                    fontSize: 14, lineHeight: 1.9, color: "text.primary",
                                                    "& a": { color: "primary.main", textDecoration: "underline" },
                                                    "& strong": { fontWeight: 700 },
                                                    "& ul, & ol": { pl: 2.5 },
                                                    "& img": { maxWidth: "100%", borderRadius: 1 },
                                                    "& p": { m: 0 },
                                                }}
                                            />
                                        )}
                                    </Box>
                                </Collapse>
                            </Card>
                        );
                    })}
                </Stack>
            )}

            {!loading && total > LIMIT && (
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Pagination count={totalPages} page={page} size="small" shape="rounded" onChange={(_, p) => setPage(p)} />
                </Box>
            )}
        </Stack>
    );
}