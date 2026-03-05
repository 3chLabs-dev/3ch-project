import { useEffect, useState } from "react";
import {
    Box, Typography, IconButton, Stack,
    Card, CardContent, Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Faq = {
    id: number;
    question: string;
    answer: string;
};

export default function FaqPage() {
    const navigate = useNavigate();
    const [faqs, setFaqs] = useState<Faq[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<number | false>(false);

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

    return (
        <Stack spacing={2.5} sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>자주 하는 질문</Typography>
            </Stack>

            {/* FAQ 목록 */}
            <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                {loading ? (
                    <CardContent>
                        <Typography color="text.secondary" fontSize={14} textAlign="center">불러오는 중...</Typography>
                    </CardContent>
                ) : faqs.length === 0 ? (
                    <CardContent sx={{ textAlign: "center", py: 5 }}>
                        <HelpOutlineIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                        <Typography color="text.secondary" fontWeight={700}>등록된 FAQ가 없습니다.</Typography>
                    </CardContent>
                ) : (
                    <Box>
                        {faqs.map((faq, idx) => (
                            <Accordion
                                key={faq.id}
                                expanded={expanded === faq.id}
                                onChange={(_, isExpanded) => setExpanded(isExpanded ? faq.id : false)}
                                disableGutters
                                elevation={0}
                                sx={{
                                    borderBottom: idx < faqs.length - 1 ? "1px solid" : "none",
                                    borderColor: "divider",
                                    "&:before": { display: "none" },
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon sx={{ fontSize: 20, color: "text.disabled" }} />}
                                    sx={{ px: 2.5, py: 0.5, minHeight: 56 }}
                                >
                                    <Stack direction="row" alignItems="center" spacing={1.2}>
                                        <Typography
                                            fontSize={13}
                                            fontWeight={700}
                                            color="primary.main"
                                            sx={{ flexShrink: 0 }}
                                        >
                                            Q
                                        </Typography>
                                        <Typography fontSize={14} fontWeight={700} lineHeight={1.4}>
                                            {faq.question}
                                        </Typography>
                                    </Stack>
                                </AccordionSummary>
                                <AccordionDetails sx={{ px: 2.5, pt: 1.5, pb: 2.5, bgcolor: "#F9FAFB" }}>
                                    <Stack direction="row" spacing={1.2} alignItems="flex-start">
                                        <Typography fontSize={13} fontWeight={700} color="success.main" sx={{ flexShrink: 0, mt: 0.1 }}>
                                            A
                                        </Typography>
                                        <Typography sx={{ whiteSpace: "pre-line", fontSize: 14, lineHeight: 1.9, color: "text.primary" }}>
                                            {faq.answer}
                                        </Typography>
                                    </Stack>
                                </AccordionDetails>
                            </Accordion>
                        ))}
                    </Box>
                )}
            </Card>
        </Stack>
    );
}
