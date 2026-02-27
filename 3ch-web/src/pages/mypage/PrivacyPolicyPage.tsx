import { useMemo, useRef, useState } from "react";
import { Box, Typography, IconButton, Button, CircularProgress } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate } from "react-router-dom";
import PoliciesVersionSheet from "../../components/PoliciesVersionSheet";
import {
    useGetPolicyVersionsQuery,
    useGetPolicyVersionQuery,
} from "../../features/policy/policyApi";

function toDisplayHTML(s: string): string {
    if (!s) return "";
    if (s.trimStart().startsWith("<")) return s;
    return `<p>${s.trim().replace(/\n/g, "<br>")}</p>`;
}

export default function PrivacyPolicyPage() {
    const navigate    = useNavigate();
    const contentRef  = useRef<HTMLDivElement | null>(null);

    const [sheetOpen, setSheetOpen]   = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const { data: versionsData, isLoading: versionsLoading } = useGetPolicyVersionsQuery("privacy", { refetchOnMountOrArgChange: true });
    const versions = useMemo(() => versionsData?.versions ?? [], [versionsData]);

    // 유저가 명시적으로 선택하지 않은 경우 현행(is_current) → 첫 번째 버전 순으로 fallback
    const effectiveId = useMemo(
        () => selectedId ?? versions.find((v) => v.is_current)?.id ?? versions[0]?.id ?? null,
        [selectedId, versions],
    );

    const { data: detail, isFetching: bodyLoading } = useGetPolicyVersionQuery(
        { type: "privacy", id: effectiveId! },
        { skip: effectiveId === null },
    );

    const selectedMeta = versions.find((v) => v.id === effectiveId);

    const handleSelectVersion = (id: number) => {
        setSelectedId(id);
        contentRef.current?.scrollTo({ top: 0 });
    };

    return (
        <Box
            sx={{
                width: "100%",
                maxWidth: 420,
                mx: "auto",
                px: 2,
                pt: 1,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            {/* 헤더 */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <IconButton
                        onClick={() => navigate(-1)}
                        disableRipple
                        sx={{ p: 0, "&:hover": { background: "transparent" } }}
                    >
                        <ChevronLeftIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                    <Typography sx={{ fontSize: 22, fontWeight: 800 }}>개인정보 처리방침</Typography>
                </Box>

                <Button
                    onClick={() => setSheetOpen(true)}
                    variant="text"
                    disabled={versionsLoading || versions.length <= 1}
                    sx={{ fontWeight: 800, px: 1, minWidth: "auto", color: "text.primary" }}
                >
                    이전 버전 보기
                </Button>
            </Box>

            {/* 본문 스크롤 */}
            <Box
                ref={contentRef}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    pb: 2,
                }}
            >
                {versionsLoading || bodyLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
                        <CircularProgress size={28} />
                    </Box>
                ) : (
                    <>
                        <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 0.8 }}>
                            {selectedMeta?.label ?? ""}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 2 }}>
                            {selectedMeta?.effective_date ?? ""}
                        </Typography>
                        <Box
                            sx={{
                                fontSize: 13,
                                lineHeight: 1.75,
                                "& table": { borderCollapse: "collapse", width: "100%", my: 1 },
                                "& td, & th": { border: "1px solid #D1D5DB", padding: "6px 10px", verticalAlign: "top" },
                                "& th": { backgroundColor: "#F3F4F6", fontWeight: 700 },
                                "& h1": { fontSize: 16, fontWeight: 700, mt: 1.5, mb: 0.5 },
                                "& h2": { fontSize: 14, fontWeight: 700, mt: 1.5, mb: 0.5 },
                                "& h3": { fontSize: 13, fontWeight: 700, mt: 1, mb: 0.5 },
                                "& ul, & ol": { pl: 3, my: 0.5 },
                                "& p": { margin: 0 },
                                "& p:empty": { minHeight: "1.6em" },
                            }}
                            dangerouslySetInnerHTML={{ __html: toDisplayHTML(detail?.body ?? "") }}
                        />
                    </>
                )}
            </Box>

            <PoliciesVersionSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                versions={versions}
                selectedId={effectiveId}
                onSelect={handleSelectVersion}
                maxWidth={420}
            />
        </Box>
    );
}
