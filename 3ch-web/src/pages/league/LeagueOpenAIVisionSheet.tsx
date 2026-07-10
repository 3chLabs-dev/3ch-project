import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import FolderIcon from "@mui/icons-material/Folder";
import ImageIcon from "@mui/icons-material/Image";
import PrintIcon from "@mui/icons-material/Print";
import QRCode from "react-qr-code";
import {
  useGetLeagueMatchesQuery,
  useGetLeagueParticipantsQuery,
  useGetLeagueQuery,
  useInitLeagueMatchesMutation,
  useScanLeagueOpenAIVisionMutation,
  useUpdateLeagueMatchMutation,
  type LeagueMatch,
  type LeagueParticipantItem,
  type OpenAIVisionCell,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { useAppSelector } from "../../app/hooks";
import { toUTCDate } from "../../utils/dateUtils";
import { isLocalDevToken } from "../../utils/localDevAuth";

const SHEET_WIDTH = 900;
const MATCH_ORDER_PAIRS = [
  [1, 4],
  [2, 3],
  [1, 3],
  [2, 4],
  [1, 2],
  [3, 4],
];

type PlayerStat = {
  wins: number;
  losses: number;
  setTotal: number;
  setLost: number;
  rank: number;
  tieDiff: number | null;
};

type VisionPreviewCell = OpenAIVisionCell & {
  matchId?: string;
  playerId?: string;
  issue?: string;
};

function divisionLabel(division?: string | null) {
  if (!division) return "-";
  return /(?:부|조)$/.test(division) ? division : `${division}부`;
}

function formatSheetDate(dateString?: string) {
  if (!dateString) return "-";
  const date = toUTCDate(dateString);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}(${days[date.getDay()]})`;
}

function matchKey(aId: string, bId: string) {
  return `${aId}__${bId}`;
}

function buildMatchLookup(matches: LeagueMatch[]) {
  const map = new Map<string, LeagueMatch>();
  matches.forEach((match) => {
    if (!match.participant_a_id || !match.participant_b_id) return;
    map.set(matchKey(match.participant_a_id, match.participant_b_id), match);
    map.set(matchKey(match.participant_b_id, match.participant_a_id), match);
  });
  return map;
}

function getScoreFor(match: LeagueMatch | undefined, playerId: string) {
  if (!match) return null;
  if (match.participant_a_id === playerId) return match.score_a;
  if (match.participant_b_id === playerId) return match.score_b;
  return null;
}

function getErrorMessage(error: unknown, fallback = "처리 중 오류가 발생했습니다.") {
  if (!error || typeof error !== "object") return fallback;
  const maybeError = error as {
    status?: number | string;
    data?: { message?: string; details?: string } | string;
    error?: string;
  };
  if (typeof maybeError.data === "string") return maybeError.data;
  const message = maybeError.data?.message ?? maybeError.data?.details ?? maybeError.error;
  if (message) return maybeError.status ? `${message} (HTTP ${maybeError.status})` : message;
  return maybeError.status ? `${fallback} (HTTP ${maybeError.status})` : fallback;
}

function calculateStats(players: LeagueParticipantItem[], matches: LeagueMatch[]): Record<string, PlayerStat> {
  const totals = new Map<string, { wins: number; losses: number; setTotal: number; setLost: number }>();
  players.forEach((player) => totals.set(player.id, { wins: 0, losses: 0, setTotal: 0, setLost: 0 }));

  matches.forEach((match) => {
    if (match.status !== "done" || !match.participant_a_id || !match.participant_b_id) return;
    const a = totals.get(match.participant_a_id);
    const b = totals.get(match.participant_b_id);
    if (!a || !b) return;
    const scoreA = match.score_a ?? 0;
    const scoreB = match.score_b ?? 0;
    a.setTotal += scoreA;
    a.setLost += scoreB;
    b.setTotal += scoreB;
    b.setLost += scoreA;
    if (scoreA !== scoreB) {
      if (scoreA > scoreB) {
        a.wins += 1;
        b.losses += 1;
      } else {
        b.wins += 1;
        a.losses += 1;
      }
    }
  });

  const ordered = [...players].sort((a, b) => {
    const statA = totals.get(a.id) ?? { wins: 0, losses: 0, setTotal: 0, setLost: 0 };
    const statB = totals.get(b.id) ?? { wins: 0, losses: 0, setTotal: 0, setLost: 0 };
    if (statB.wins !== statA.wins) return statB.wins - statA.wins;
    if (statB.setTotal !== statA.setTotal) return statB.setTotal - statA.setTotal;
    if (statA.setLost !== statB.setLost) return statA.setLost - statB.setLost;
    return a.name.localeCompare(b.name, "ko");
  });

  const byTotal = new Map<number, string[]>();
  players.forEach((player) => {
    const total = totals.get(player.id)?.setTotal ?? 0;
    byTotal.set(total, [...(byTotal.get(total) ?? []), player.id]);
  });

  return Object.fromEntries(
    players.map((player) => {
      const stat = totals.get(player.id) ?? { wins: 0, losses: 0, setTotal: 0, setLost: 0 };
      const tiedIds = byTotal.get(stat.setTotal) ?? [];
      return [
        player.id,
        {
          ...stat,
          rank: ordered.findIndex((p) => p.id === player.id) + 1,
          tieDiff: tiedIds.length > 1 ? stat.setTotal - stat.setLost : null,
        },
      ];
    }),
  );
}

function ScoreStepper({
  value,
  disabled,
  onChange,
  needsReview,
}: {
  value: number | null;
  disabled: boolean;
  onChange: (score: number) => void;
  needsReview?: boolean;
}) {
  const current = value ?? 0;
  const setScore = (next: number) => {
    if (disabled) return;
    onChange(Math.max(0, Math.min(3, next)));
  };

  return (
    <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.6}>
      <Box
        component="button"
        type="button"
        disabled={disabled || current <= 0}
        onClick={() => setScore(current - 1)}
        sx={{ appearance: "none", border: 0, bgcolor: "transparent", p: 0, fontSize: 18, fontWeight: 900, lineHeight: 1, cursor: disabled ? "default" : "pointer", color: "#111827" }}
      >
        -
      </Box>
      <Box
        component="button"
        type="button"
        disabled={disabled}
        sx={{
          width: 34,
          height: 28,
          border: "1px solid",
          borderColor: needsReview ? "#F59E0B" : "#9CA3AF",
          borderRadius: 0.5,
          bgcolor: needsReview ? "#FFFBEB" : "#fff",
          color: "#111827",
          fontSize: 20,
          fontWeight: 900,
          lineHeight: "26px",
          p: 0,
          textAlign: "center",
        }}
      >
        {current}
      </Box>
      <Box
        component="button"
        type="button"
        disabled={disabled || current >= 3}
        onClick={() => setScore(current + 1)}
        sx={{ appearance: "none", border: 0, bgcolor: "transparent", p: 0, fontSize: 18, fontWeight: 900, lineHeight: 1, cursor: disabled ? "default" : "pointer", color: "#111827" }}
      >
        +
      </Box>
    </Stack>
  );
}

export default function LeagueOpenAIVisionSheet() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);
  const authToken = useAppSelector((state) => state.auth.token);
  const scaleContainerRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const autoInitRequestedRef = useRef(false);
  const [sheetScale, setSheetScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCells, setPreviewCells] = useState<VisionPreviewCell[]>([]);

  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id, { skip: !id, refetchOnMountOrArgChange: true });
  const league = leagueData?.league;
  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(league?.group_id ?? "", {
    skip: !league?.group_id,
  });
  const { data: participantData, isLoading: participantsLoading } = useGetLeagueParticipantsQuery(id, { skip: !id, refetchOnMountOrArgChange: true });
  const { data: matchData, isLoading: matchesLoading, refetch: refetchMatches } = useGetLeagueMatchesQuery(id, { skip: !id, refetchOnMountOrArgChange: true });
  const [initMatches, { isLoading: isIniting }] = useInitLeagueMatchesMutation();
  const [scanVision, { isLoading: isScanning }] = useScanLeagueOpenAIVisionMutation();
  const [updateMatch, { isLoading: isSaving }] = useUpdateLeagueMatchMutation();

  const isCreator = !!authUser && league?.created_by_id === authUser.id;
  const canManage = (!groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin")) || isCreator;
  const participants = useMemo(
    () => [...(participantData?.participants ?? [])].sort((a, b) => {
      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.created_at.localeCompare(b.created_at);
    }).slice(0, 4),
    [participantData?.participants],
  );
  const matches = useMemo(
    () => [...(matchData?.matches ?? [])].filter((match) => !match.bracket).sort((a, b) => a.match_order - b.match_order),
    [matchData?.matches],
  );
  const matchLookup = useMemo(() => buildMatchLookup(matches), [matches]);
  const stats = useMemo(() => calculateStats(participants, matches), [participants, matches]);
  const loading = leagueLoading || groupLoading || participantsLoading || matchesLoading;
  const isBusy = isScanning || isSaving;
  const isCompleted = league?.status === "completed";
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  const sheetTitle = `${formatSheetDate(league?.start_date)} / ${league?.type ?? "리그"} ${league?.format ?? "단일리그"} / ${league?.rules ?? ""}`;

  const previewByCell = useMemo(() => {
    const map = new Map<string, VisionPreviewCell>();
    previewCells.forEach((cell) => map.set(`${cell.rowIndex}__${cell.columnIndex}`, cell));
    return map;
  }, [previewCells]);

  const validPreviewMatchCount = useMemo(() => {
    const grouped = new Map<string, { a?: number | null; b?: number | null }>();
    previewCells.forEach((cell) => {
      if (!cell.matchId || !cell.playerId || cell.needsReview || cell.issue) return;
      const match = matches.find((item) => item.id === cell.matchId);
      if (!match) return;
      const current = grouped.get(cell.matchId) ?? {};
      if (match.participant_a_id === cell.playerId) current.a = cell.score;
      if (match.participant_b_id === cell.playerId) current.b = cell.score;
      grouped.set(cell.matchId, current);
    });
    return [...grouped.values()].filter((item) => (
      item.a != null && item.b != null && [item.a, item.b].filter((score) => score === 3).length === 1
    )).length;
  }, [matches, previewCells]);

  useEffect(() => {
    if (!canManage || !matchData || matchData.matches.length > 0 || participants.length !== 4 || isIniting || autoInitRequestedRef.current) return;
    autoInitRequestedRef.current = true;
    initMatches({ id })
      .unwrap()
      .then(() => refetchMatches())
      .catch((error) => {
        autoInitRequestedRef.current = false;
        setNotice({ type: "error", message: getErrorMessage(error, "GPT 인식 대진표 생성에 실패했습니다.") });
      });
  }, [canManage, id, initMatches, isIniting, matchData, participants.length, refetchMatches]);

  useEffect(() => {
    const updateSheetSize = () => {
      const containerWidth = scaleContainerRef.current?.clientWidth ?? SHEET_WIDTH;
      const naturalHeight = sheetRef.current?.offsetHeight ?? 0;
      setSheetScale(Math.min(1, containerWidth / SHEET_WIDTH));
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
  }, [participants, matches, notice, previewOpen]);

  const handleCreateMatches = async () => {
    if (participants.length !== 4) {
      setNotice({ type: "error", message: "대진표를 생성하려면 참가자가 2명 이상 필요합니다." });
      return;
    }
    if (!canManage) {
      setNotice({ type: "error", message: "대진표 생성 권한이 없습니다." });
      return;
    }
    try {
      await initMatches({ id, force: false }).unwrap();
      await refetchMatches();
      setNotice({ type: "success", message: "대진표를 생성했습니다." });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, "대진표 생성에 실패했습니다.") });
    }
  };

  const handleResultFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setResultDialogOpen(false);
    if (!file) return;
    if (!matches.length) {
      setNotice({ type: "error", message: "대진표를 먼저 생성한 뒤 사진을 업로드해 주세요." });
      return;
    }
    if (isLocalDevToken(authToken)) {
      setNotice({
        type: "info",
        message: "로컬 테스트 리그에서는 실제 Vision 인식을 실행할 수 없습니다. 실제 API 서버에 생성한 GPT 인식 리그에서 사진 인식을 테스트해 주세요.",
      });
      return;
    }

    try {
      setNotice({ type: "info", message: "OpenAI Vision으로 대진표 숫자를 인식하는 중입니다." });
      const result = await scanVision({ leagueId: id, file }).unwrap();
      setPreviewCells(buildCompletePreviewCells(result.cells));
      setPreviewOpen(true);
      setNotice({
        type: "success",
        message: `${result.cells.length}개 셀을 인식했습니다. 노란색 칸은 저장 전 확인해 주세요.`,
      });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, "OpenAI Vision 인식에 실패했습니다.") });
    }
  };

  const updatePreviewCell = (rowIndex: number, columnIndex: number, score: number) => {
    setPreviewCells((current) => current.map((cell) => (
      cell.rowIndex === rowIndex && cell.columnIndex === columnIndex
        ? { ...cell, score, needsReview: false, issue: undefined }
        : cell
    )));
  };

  const buildCompletePreviewCells = (recognizedCells: VisionPreviewCell[]) => {
    const byPosition = new Map(recognizedCells.map((cell) => [`${cell.rowIndex}__${cell.columnIndex}`, cell]));
    const cells: VisionPreviewCell[] = [];
    participants.forEach((rowPlayer, rowIndex) => {
      participants.forEach((columnPlayer, columnIndex) => {
        if (rowIndex === columnIndex) return;
        const existing = byPosition.get(`${rowIndex}__${columnIndex}`);
        if (existing) {
          cells.push(existing);
          return;
        }
        const match = matchLookup.get(matchKey(rowPlayer.id, columnPlayer.id));
        cells.push({
          rowPlayerName: rowPlayer.name,
          columnPlayerName: columnPlayer.name,
          rowIndex,
          columnIndex,
          score: 0,
          confidence: 0,
          needsReview: true,
          matchId: match?.id,
          playerId: rowPlayer.id,
          issue: "인식되지 않은 셀입니다.",
        });
      });
    });
    return cells;
  };

  const savePreview = async () => {
    try {
      const grouped = new Map<string, { match: LeagueMatch; scoreA: number | null; scoreB: number | null }>();
      previewCells.forEach((cell) => {
        if (!cell.matchId || !cell.playerId || cell.needsReview || cell.issue) return;
        const match = matches.find((item) => item.id === cell.matchId);
        if (!match) return;
        const current = grouped.get(cell.matchId) ?? { match, scoreA: null, scoreB: null };
        if (match.participant_a_id === cell.playerId) current.scoreA = cell.score;
        if (match.participant_b_id === cell.playerId) current.scoreB = cell.score;
        grouped.set(cell.matchId, current);
      });

      let saved = 0;
      for (const item of grouped.values()) {
        if (item.scoreA == null || item.scoreB == null) continue;
        if ([item.scoreA, item.scoreB].filter((score) => score === 3).length !== 1) continue;
        await updateMatch({
          leagueId: id,
          matchId: item.match.id,
          updates: { score_a: item.scoreA, score_b: item.scoreB, status: "done" },
        }).unwrap();
        saved += 1;
      }
      await refetchMatches();
      setPreviewOpen(false);
      setNotice({ type: "success", message: `${saved}개 경기 결과를 저장했습니다.` });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, "Vision 결과 저장에 실패했습니다.") });
    }
  };

  const renderMatrixTable = (mode: "sheet" | "preview") => (
    <Box
      component="table"
      sx={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
        "& th, & td": { border: "1px solid #9CA3AF", textAlign: "center", verticalAlign: "middle", px: 0.3, py: 0.45, fontSize: 12, overflow: "hidden" },
        "& th": { bgcolor: "#F3F4F6", fontWeight: 900 },
      }}
    >
      <thead>
        <tr>
          <th style={{ width: 96 }}>참가자명</th>
          {participants.map((participant, index) => (
            <th key={participant.id}>
              <Stack alignItems="center" spacing={0.3}>
                <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: "#2563EB", color: "#fff", fontWeight: 900, lineHeight: "18px", fontSize: 10 }}>{index + 1}</Box>
                <Box sx={{ color: "#2563EB", fontSize: 10, fontWeight: 900 }}>{divisionLabel(participant.division)}</Box>
                <Box>{participant.name}</Box>
              </Stack>
            </th>
          ))}
          <th style={{ width: 58 }}>승/패</th>
          <th style={{ width: 54 }}>순위</th>
          <th style={{ width: 82 }}>동점자<br />세트 득실</th>
        </tr>
      </thead>
      <tbody>
        {participants.map((rowPlayer, rowIndex) => {
          const rowStat = stats[rowPlayer.id] ?? { wins: 0, losses: 0, setTotal: 0, setLost: 0, rank: 0, tieDiff: null };
          return (
            <tr key={rowPlayer.id}>
              <th>
                <Stack alignItems="center" spacing={0.4}>
                  <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: "#2563EB", color: "#fff", fontWeight: 900, lineHeight: "18px", fontSize: 10 }}>{rowIndex + 1}</Box>
                  <Box sx={{ color: "#2563EB", fontSize: 10, fontWeight: 900 }}>{divisionLabel(rowPlayer.division)}</Box>
                  <Box>{rowPlayer.name}</Box>
                </Stack>
              </th>
              {participants.map((colPlayer, columnIndex) => {
                if (rowPlayer.id === colPlayer.id) {
                  return <td key={colPlayer.id} style={{ background: "linear-gradient(28deg, transparent 49%, #D1D5DB 49.5%, #D1D5DB 50.5%, transparent 51%)" }} />;
                }
                const match = matchLookup.get(matchKey(rowPlayer.id, colPlayer.id));
                const previewCell = previewByCell.get(`${rowIndex}__${columnIndex}`);
                const selectedScore = mode === "preview" ? previewCell?.score ?? null : getScoreFor(match, rowPlayer.id);
                return (
                  <td key={colPlayer.id} style={{ background: previewCell?.needsReview || previewCell?.issue ? "#FFFBEB" : undefined }}>
                    {mode === "preview" ? (
                      <ScoreStepper
                        value={selectedScore}
                        disabled={!match || isCompleted}
                        needsReview={previewCell?.needsReview || Boolean(previewCell?.issue)}
                        onChange={(score) => updatePreviewCell(rowIndex, columnIndex, score)}
                      />
                    ) : selectedScore != null ? (
                      <Typography sx={{ fontSize: 18, fontWeight: 900 }}>{selectedScore}</Typography>
                    ) : null}
                    {mode === "preview" && previewCell?.confidence != null ? (
                      <Typography sx={{ mt: 0.25, color: previewCell.needsReview || previewCell.issue ? "#B45309" : "#64748B", fontSize: 10, fontWeight: 800 }}>
                        {Math.round(previewCell.confidence * 100)}%
                      </Typography>
                    ) : null}
                  </td>
                );
              })}
              <td style={{ fontWeight: 900 }}>{rowStat.wins}/{rowStat.losses}</td>
              <td style={{ fontWeight: 900, color: isCompleted && rowStat.rank === 1 ? "#DC2626" : "#111827" }}>{rowStat.rank || ""}</td>
              <td style={{ fontWeight: 900 }}>{rowStat.tieDiff ?? `${rowStat.setTotal}/${rowStat.setLost}`}</td>
            </tr>
          );
        })}
      </tbody>
    </Box>
  );

  return (
    <Box className="openai-vision-print-root" sx={{ bgcolor: "#F8FAFC", minHeight: "100%", p: { xs: 1.5, md: 3 }, "@media print": { bgcolor: "#fff", p: 0 } }}>
      <GlobalStyles styles={{
        "@page": { size: "A4 landscape", margin: "8mm" },
        "@media print": {
          "html, body": { width: "100%", height: "auto", background: "#fff" },
          "body *": { visibility: "hidden !important" },
          ".openai-vision-print-root, .openai-vision-print-root *": { visibility: "visible !important" },
          ".openai-vision-print-root": { position: "fixed !important", inset: "0 !important", width: "100% !important", minHeight: "auto !important", padding: "0 !important", background: "#fff !important" },
        },
      }} />

      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.5, flexWrap: "wrap", rowGap: 0.75, "@media print": { display: "none" } }}>
        <IconButton size="small" onClick={() => navigate(-1)}><ArrowBackIcon fontSize="small" /></IconButton>
        <Typography sx={{ flex: 1, fontWeight: 900, fontSize: 18 }}>OpenAI Vision 대진표</Typography>
        <Button variant="contained" size="small" startIcon={<PrintIcon />} onClick={() => window.print()} sx={{ borderRadius: 1, fontWeight: 900 }}>출력</Button>
        <Button variant="contained" size="small" startIcon={<CameraAltIcon />} onClick={() => setResultDialogOpen(true)} disabled={!matches.length || isBusy || isIniting} sx={{ borderRadius: 1, fontWeight: 900, bgcolor: "#16A34A", "&:hover": { bgcolor: "#15803D" } }}>사진 인식</Button>
      </Stack>

      {notice ? <Alert severity={notice.type} sx={{ mb: 1.5, "@media print": { display: "none" } }}>{notice.message}</Alert> : null}
      {loading ? <Alert severity="info" sx={{ mb: 1.5, "@media print": { display: "none" } }}>대진표 정보를 불러오는 중입니다.</Alert> : null}
      {isIniting ? <Alert severity="info" sx={{ mb: 1.5, "@media print": { display: "none" } }}>GPT 인식 대진표를 생성하는 중입니다.</Alert> : null}
      {!matches.length && !loading && !isIniting ? (
        <Alert severity="warning" sx={{ mb: 1.5, "@media print": { display: "none" } }}>
          대진표가 없습니다. <Button size="small" onClick={handleCreateMatches} disabled={isIniting || participants.length !== 4}>대진표 생성</Button>
        </Alert>
      ) : null}

      <Box ref={scaleContainerRef} sx={{ width: "100%", maxWidth: SHEET_WIDTH, mx: "auto", height: sheetHeight ? sheetHeight * sheetScale : "auto", overflow: "hidden", "@media print": { width: "100%", maxWidth: "none", height: "auto", overflow: "visible" } }}>
        <Box ref={sheetRef} sx={{ width: SHEET_WIDTH, boxSizing: "border-box", transform: `scale(${sheetScale})`, transformOrigin: "top left", bgcolor: "#fff", border: "1px solid #D1D5DB", borderRadius: 1, p: 2, "@media print": { width: "100%", border: "none", borderRadius: 0, p: 0, transform: "none" } }}>
          <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 1.2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 950, lineHeight: 1.2 }}>{sheetTitle}</Typography>
              <Typography sx={{ mt: 0.35, color: "#2563EB", fontSize: 11, fontWeight: 800 }}>각 셀에는 행 참가자가 획득한 세트 수 하나만 적어 주세요.</Typography>
            </Box>
            <Stack direction="row" spacing={0.7} sx={{ flexShrink: 0, "@media print": { display: "none" } }}>
              <Button variant="contained" size="small" startIcon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate(-1)} sx={{ borderRadius: 999, fontWeight: 900, minWidth: 62, px: 1.3, bgcolor: "#6B7280", "&:hover": { bgcolor: "#4B5563" } }}>뒤로</Button>
              <Button variant="contained" size="small" onClick={() => navigate(`/league/${id}`)} sx={{ borderRadius: 999, fontWeight: 900, minWidth: 50, px: 1.3, bgcolor: "#60A5FA", "&:hover": { bgcolor: "#3B82F6" } }}>수정</Button>
              <Button variant="contained" size="small" onClick={() => setResultDialogOpen(true)} disabled={!matches.length || isBusy || isIniting} sx={{ borderRadius: 999, fontWeight: 900, minWidth: 72, px: 1.3, bgcolor: "#22C55E", "&:hover": { bgcolor: "#16A34A" } }}>결과 등록</Button>
            </Stack>
            <Box sx={{ width: 48, height: 48, p: 0.2, bgcolor: "#fff", flexShrink: 0 }}><QRCode value={pageUrl} size={44} /></Box>
          </Stack>

          <Box sx={{ p: 1.5 }}>{renderMatrixTable("sheet")}</Box>

          <Box component="table" sx={{ mt: 1.1, width: 310, borderCollapse: "collapse", tableLayout: "fixed", "& th, & td": { border: "1px solid #D1D5DB", textAlign: "center", verticalAlign: "middle", height: 24, fontSize: 12 }, "& th": { fontWeight: 900, bgcolor: "#fff" } }}>
            <tbody>
              <tr>
                <th rowSpan={3} style={{ width: 86, fontSize: 17 }}>경기순서</th>
                {MATCH_ORDER_PAIRS.map((_, index) => <td key={`order-${index}`} style={{ color: "#374151" }}>{index + 1}</td>)}
              </tr>
              <tr>{MATCH_ORDER_PAIRS.map(([a], index) => <td key={`a-${index}`} style={{ fontSize: 18, fontWeight: 900 }}>{a}</td>)}</tr>
              <tr>{MATCH_ORDER_PAIRS.map(([, b], index) => <td key={`b-${index}`} style={{ fontSize: 18, fontWeight: 900 }}>{b}</td>)}</tr>
            </tbody>
          </Box>
        </Box>
      </Box>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleResultFile} />
      <input ref={fileInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.heic,.heif,.webp" hidden onChange={handleResultFile} />
      <input ref={galleryInputRef} type="file" accept="image/*,video/*" hidden onChange={handleResultFile} />

      <Dialog open={isScanning} maxWidth="xs" fullWidth>
        <DialogContent sx={{ py: 3.5, px: 3, textAlign: "center" }}>
          <CircularProgress size={34} />
          <Typography sx={{ mt: 2, fontSize: 15, fontWeight: 900 }}>OpenAI Vision이 숫자를 인식하는 중입니다.</Typography>
          <Typography sx={{ mt: 0.8, color: "#6B7280", fontSize: 12, fontWeight: 700 }}>잠시만 기다려 주세요.</Typography>
        </DialogContent>
      </Dialog>

      <Dialog open={resultDialogOpen} onClose={() => setResultDialogOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden", width: "min(360px, calc(100% - 48px))" } } }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 900, px: 2.5, py: 2 }}>사진 선택</DialogTitle>
        <DialogContent sx={{ p: 0, borderTop: "1px solid #E5E7EB" }}>
          <Stack direction="row" justifyContent="space-around" sx={{ py: 2.8 }}>
            <Button onClick={() => cameraInputRef.current?.click()} disabled={isBusy} sx={{ flexDirection: "column", gap: 1, color: "#374151", minWidth: 86, fontWeight: 800 }}><CameraAltIcon sx={{ fontSize: 30, color: "#777" }} /><Typography sx={{ fontSize: 11, fontWeight: 800 }}>카메라</Typography></Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isBusy} sx={{ flexDirection: "column", gap: 1, color: "#374151", minWidth: 86, fontWeight: 800 }}><FolderIcon sx={{ fontSize: 32, color: "#777" }} /><Typography sx={{ fontSize: 11, fontWeight: 800 }}>파일</Typography></Button>
            <Button onClick={() => galleryInputRef.current?.click()} disabled={isBusy} sx={{ flexDirection: "column", gap: 1, color: "#374151", minWidth: 86, fontWeight: 800 }}><ImageIcon sx={{ fontSize: 30, color: "#3156A6" }} /><Typography sx={{ fontSize: 11, fontWeight: 800 }}>사진/동영상</Typography></Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onClose={() => !isBusy && setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 900 }}>OpenAI Vision 인식 결과 확인</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 1.5, color: "#6B7280", fontSize: 13, fontWeight: 700 }}>노란색 칸이나 잘못 인식된 숫자는 저장 전에 수정해 주세요. 승/패/순위 계산은 저장 후 기존 대진표 로직으로 처리됩니다.</Typography>
          {renderMatrixTable("preview")}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setPreviewOpen(false)} disabled={isBusy}>취소</Button>
          <Button variant="contained" onClick={savePreview} disabled={isBusy || validPreviewMatchCount === 0}>{validPreviewMatchCount}개 경기 저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
