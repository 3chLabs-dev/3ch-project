import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import PrintIcon from "@mui/icons-material/Print";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import QRCode from "react-qr-code";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetLeagueMatchesQuery,
  useGetLeagueParticipantsQuery,
  useGetLeagueQuery,
  useInitLeagueMatchesMutation,
  useScanOcrMutation,
  useUpdateLeagueMatchMutation,
} from "../../features/league/leagueApi";
import type { LeagueMatch } from "../../features/league/leagueApi";
import { formatLeagueDate } from "../../utils/dateUtils";

const OCR_SHEET_WIDTH = 1120;

type OcrPreviewMatch = {
  matchId: string;
  label: string;
  nameA: string;
  nameB: string;
  scoreA: number | null;
  scoreB: number | null;
  sourceLine?: string;
};

function getErrorMessage(error: unknown, fallback = "처리 중 오류가 발생했습니다.") {
  if (!error || typeof error !== "object") return fallback;
  const maybeError = error as { data?: { message?: string; details?: string }; error?: string };
  return maybeError.data?.message ?? maybeError.data?.details ?? maybeError.error ?? fallback;
}

function normalize(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function matchPlayerName(match: LeagueMatch, side: "A" | "B") {
  const division = side === "A" ? match.participant_a_division : match.participant_b_division;
  const name = side === "A" ? match.participant_a_name : match.participant_b_name;
  if (!name) return "";
  return division ? `(${division}) ${name}` : name;
}

function parseScoreLine(line: string, match: LeagueMatch) {
  const normalizedLine = normalize(line);
  const aName = normalize(match.participant_a_name ?? "");
  const bName = normalize(match.participant_b_name ?? "");
  const hasOrder = new RegExp(`(^|\\D)${match.match_order}(\\D|$)`).test(line);
  const hasNames = Boolean(aName && bName && normalizedLine.includes(aName) && normalizedLine.includes(bName));
  if (!hasOrder && !hasNames) return null;

  const numbers = line.match(/\d+/g)?.map(Number).filter((num) => Number.isInteger(num) && num >= 0 && num <= 99) ?? [];
  const scoreNumbers = hasOrder && numbers[0] === match.match_order ? numbers.slice(1) : numbers;
  if (scoreNumbers.length < 2) return null;
  return {
    scoreA: scoreNumbers[0],
    scoreB: scoreNumbers[1],
    sourceLine: line,
  };
}

function buildPreview(matches: LeagueMatch[], text: string): OcrPreviewMatch[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return matches
    .filter((match) => match.participant_a_id && match.participant_b_id)
    .map((match) => {
      const parsed = lines.map((line) => parseScoreLine(line, match)).find(Boolean);
      return {
        matchId: match.id,
        label: match.match_label ?? `${match.match_order}경기`,
        nameA: matchPlayerName(match, "A") || "미정",
        nameB: matchPlayerName(match, "B") || "미정",
        scoreA: parsed?.scoreA ?? match.score_a ?? null,
        scoreB: parsed?.scoreB ?? match.score_b ?? null,
        sourceLine: parsed?.sourceLine,
      };
    });
}

export default function LeagueOcrSheet() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const scaleContainerRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sheetScale, setSheetScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [preview, setPreview] = useState<OcrPreviewMatch[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const { data: participantData, isLoading: participantsLoading } = useGetLeagueParticipantsQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const { data: matchData, isLoading: matchesLoading, refetch: refetchMatches } = useGetLeagueMatchesQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const [initMatches, { isLoading: isIniting }] = useInitLeagueMatchesMutation();
  const [scanOcr, { data: ocrData, isLoading: isScanning, reset }] = useScanOcrMutation();
  const [updateMatch, { isLoading: isSaving }] = useUpdateLeagueMatchMutation();

  const league = leagueData?.league;
  const participants = useMemo(
    () => [...(participantData?.participants ?? [])].sort((a, b) => {
      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.created_at.localeCompare(b.created_at);
    }),
    [participantData?.participants],
  );
  const matches = useMemo(
    () => [...(matchData?.matches ?? [])].filter((match) => !match.bracket).sort((a, b) => a.match_order - b.match_order),
    [matchData?.matches],
  );
  const loading = leagueLoading || participantsLoading || matchesLoading;
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  const sheetDate = league?.start_date ? formatLeagueDate(league.start_date) : "-";
  const sheetTitle = `${sheetDate} / ${league?.type ?? "단식"} ${league?.format ?? "단일리그"} / ${league?.rules ?? ""}`;
  const canCreateMatches = participants.length >= 2 && !isIniting;

  useEffect(() => {
    const updateSheetSize = () => {
      const containerWidth = scaleContainerRef.current?.clientWidth ?? OCR_SHEET_WIDTH;
      const naturalHeight = sheetRef.current?.offsetHeight ?? 0;
      setSheetScale(Math.min(1, containerWidth / OCR_SHEET_WIDTH));
      setSheetHeight(naturalHeight);
    };

    updateSheetSize();
    const observer = new ResizeObserver(updateSheetSize);
    if (scaleContainerRef.current) observer.observe(scaleContainerRef.current);
    if (sheetRef.current) observer.observe(sheetRef.current);
    window.addEventListener("resize", updateSheetSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSheetSize);
    };
  }, [participants, matches, notice, ocrData]);

  const handleCreateMatches = async () => {
    if (participants.length < 2) {
      setNotice({ type: "error", message: "대진표를 생성하려면 참가자가 2명 이상 필요합니다." });
      return;
    }

    setNotice({ type: "info", message: "대진표를 생성하는 중입니다." });
    try {
      await initMatches({ id, force: false }).unwrap();
      await refetchMatches();
      setNotice({ type: "success", message: "대진표를 생성했습니다. OCR 입력지가 완성되었습니다." });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, "대진표 생성에 실패했습니다.") });
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!matches.length) {
      setNotice({ type: "error", message: "대진표를 먼저 생성한 뒤 OCR 이미지를 업로드해 주세요." });
      return;
    }

    reset();
    setNotice({ type: "info", message: "OCR 이미지를 분석하는 중입니다." });
    try {
      const result = await scanOcr({ file, language: "kor+eng", psm: 6 }).unwrap();
      setPreview(buildPreview(matches, result.text));
      setPreviewOpen(true);
      setNotice(null);
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, "OCR 처리에 실패했습니다.") });
    }
  };

  const updatePreviewScore = (matchId: string, side: "A" | "B", value: string) => {
    const number = value === "" ? null : Number(value);
    setPreview((current) => current.map((match) => (
      match.matchId === matchId
        ? { ...match, [side === "A" ? "scoreA" : "scoreB"]: Number.isFinite(number) ? number : null }
        : match
    )));
  };

  const savePreview = async () => {
    try {
      let saved = 0;
      for (const match of preview) {
        if (match.scoreA == null || match.scoreB == null) continue;
        await updateMatch({
          leagueId: id,
          matchId: match.matchId,
          updates: {
            score_a: match.scoreA,
            score_b: match.scoreB,
            status: "done",
          },
        }).unwrap();
        saved += 1;
      }
      await refetchMatches();
      setPreviewOpen(false);
      setNotice({ type: "success", message: `${saved}개 경기 결과를 저장했습니다.` });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, "OCR 결과 저장에 실패했습니다.") });
    }
  };

  return (
    <Box className="ocr-print-root" sx={{ bgcolor: "#F8FAFC", minHeight: "100%", p: { xs: 1.5, md: 3 }, "@media print": { bgcolor: "#fff", p: 0 } }}>
      <GlobalStyles
        styles={{
          "@page": {
            size: "A4 landscape",
            margin: "8mm",
          },
          "@media print": {
            "html, body": {
              width: "100%",
              height: "auto",
              background: "#fff",
            },
            "body *": {
              visibility: "hidden !important",
            },
            ".ocr-print-root, .ocr-print-root *": {
              visibility: "visible !important",
            },
            ".ocr-print-root": {
              position: "fixed !important",
              inset: "0 !important",
              width: "100% !important",
              minHeight: "auto !important",
              padding: "0 !important",
              background: "#fff !important",
            },
          },
        }}
      />

      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.5, flexWrap: "wrap", rowGap: 0.75, "@media print": { display: "none" } }}>
        <IconButton size="small" onClick={() => navigate(-1)}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ flex: 1, fontWeight: 900, fontSize: 18 }}>OCR 점수 입력지</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          sx={{ borderRadius: 1, fontWeight: 900 }}
        >
          출력
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<UploadFileOutlinedIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={!matches.length || isScanning}
          sx={{ borderRadius: 1, fontWeight: 900, bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }}
        >
          OCR 업로드
        </Button>
      </Stack>

      {notice ? <Alert severity={notice.type} sx={{ mb: 1.5, "@media print": { display: "none" } }}>{notice.message}</Alert> : null}
      {loading || isScanning || isIniting ? <LinearProgress sx={{ mb: 1.5, "@media print": { display: "none" } }} /> : null}

      <Box
        ref={scaleContainerRef}
        sx={{
          width: "100%",
          maxWidth: OCR_SHEET_WIDTH,
          mx: "auto",
          height: sheetHeight ? sheetHeight * sheetScale : "auto",
          overflow: "hidden",
          "@media print": {
            width: "100%",
            maxWidth: "none",
            height: "auto",
            overflow: "visible",
          },
        }}
      >
        <Box
          ref={sheetRef}
          sx={{
            width: OCR_SHEET_WIDTH,
            boxSizing: "border-box",
            transform: `scale(${sheetScale})`,
            transformOrigin: "top left",
            bgcolor: "#fff",
            border: "1px solid #D1D5DB",
            borderRadius: 1,
            p: 2.2,
            "@media print": {
              width: "100%",
              border: "none",
              borderRadius: 0,
              p: 0,
              transform: "none",
            },
          }}
        >
          <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 1.6 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 22, fontWeight: 950, lineHeight: 1.2 }}>
                {sheetTitle}
              </Typography>
              <Typography sx={{ mt: 0.35, color: "#2563EB", fontSize: 12, fontWeight: 800 }}>
                출력 후 점수를 적고, 촬영한 이미지를 OCR 업로드로 등록해 주세요.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.7} sx={{ flexShrink: 0, "@media print": { display: "none" } }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<ArrowBackIcon fontSize="small" />}
                onClick={() => navigate(-1)}
                sx={{ borderRadius: 999, fontWeight: 900, minWidth: 62, px: 1.3, bgcolor: "#6B7280", "&:hover": { bgcolor: "#4B5563" } }}
              >
                뒤로
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => navigate(`/league/${id}`)}
                sx={{ borderRadius: 999, fontWeight: 900, minWidth: 50, px: 1.3, bgcolor: "#60A5FA", "&:hover": { bgcolor: "#3B82F6" } }}
              >
                수정
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<CameraAltIcon fontSize="small" />}
                onClick={() => fileInputRef.current?.click()}
                disabled={!matches.length || isScanning}
                sx={{ borderRadius: 999, fontWeight: 900, minWidth: 92, px: 1.3, bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }}
              >
                결과 등록
              </Button>
            </Stack>
            <Box sx={{ width: 48, height: 48, p: 0.2, bgcolor: "#fff", flexShrink: 0 }}>
              <QRCode value={pageUrl} size={44} />
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.6} alignItems="flex-start">
            <Box sx={{ width: 320, flexShrink: 0 }}>
              <Typography sx={{ mb: 0.75, fontSize: 17, fontWeight: 950 }}>참가자</Typography>
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  "& th, & td": {
                    border: "1px solid #CBD5E1",
                    textAlign: "center",
                    verticalAlign: "middle",
                    px: 0.7,
                    py: 0.75,
                    fontSize: 13,
                  },
                  "& th": { bgcolor: "#F8FAFC", fontWeight: 900 },
                }}
              >
                <thead>
                  <tr>
                    <th style={{ width: 54 }}>순번</th>
                    <th style={{ width: 78 }}>부서</th>
                    <th>이름</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((participant, index) => (
                    <tr key={participant.id}>
                      <td style={{ fontWeight: 900 }}>{index + 1}</td>
                      <td>{participant.division ?? ""}</td>
                      <td style={{ fontWeight: 900, wordBreak: "break-word" }}>{participant.name}</td>
                    </tr>
                  ))}
                  {!participants.length ? (
                    <tr>
                      <td colSpan={3} style={{ height: 88, color: "#64748B", fontWeight: 800 }}>
                        등록된 참가자가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </Box>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75, "@media print": { display: "block" } }}>
                <Typography sx={{ flex: 1, fontSize: 17, fontWeight: 950 }}>경기 결과 기록</Typography>
                {!matches.length ? (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!canCreateMatches}
                    onClick={handleCreateMatches}
                    sx={{ fontWeight: 900, borderRadius: 999, "@media print": { display: "none" } }}
                  >
                    대진표 생성
                  </Button>
                ) : null}
              </Stack>

              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  "& th, & td": {
                    border: "1px solid #CBD5E1",
                    textAlign: "center",
                    verticalAlign: "middle",
                    px: 0.7,
                    py: 0.65,
                    fontSize: 13,
                  },
                  "& th": { bgcolor: "#F8FAFC", fontWeight: 900 },
                }}
              >
                <thead>
                  <tr>
                    <th style={{ width: 54 }}>경기</th>
                    <th>A 선수</th>
                    <th style={{ width: 76 }}>A 점수</th>
                    <th>B 선수</th>
                    <th style={{ width: 76 }}>B 점수</th>
                    <th style={{ width: 116 }}>확인</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => (
                    <tr key={match.id}>
                      <td style={{ fontWeight: 950 }}>{match.match_order}</td>
                      <td style={{ textAlign: "left", fontWeight: 800, wordBreak: "break-word" }}>{matchPlayerName(match, "A")}</td>
                      <td style={{ height: 42, border: "2px solid #111827", background: "#fff" }}>{match.score_a ?? ""}</td>
                      <td style={{ textAlign: "left", fontWeight: 800, wordBreak: "break-word" }}>{matchPlayerName(match, "B")}</td>
                      <td style={{ height: 42, border: "2px solid #111827", background: "#fff" }}>{match.score_b ?? ""}</td>
                      <td />
                    </tr>
                  ))}
                  {!matches.length ? (
                    <tr>
                      <td colSpan={6} style={{ height: 160, color: "#64748B", fontWeight: 800 }}>
                        {participants.length < 2
                          ? "참가자를 2명 이상 등록하면 대진표를 생성할 수 있습니다."
                          : "대진표를 생성하면 OCR 입력지가 완성됩니다."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>

      {ocrData ? (
        <Paper sx={{ maxWidth: OCR_SHEET_WIDTH, mx: "auto", mt: 1.5, p: 2, border: "1px solid #E5E7EB", boxShadow: "none", "@media print": { display: "none" } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ flex: 1, fontWeight: 900 }}>OCR 원문</Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyOutlinedIcon />}
              onClick={() => navigator.clipboard?.writeText(ocrData.text)}
            >
              복사
            </Button>
          </Stack>
          <Box component="pre" sx={{ m: 0, p: 2, bgcolor: "#0F172A", color: "#E2E8F0", borderRadius: 1, whiteSpace: "pre-wrap", overflow: "auto" }}>
            {ocrData.text || "인식된 텍스트가 없습니다."}
          </Box>
        </Paper>
      ) : null}

      <input
        ref={fileInputRef}
        hidden
        accept="image/*,.jpg,.jpeg,.png,.heic,.heif,.webp"
        type="file"
        onChange={handleFile}
      />

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>OCR 인식 결과 확인</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {preview.map((match) => (
              <Paper key={match.matchId} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                  <Typography sx={{ width: 72, fontWeight: 900 }}>{match.label}</Typography>
                  <Typography sx={{ flex: 1 }}>{match.nameA}</Typography>
                  <TextField
                    size="small"
                    type="number"
                    label="A"
                    value={match.scoreA ?? ""}
                    onChange={(event) => updatePreviewScore(match.matchId, "A", event.target.value)}
                    sx={{ width: { xs: "100%", sm: 90 } }}
                  />
                  <Typography sx={{ flex: 1 }}>{match.nameB}</Typography>
                  <TextField
                    size="small"
                    type="number"
                    label="B"
                    value={match.scoreB ?? ""}
                    onChange={(event) => updatePreviewScore(match.matchId, "B", event.target.value)}
                    sx={{ width: { xs: "100%", sm: 90 } }}
                  />
                </Stack>
                {match.sourceLine ? (
                  <Typography sx={{ mt: 1, color: "#64748B", fontSize: 12 }}>인식 줄: {match.sourceLine}</Typography>
                ) : null}
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>취소</Button>
          <Button variant="contained" disabled={isSaving} onClick={savePreview}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
