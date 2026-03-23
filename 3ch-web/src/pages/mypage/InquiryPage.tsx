import { useEffect, useRef, useState } from "react";
import {
    Box, Typography, IconButton, Divider, Stack,
    Dialog, DialogContent, Button, TextField,
    Card, CardContent, Chip,
    useMediaQuery, Select, MenuItem, Checkbox, FormControlLabel,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

const CATEGORIES = ["서비스 이용", "버그 신고", "계정 문의", "결제 문의", "제휴 문의", "기타"] as const;
type Category = typeof CATEGORIES[number];

const EMAIL_DOMAINS = ["naver.com", "gmail.com", "daum.net", "kakao.com", "nate.com", "hotmail.com", "직접입력"] as const;

type Inquiry = {
    id: number;
    category: string;
    title: string;
    status: "pending" | "answered";
    created_at: string;
    replied_at: string | null;
};

type InquiryDetail = {
    id: number;
    category: string;
    title: string;
    content: string;
    contact_email: string | null;
    phone: string | null;
    attachment_path: string | null;
    status: "pending" | "answered";
    reply: string | null;
    replied_at: string | null;
    created_at: string;
};

export default function InquiryPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    const token = useAppSelector((s) => s.auth.token);
    const user = useAppSelector((s) => s.auth.user);

    const [items, setItems] = useState<Inquiry[]>([]);
    const [loading, setLoading] = useState(false);

    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<InquiryDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [writeOpen, setWriteOpen] = useState(false);
    const [category, setCategory] = useState<Category | "">("");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [emailId, setEmailId] = useState("");
    const [emailDomain, setEmailDomain] = useState("naver.com");
    const [emailDomainCustom, setEmailDomainCustom] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [wantEmailReply, setWantEmailReply] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadList = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/inquiries/my`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setItems(data.inquiries ?? []);
        } finally {
            setLoading(false);
        }
    };

    const loadDetail = async (id: number) => {
        setDetailLoading(true);
        setDetail(null);
        setDetailOpen(true);
        try {
            const res = await fetch(`${API}/inquiries/my/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setDetail(await res.json());
        } finally {
            setDetailLoading(false);
        }
    };

    const openWrite = () => {
        setCategory("");
        setTitle("");
        setContent("");
        if (user?.email) {
            const atIdx = user.email.lastIndexOf("@");
            const id = user.email.slice(0, atIdx);
            const domain = user.email.slice(atIdx + 1);
            setEmailId(id);
            const known = EMAIL_DOMAINS.find((d) => d !== "직접입력" && d === domain);
            if (known) {
                setEmailDomain(known);
                setEmailDomainCustom("");
            } else {
                setEmailDomain("직접입력");
                setEmailDomainCustom(domain);
            }
        } else {
            setEmailId("");
            setEmailDomain("naver.com");
            setEmailDomainCustom("");
        }
        setWantEmailReply(true);
        setFile(null);
        setSubmitError("");
        setSubmitted(false);
        setWriteOpen(true);
    };

    const handleSubmit = async () => {
        if (!category) { setSubmitError("문의 유형을 선택해주세요."); return; }
        if (!title.trim()) { setSubmitError("제목을 입력해주세요."); return; }
        if (!content.trim()) { setSubmitError("문의 내용을 입력해주세요."); return; }
        const domain = emailDomain === "직접입력" ? emailDomainCustom.trim() : emailDomain;
        const contactEmail = wantEmailReply && emailId.trim() && domain ? `${emailId.trim()}@${domain}` : undefined;
        setSubmitting(true);
        setSubmitError("");
        try {
            const formData = new FormData();
            formData.append("category", category);
            formData.append("title", title.trim());
            formData.append("content", content.trim());
            if (contactEmail) formData.append("contact_email", contactEmail);
            if (file) formData.append("file", file);
            const res = await fetch(`${API}/inquiries`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setSubmitted(true);
            loadList();
        } catch {
            setSubmitError("문의 등록에 실패했습니다. 다시 시도해주세요.");
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        loadList();
    }, [token]);

    const dialogPaperSx = { borderRadius: fullScreen ? 0 : 2, mx: fullScreen ? 0 : 2 };

    return (
        <Stack spacing={2.5} sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>1:1 문의</Typography>
                {token && (
                    <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        startIcon={<AddIcon />}
                        onClick={openWrite}
                        sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 13 }}
                    >
                        문의하기
                    </Button>
                )}
            </Stack>

            {/* 안내 배너 */}
            {token && (
                <Box sx={{ bgcolor: "#EFF6FF", borderRadius: 1.5, px: 2, py: 1.5 }}>
                    <Typography fontSize={13} color="#1D4ED8" fontWeight={600} lineHeight={1.7}>
                        문의하신 내용은 영업일 기준 1~2일 내에 답변드립니다.<br />
                        이메일 답변을 원하시면 문의 작성 시 이메일 주소를 확인해주세요.
                    </Typography>
                </Box>
            )}

            {/* 목록 */}
            {!token ? (
                <Card elevation={2} sx={{ borderRadius: 1.5 }}>
                    <CardContent sx={{ textAlign: "center", py: 6 }}>
                        <QuestionAnswerOutlinedIcon sx={{ fontSize: 44, color: "text.disabled", mb: 1.5 }} />
                        <Typography color="text.secondary" fontWeight={700} fontSize={15}>로그인 후 문의하실 수 있습니다.</Typography>
                        <Button
                            variant="contained"
                            disableElevation
                            size="small"
                            onClick={() => navigate("/login")}
                            sx={{ mt: 2.5, borderRadius: 1.5, fontWeight: 700, px: 3 }}
                        >
                            로그인
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card elevation={2} sx={{ borderRadius: 1.5, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    {loading ? (
                        <CardContent>
                            <Typography color="text.secondary" fontSize={14} textAlign="center">불러오는 중...</Typography>
                        </CardContent>
                    ) : items.length === 0 ? (
                        <CardContent sx={{ textAlign: "center", py: 6 }}>
                            <QuestionAnswerOutlinedIcon sx={{ fontSize: 44, color: "text.disabled", mb: 1.5 }} />
                            <Typography color="text.secondary" fontWeight={700} fontSize={15}>문의 내역이 없습니다.</Typography>
                            <Typography color="text.secondary" fontSize={13} sx={{ mt: 0.5 }}>
                                궁금한 점이 있으시면 문의해주세요.
                            </Typography>
                        </CardContent>
                    ) : (
                        <Stack divider={<Divider />}>
                            {items.map((item) => (
                                <Box
                                    key={item.id}
                                    onClick={() => loadDetail(item.id)}
                                    sx={{
                                        px: 2.5, py: 2,
                                        display: "flex", alignItems: "center", gap: 1.5,
                                        cursor: "pointer",
                                        "&:hover": { bgcolor: "#F9FAFB" },
                                        transition: "background 0.15s",
                                    }}
                                >
                                    {/* 상태 아이콘 */}
                                    <Box sx={{
                                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                                        bgcolor: item.status === "answered" ? "#D1FAE5" : "#FEF3C7",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        {item.status === "answered"
                                            ? <CheckCircleOutlineIcon sx={{ fontSize: 18, color: "#059669" }} />
                                            : <AccessTimeIcon sx={{ fontSize: 18, color: "#D97706" }} />
                                        }
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.3 }}>
                                            <Chip
                                                label={item.category || "기타"}
                                                size="small"
                                                sx={{ height: 17, fontSize: 10, fontWeight: 700, bgcolor: "#EEF2FF", color: "#4338CA", flexShrink: 0 }}
                                            />
                                            <Chip
                                                label={item.status === "answered" ? "답변완료" : "대기중"}
                                                size="small"
                                                sx={{
                                                    height: 17, fontSize: 10, fontWeight: 700, flexShrink: 0,
                                                    bgcolor: item.status === "answered" ? "#D1FAE5" : "#FEF3C7",
                                                    color: item.status === "answered" ? "#065F46" : "#92400E",
                                                }}
                                            />
                                        </Stack>
                                        <Typography
                                            fontSize={14} fontWeight={700}
                                            sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                        >
                                            {item.title}
                                        </Typography>
                                        <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ mt: 0.2 }}>
                                            {item.created_at.slice(0, 10)}
                                        </Typography>
                                    </Box>
                                    <ChevronRightIcon sx={{ fontSize: 18, color: "text.disabled", flexShrink: 0 }} />
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Card>
            )}

            {/* 상세 다이얼로그 */}
            <Dialog
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                fullScreen={fullScreen}
                scroll="paper"
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <Box sx={{ px: 3, pt: 3.5, pb: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                        <QuestionAnswerOutlinedIcon sx={{ fontSize: 22, color: "primary.main", mt: 0.3, flexShrink: 0 }} />
                        <Box flex={1}>
                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                                {detail?.category && (
                                    <Chip label={detail.category} size="small"
                                        sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: "#EEF2FF", color: "#4338CA" }} />
                                )}
                                {!detailLoading && detail && (
                                    <Chip
                                        label={detail.status === "answered" ? "답변완료" : "대기중"}
                                        size="small"
                                        sx={{
                                            height: 18, fontSize: 10, fontWeight: 700,
                                            bgcolor: detail.status === "answered" ? "#D1FAE5" : "#FEF3C7",
                                            color: detail.status === "answered" ? "#065F46" : "#92400E",
                                        }}
                                    />
                                )}
                            </Stack>
                            <Typography fontWeight={900} fontSize={16} lineHeight={1.4}>
                                {detailLoading ? "불러오는 중..." : detail?.title ?? "문의사항"}
                            </Typography>
                            {!detailLoading && detail?.created_at && (
                                <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ mt: 0.4 }}>
                                    {detail.created_at.slice(0, 10)}
                                </Typography>
                            )}
                        </Box>
                        <IconButton size="small" onClick={() => setDetailOpen(false)} sx={{ mt: -0.5, mr: -1 }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                </Box>

                <DialogContent sx={{ px: 3, py: 2.5 }}>
                    {detailLoading ? (
                        <Typography color="text.secondary" fontSize={14}>불러오는 중...</Typography>
                    ) : (
                        <Stack spacing={2.5}>
                            {/* 연락처 */}
                            {(detail?.contact_email || detail?.phone) && (
                                <Box sx={{ bgcolor: "#F9FAFB", borderRadius: 1.5, px: 2, py: 1.5 }}>
                                    <Typography fontSize={11} fontWeight={700} color="text.disabled" sx={{ mb: 0.6, letterSpacing: 0.5 }}>연락처</Typography>
                                    <Stack spacing={0.3}>
                                        {detail.contact_email && (
                                            <Typography fontSize={13} color="text.secondary">{detail.contact_email}</Typography>
                                        )}
                                        {detail.phone && (
                                            <Typography fontSize={13} color="text.secondary">{detail.phone}</Typography>
                                        )}
                                    </Stack>
                                </Box>
                            )}

                            {/* 첨부파일 */}
                            {detail?.attachment_path && (
                                <Box sx={{ bgcolor: "#F9FAFB", borderRadius: 1.5, px: 2, py: 1.5 }}>
                                    <Typography fontSize={11} fontWeight={700} color="text.disabled" sx={{ mb: 0.6, letterSpacing: 0.5 }}>첨부파일</Typography>
                                    <Box
                                        component="a"
                                        href={`${import.meta.env.VITE_API_BASE_URL?.replace("/api", "") ?? ""}${detail.attachment_path}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{ display: "flex", alignItems: "center", gap: 0.8, color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                                    >
                                        <InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />
                                        <Typography fontSize={13} fontWeight={600}>
                                            {detail.attachment_path.split("/").pop()}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* 문의 내용 */}
                            <Box>
                                <Typography fontSize={11} fontWeight={700} color="text.disabled" sx={{ mb: 0.8, letterSpacing: 0.5 }}>
                                    문의 내용
                                </Typography>
                                <Typography sx={{ whiteSpace: "pre-line", fontSize: 14, lineHeight: 1.9, color: "text.primary" }}>
                                    {detail?.content ?? ""}
                                </Typography>
                            </Box>

                            <Divider />

                            {/* 답변 */}
                            {detail?.reply ? (
                                <Box sx={{ bgcolor: "#F0FDF4", borderRadius: 1.5, p: 2 }}>
                                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 1 }}>
                                        <CheckCircleOutlineIcon sx={{ fontSize: 16, color: "success.main" }} />
                                        <Typography fontSize={12} fontWeight={700} color="success.main">답변</Typography>
                                        {detail.replied_at && (
                                            <Typography fontSize={11} color="text.disabled" fontWeight={600}>
                                                {detail.replied_at.slice(0, 10)}
                                            </Typography>
                                        )}
                                    </Stack>
                                    <Typography sx={{ whiteSpace: "pre-line", fontSize: 14, lineHeight: 1.9, color: "text.primary" }}>
                                        {detail.reply}
                                    </Typography>
                                </Box>
                            ) : (
                                <Box sx={{ bgcolor: "#FFFBEB", borderRadius: 1.5, px: 2, py: 1.8, display: "flex", alignItems: "center", gap: 1 }}>
                                    <AccessTimeIcon sx={{ fontSize: 18, color: "#D97706", flexShrink: 0 }} />
                                    <Typography fontSize={13} color="#92400E" fontWeight={600}>
                                        답변 준비 중입니다. 영업일 기준 1~2일 내에 답변드립니다.
                                    </Typography>
                                </Box>
                            )}
                        </Stack>
                    )}
                </DialogContent>
            </Dialog>

            {/* 문의 작성 다이얼로그 */}
            <Dialog
                open={writeOpen}
                onClose={() => !submitting && setWriteOpen(false)}
                fullScreen={fullScreen}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: dialogPaperSx }}
            >
                <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <QuestionAnswerOutlinedIcon sx={{ fontSize: 22, color: "primary.main", flexShrink: 0 }} />
                        <Typography fontWeight={900} fontSize={16} flex={1}>문의하기</Typography>
                        <IconButton size="small" onClick={() => !submitting && setWriteOpen(false)} sx={{ mr: -1 }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                </Box>

                <DialogContent sx={{ px: 3, py: 2.5 }}>
                    {submitted ? (
                        <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
                            <CheckCircleOutlineIcon sx={{ fontSize: 56, color: "success.main" }} />
                            <Typography fontWeight={900} fontSize={17}>문의가 접수되었습니다!</Typography>
                            <Typography fontSize={14} color="text.secondary" textAlign="center" lineHeight={1.8}>
                                영업일 기준 1~2일 내에 답변드립니다.<br />
                                문의 내역에서 답변을 확인하실 수 있습니다.
                            </Typography>
                            <Button
                                fullWidth
                                variant="contained"
                                disableElevation
                                onClick={() => setWriteOpen(false)}
                                sx={{ mt: 1, borderRadius: 1, fontWeight: 700, py: 1.2 }}
                            >
                                확인
                            </Button>
                        </Stack>
                    ) : (
                        <Stack spacing={2.5}>
                            {/* 문의 유형 */}
                            <Box>
                                <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>문의 유형</Typography>
                                <Stack direction="row" flexWrap="wrap" gap={0.8}>
                                    {CATEGORIES.map((cat) => (
                                        <Chip
                                            key={cat}
                                            label={cat}
                                            onClick={() => setCategory(cat)}
                                            sx={{
                                                fontWeight: 700, fontSize: 13, cursor: "pointer",
                                                bgcolor: category === cat ? "primary.main" : "#F3F4F6",
                                                color: category === cat ? "#fff" : "text.secondary",
                                                "&:hover": { bgcolor: category === cat ? "primary.dark" : "#E5E7EB" },
                                            }}
                                        />
                                    ))}
                                </Stack>
                            </Box>

                            {/* 이메일로 답변 받기 */}
                            <Box>
                                <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={wantEmailReply}
                                                onChange={(e) => setWantEmailReply(e.target.checked)}
                                                size="small"
                                            />
                                        }
                                        label={
                                            <Typography fontSize={13} fontWeight={700}>이메일로 답변 받기</Typography>
                                        }
                                />
                                {wantEmailReply && (
                                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 0.5 }}>
                                        <TextField
                                            value={emailId}
                                            onChange={(e) => setEmailId(e.target.value)}
                                            size="small"
                                            placeholder="아이디"
                                            sx={{ flex: 1 }}
                                            inputProps={{ maxLength: 100 }}
                                        />
                                        <Typography color="text.secondary" fontWeight={700}>@</Typography>
                                        {emailDomain === "직접입력" ? (
                                            <TextField
                                                value={emailDomainCustom}
                                                onChange={(e) => setEmailDomainCustom(e.target.value)}
                                                size="small"
                                                placeholder="직접입력"
                                                sx={{ flex: 1 }}
                                                inputProps={{ maxLength: 100 }}
                                            />
                                        ) : (
                                            <TextField
                                                value={emailDomain}
                                                size="small"
                                                sx={{ flex: 1 }}
                                                slotProps={{ input: { readOnly: true } }}
                                            />
                                        )}
                                        <Select
                                            value={emailDomain}
                                            onChange={(e) => setEmailDomain(e.target.value)}
                                            size="small"
                                            sx={{ minWidth: 36, "& .MuiSelect-select": { py: "8.5px" } }}
                                            renderValue={() => "▼"}
                                        >
                                            {EMAIL_DOMAINS.map((d) => (
                                                <MenuItem key={d} value={d}>{d}</MenuItem>
                                            ))}
                                        </Select>
                                    </Stack>
                                )}
                            </Box>

                            {/* 제목 */}
                            <Box>
                                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
                                    <Typography fontSize={12} fontWeight={700} color="text.secondary">
                                        제목 <Typography component="span" color="error" fontSize={12}>*</Typography>
                                    </Typography>
                                    <Typography fontSize={11} color="text.disabled">{title.length}/20</Typography>
                                </Stack>
                                <TextField
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value.slice(0, 20))}
                                    fullWidth size="small"
                                    placeholder="제목(20자 이내)"
                                    inputProps={{ maxLength: 20 }}
                                />
                            </Box>

                            {/* 문의 내용 */}
                            <Box>
                                <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ mb: 0.8 }}>
                                    문의 내용 <Typography component="span" color="error" fontSize={12}>*</Typography>
                                </Typography>
                                <TextField
                                    value={content}
                                    onChange={(e) => setContent(e.target.value.slice(0, 1000))}
                                    fullWidth multiline rows={5} size="small"
                                    placeholder="내용"
                                    inputProps={{ maxLength: 1000 }}
                                />
                                <Typography fontSize={11} color="text.disabled" textAlign="right" sx={{ mt: 0.5 }}>
                                    {content.length} / 1000
                                </Typography>
                            </Box>

                            {/* 첨부파일 */}
                            <Box sx={{ mt: -1 }}>
                                <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ mb: 0.8 }}>첨부파일</Typography>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    style={{ display: "none" }}
                                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                />
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => fileInputRef.current?.click()}
                                    endIcon={<AttachFileIcon />}
                                    sx={{ justifyContent: "space-between", color: "text.secondary", borderColor: "#D1D5DB", fontWeight: 600, fontSize: 13 }}
                                >
                                    {file ? file.name : "파일첨부"}
                                </Button>
                            </Box>

                            {submitError && (
                                <Box sx={{ bgcolor: "#FEF2F2", borderRadius: 1, px: 2, py: 1.2, border: "1px solid #FECACA" }}>
                                    <Typography fontSize={13} color="error" fontWeight={600}>{submitError}</Typography>
                                </Box>
                            )}
                        </Stack>
                    )}
                </DialogContent>

                {!submitted && (
                    <Box sx={{ px: 3, pb: 3, pt: 0 }}>
                        <Button
                            fullWidth variant="contained" disableElevation
                            disabled={submitting}
                            onClick={handleSubmit}
                            sx={{ borderRadius: 1, fontWeight: 700, py: 1.2 }}
                        >
                            {submitting ? "등록 중..." : "문의 등록"}
                        </Button>
                    </Box>
                )}
            </Dialog>
        </Stack>
    );
}
