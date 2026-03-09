import { useEffect, useState } from "react";
import {
    Box, IconButton, Stack, Typography,
    Accordion, AccordionSummary, AccordionDetails, Divider, Button, CircularProgress,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type FaqItem = {
    id: number;
    tab: string;
    section: string;
    question: string;
    answer: string;
};

export default function FaqPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<"leader" | "member">("leader");
    const [faqs, setFaqs] = useState<FaqItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | false>(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const r = await fetch(`${API}/faqs`);
                const d = await r.json();
                setFaqs(d.faqs ?? []);
            } catch {
                // ignore
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const tabFaqs = faqs.filter((f) => f.tab === tab);

    // 섹션별 그룹핑 (순서 유지)
    const sections = tabFaqs.reduce<{ title: string; items: FaqItem[] }[]>((acc, faq) => {
        const title = faq.section || "기타";
        const existing = acc.find((s) => s.title === title);
        if (existing) {
            existing.items.push(faq);
        } else {
            acc.push({ title, items: [faq] });
        }
        return acc;
    }, []);

    const toggle = (key: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? key : false);
    };

    return (
        <Stack spacing={2.5} sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>자주 하는 질문</Typography>
            </Stack>

            {/* 탭 */}
            <Stack direction="row" spacing={1}>
                <Button
                    fullWidth
                    variant={tab === "leader" ? "contained" : "outlined"}
                    disableElevation
                    onClick={() => { setTab("leader"); setExpanded(false); }}
                    startIcon={<ManageAccountsOutlinedIcon />}
                    sx={{
                        borderRadius: 1.5, fontWeight: 700, fontSize: 13,
                        ...(tab === "leader" ? {} : { borderColor: "#E5E7EB", color: "text.secondary" }),
                    }}
                >
                    리더 / 운영진
                </Button>
                <Button
                    fullWidth
                    variant={tab === "member" ? "contained" : "outlined"}
                    disableElevation
                    onClick={() => { setTab("member"); setExpanded(false); }}
                    startIcon={<PersonOutlineIcon />}
                    sx={{
                        borderRadius: 1.5, fontWeight: 700, fontSize: 13,
                        ...(tab === "member" ? {} : { borderColor: "#E5E7EB", color: "text.secondary" }),
                    }}
                >
                    일반 회원
                </Button>
            </Stack>

            {/* 안내 배너 */}
            <Box sx={{ bgcolor: tab === "leader" ? "#F0FDF4" : "#EFF6FF", borderRadius: 1.5, px: 2, py: 1.5 }}>
                <Typography fontSize={13} color={tab === "leader" ? "#065F46" : "#1D4ED8"} fontWeight={600} lineHeight={1.7}>
                    {tab === "leader"
                        ? "클럽 리더 / 운영진을 위한 기능 안내입니다.\n클럽 생성부터 리그 운영까지 확인해보세요."
                        : "일반 회원을 위한 기능 안내입니다.\n클럽 가입부터 리그 참가 방법을 확인해보세요."}
                </Typography>
            </Box>

            {/* 로딩 */}
            {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                    <CircularProgress size={28} />
                </Box>
            )}

            {/* 빈 상태 */}
            {!loading && sections.length === 0 && (
                <Box sx={{ py: 6, textAlign: "center" }}>
                    <HelpOutlineIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                    <Typography fontSize={14} fontWeight={700} color="text.secondary">등록된 FAQ가 없습니다.</Typography>
                </Box>
            )}

            {/* 섹션별 FAQ */}
            {!loading && sections.map((section) => (
                <Box key={section.title}>
                    {section.title !== "기타" && (
                        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.2 }}>
                            <Typography fontSize={14} fontWeight={800} color="text.primary">{section.title}</Typography>
                        </Stack>
                    )}

                    <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
                        {section.items.map((item, i) => (
                            <Box key={item.id}>
                                {i > 0 && <Divider />}
                                <Accordion
                                    expanded={expanded === `${section.title}-${item.id}`}
                                    onChange={toggle(`${section.title}-${item.id}`)}
                                    disableGutters
                                    elevation={0}
                                    sx={{ "&:before": { display: "none" } }}
                                >
                                    <AccordionSummary
                                        expandIcon={<ExpandMoreIcon sx={{ fontSize: 18, color: "text.disabled" }} />}
                                        sx={{ px: 2, py: 0.5, minHeight: 48, "& .MuiAccordionSummary-content": { my: 1 } }}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Typography fontSize={13} fontWeight={700} color="primary.main" sx={{ flexShrink: 0 }}>Q</Typography>
                                            <Typography fontSize={13} fontWeight={600} color="text.primary">{item.question}</Typography>
                                        </Stack>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 2, pt: 1.5, pb: 2, bgcolor: "#F9FAFB" }}>
                                        <Stack direction="row" spacing={1} alignItems="flex-start">
                                            <Typography fontSize={13} fontWeight={700} color="success.main" sx={{ flexShrink: 0, mt: 0.1 }}>A</Typography>
                                            <Typography fontSize={13} color="text.secondary" lineHeight={1.8} sx={{ whiteSpace: "pre-line" }}>{item.answer}</Typography>
                                        </Stack>
                                    </AccordionDetails>
                                </Accordion>
                            </Box>
                        ))}
                    </Box>
                </Box>
            ))}
        </Stack>
    );
}
