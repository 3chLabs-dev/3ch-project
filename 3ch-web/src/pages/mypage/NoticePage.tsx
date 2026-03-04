import { useEffect, useState } from "react";
import { Box, Typography, IconButton, Divider, Stack, Pagination } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const LIMIT = 15;

type Notice = {
    id: number;
    title: string;
    created_at: string;
};

type NoticeListResponse = {
    notices: Notice[];
    total: number;
};

export default function NoticePage() {
    const navigate = useNavigate();

    const [items, setItems] = useState<Notice[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const load = async (p: number) => {
        setLoading(true);
        setErr("");

        try {
            const res = await fetch(`${API}/notices?page=${p}&limit=${LIMIT}`);

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `HTTP ${res.status}`);
            }

            const data = (await res.json()) as Partial<NoticeListResponse>;
            setItems(data.notices ?? []);
            setTotal(data.total ?? 0);
        } catch {
            console.error("공지 조회 실패");
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    const onChangePage = (_: unknown, p: number) => {
        setPage(p);
    };

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
                {loading ? (
                    <Typography sx={{ color: "text.secondary", fontSize: 14, py: 2 }}>
                        불러오는 중...
                    </Typography>
                ) : err ? (
                    <Typography sx={{ color: "error.main", fontSize: 14, py: 2 }}>
                        {err}
                    </Typography>
                ) : items.length === 0 ? (
                    <Typography sx={{ color: "text.secondary", fontSize: 14, py: 2 }}>
                        등록된 공지사항이 없습니다.
                    </Typography>
                ) : (
                    <Stack
                        divider={<Divider />}
                        sx={{ border: "1px solid", borderColor: "divider" }}
                    >
                        {items.map((n) => (
                            <Box
                                key={n.id}
                                sx={{
                                    px: 1.5,
                                    py: 1.4,
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                {/* 번호 */}
                                <Typography
                                    sx={{
                                        width: 24,
                                        fontSize: 12,
                                        color: "text.secondary",
                                        mr: 1, // 제목이랑 간격 최소화
                                        flexShrink: 0,
                                    }}
                                >
                                    {n.id}
                                </Typography>

                                {/* 제목 */}
                                <Typography
                                    sx={{
                                        flex: 1,
                                        fontSize: 14,
                                        fontWeight: 800,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {n.title}
                                </Typography>

                                {/* 작성일 */}
                                <Typography
                                    sx={{
                                        fontSize: 12,
                                        color: "text.secondary",
                                        ml: 1.5,
                                        flexShrink: 0,
                                    }}
                                >
                                    {n.created_at.slice(0, 10)}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                )}

                {/* 페이지네이션 */}
                {!loading && !err && total > LIMIT && (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                        <Pagination
                            count={Math.max(1, Math.ceil(total / LIMIT))}
                            page={page}
                            size="small"
                            shape="rounded"
                            onChange={onChangePage}
                        />
                    </Box>
                )}
            </Box>
        </Box>
    );
}