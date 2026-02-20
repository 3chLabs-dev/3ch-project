import { useMemo, useRef, useState } from "react";
import { Box, Typography, IconButton, Button } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate } from "react-router-dom";
import { PRIVACY } from "../../constants/policies";
import PoliciesVersionSheet from "../../components/PoliciesVersionSheet";
import type { policiesMeta } from "../../components/PoliciesVersionSheet"

export default function PrivacyPolicyPage() {
    const navigate = useNavigate();
    const contentRef = useRef<HTMLDivElement | null>(null);

    const [sheetOpen, setSheetOpen] = useState(false);

    // ✅ 임시 버전 목록 (TODO: DB에서 가져오기)
    const versions: policiesMeta[] = useMemo(
        () => [
            { versionId: "current", label: "현행 개인정보 처리방침", effectiveDate: "2026년 2월 14일 시행", isCurrent: true },
            { versionId: "prev-2025-06-01", label: "이전 개인정보 처리방침", effectiveDate: "2025년 6월 1일 시행" },
        ],
        []
    );

    const [selectedVersionId, setSelectedVersionId] = useState(
        versions.find((v) => v.isCurrent)?.versionId ?? versions[0].versionId
    );

    const selectedMeta = useMemo(
        () => versions.find((v) => v.versionId === selectedVersionId) ?? versions[0],
        [versions, selectedVersionId]
    );

    const [privacyBody, setTermsBody] = useState<string>(PRIVACY.body);

    // 임시: 버전별 본문 맵 (DB 붙이면 여기만 API로 교체)
    const privacyBodyByVersion = useMemo<Record<string, string>>(
        () => ({
            current: PRIVACY.body,
            "prev-2025-06-01": `이전 개인정보 처리방침(임시)\n\n아직 DB 연동 전이라 임시 본문입니다.\n\n- 제1조 ...\n- 제2조 ...`,
        }),
        []
    );

    const handleSelectVersion = (versionId: string) => {
        setSelectedVersionId(versionId);

        // 임시: 선택한 버전에 맞춰 본문 교체
        setTermsBody(privacyBodyByVersion[versionId] ?? PRIVACY.body);

        // TODO(DB연동):

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
                <Typography sx={{ fontSize: 13, fontWeight: 900, mb: 0.8 }}>
                    {selectedMeta.label}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 2 }}>
                    {selectedMeta.effectiveDate}
                </Typography>

                <Typography sx={{ fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-line" }}>
                    {privacyBody}
                </Typography>
            </Box>

            <PoliciesVersionSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                versions={versions}
                selectedVersionId={selectedVersionId}
                onSelect={handleSelectVersion}
                maxWidth={420}
            />
        </Box>
    );
}