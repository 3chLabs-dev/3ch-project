import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
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
  useScanLeagueOmrMutation,
  useUpdateLeagueMutation,
  useUpdateLeagueMatchMutation,
  type LeagueMatch,
  type LeagueParticipantItem,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { useAppSelector } from "../../app/hooks";
import { toUTCDate } from "../../utils/dateUtils";

const SCORE_OPTIONS = [0, 1, 2, 3];
const SHEET_WIDTH = 780;
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

type OmrMark = {
  matchId: string;
  playerId: string;
  score: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

type OmrScanResult = Record<string, Record<string, number>>;

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

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };
    img.src = url;
  });
}

const MARK_READ_SCALES = [0.55, 0.75];
const OMR_DARKNESS_THRESHOLD = 18;
const OMR_MARGIN_THRESHOLD = 5;
const OMR_SERVER_TIMEOUT_MS = 28_000;
const OMR_UPDATE_TIMEOUT_MS = 8_000;
const OMR_FALLBACK_IMAGE_EDGE = 1800;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timer));
  });
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function readLuminanceStats(data: ImageData, left: number, top: number, right: number, bottom: number) {
  let count = 0;
  let darkPixels = 0;
  let luminanceSum = 0;
  const { width, height } = data;
  const startX = clamp(Math.round(left), 0, width - 1);
  const endX = clamp(Math.round(right), 0, width - 1);
  const startY = clamp(Math.round(top), 0, height - 1);
  const endY = clamp(Math.round(bottom), 0, height - 1);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data.data[idx];
      const g = data.data[idx + 1];
      const b = data.data[idx + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      luminanceSum += luminance;
      if (luminance < 150) darkPixels += 1;
      count += 1;
    }
  }

  return {
    mean: count > 0 ? luminanceSum / count : 255,
    dark: count > 0 ? (darkPixels / count) * 100 : 0,
  };
}

function readDarknessRect(data: ImageData, centerX: number, centerY: number, widthRatio: number, heightRatio: number, scale: number) {
  const { width, height } = data;
  const boxWidth = Math.max(4, Math.round(width * widthRatio * scale));
  const boxHeight = Math.max(4, Math.round(height * heightRatio * scale));
  const startX = Math.max(0, Math.floor(centerX - boxWidth / 2));
  const endX = Math.min(width - 1, Math.ceil(centerX + boxWidth / 2));
  const startY = Math.max(0, Math.floor(centerY - boxHeight / 2));
  const endY = Math.min(height - 1, Math.ceil(centerY + boxHeight / 2));
  const inner = readLuminanceStats(data, startX, startY, endX, endY);
  const outerWidth = Math.max(boxWidth + 2, Math.round(width * widthRatio * 1.8));
  const outerHeight = Math.max(boxHeight + 2, Math.round(height * heightRatio * 1.8));
  const outer = readLuminanceStats(
    data,
    centerX - outerWidth / 2,
    centerY - outerHeight / 2,
    centerX + outerWidth / 2,
    centerY + outerHeight / 2,
  );
  const contrast = Math.max(0, outer.mean - inner.mean);
  return inner.dark + contrast * 0.35;
}

function readBestDarkness(data: ImageData, centerX: number, centerY: number, widthRatio: number, heightRatio: number) {
  return Math.max(...MARK_READ_SCALES.map((scale) => readDarknessRect(data, centerX, centerY, widthRatio, heightRatio, scale)));
}

async function scanOmrImage(file: File, marks: OmrMark[]): Promise<OmrScanResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일을 선택해 주세요.");
  }

  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  const scale = Math.min(1, OMR_FALLBACK_IMAGE_EDGE / Math.max(naturalWidth, naturalHeight));
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("이미지를 분석할 수 없습니다.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const grouped = new Map<string, Array<{ score: number; darkness: number }>>();
  marks.forEach((mark) => {
    const darkness = readBestDarkness(
      imageData,
      mark.x * canvas.width,
      mark.y * canvas.height,
      mark.w,
      mark.h,
    );
    const key = `${mark.matchId}__${mark.playerId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), { score: mark.score, darkness }]);
  });

  const result: OmrScanResult = {};
  grouped.forEach((items, key) => {
    const [matchId, playerId] = key.split("__");
    const ranked = [...items].sort((a, b) => b.darkness - a.darkness);
    const winner = ranked[0];
    const runnerUp = ranked[1];
    if (!winner || !runnerUp) return;
    if (winner.darkness < OMR_DARKNESS_THRESHOLD || winner.darkness - runnerUp.darkness < OMR_MARGIN_THRESHOLD) return;
    result[matchId] = { ...(result[matchId] ?? {}), [playerId]: winner.score };
  });

  return result;
}

function countRecognizedScores(result: OmrScanResult) {
  return Object.values(result).reduce((sum, scores) => sum + Object.keys(scores).length, 0);
}

function countCompleteValidMatches(result: OmrScanResult, marks: OmrMark[]) {
  const expectedPlayers = new Map<string, Set<string>>();
  marks.forEach((mark) => {
    expectedPlayers.set(mark.matchId, (expectedPlayers.get(mark.matchId) ?? new Set()).add(mark.playerId));
  });

  let complete = 0;
  let valid = 0;
  expectedPlayers.forEach((players, matchId) => {
    const matchResult = result[matchId];
    if (!matchResult || [...players].some((playerId) => matchResult[playerId] == null)) return;
    complete += 1;
    const scores = [...players].map((playerId) => matchResult[playerId]);
    if (scores.length === 2 && scores.filter((score) => score === 3).length === 1) valid += 1;
  });
  return { complete, valid };
}

function pickBestOmrResult(results: Array<{ result: OmrScanResult; marks: OmrMark[] }>) {
  return results.sort((a, b) => {
    const aQuality = countCompleteValidMatches(a.result, a.marks);
    const bQuality = countCompleteValidMatches(b.result, b.marks);
    const recognizedDiff = countRecognizedScores(b.result) - countRecognizedScores(a.result);
    if (recognizedDiff !== 0) return recognizedDiff;
    if (bQuality.valid !== aQuality.valid) return bQuality.valid - aQuality.valid;
    if (bQuality.complete !== aQuality.complete) return bQuality.complete - aQuality.complete;
    return 0;
  })[0]?.result ?? {};
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

function ScoreMarks({
  selected,
  disabled,
  onSelect,
  matchId,
  playerId,
}: {
  selected: number | null;
  disabled: boolean;
  onSelect: (score: number) => void;
  matchId?: string;
  playerId?: string;
}) {
  return (
    <Stack
      direction="column"
      justifyContent="center"
      sx={{
        width: "100%",
        alignItems: "center",
        gap: "1px",
        overflow: "hidden",
      }}
    >
      <Stack direction="row" sx={{ width: 88, justifyContent: "space-between" }}>
        {SCORE_OPTIONS.map((score) => (
          <Box
            key={`label-${score}`}
            component="span"
            sx={{
              width: 16,
              color: "#111827",
              fontWeight: 900,
              fontSize: 10,
              lineHeight: "12px",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            {score}
          </Box>
        ))}
      </Stack>
      <Stack direction="row" sx={{ width: 88, justifyContent: "space-between" }}>
        {SCORE_OPTIONS.map((score) => (
          <Box
            key={`mark-${score}`}
            component="button"
            type="button"
            data-omr-mark={matchId && playerId ? "true" : undefined}
            data-match-id={matchId}
            data-player-id={playerId}
            data-score={score}
            disabled={disabled}
            aria-label={String(score)}
            onClick={() => !disabled && onSelect(score)}
            sx={{
              appearance: "none",
              width: 15,
              height: 15,
              p: 0,
              m: 0,
              border: "1.6px solid #111",
              borderRadius: 0,
              boxSizing: "border-box",
              bgcolor: selected === score ? "#111" : "#fff",
              cursor: disabled ? "default" : "pointer",
              "@media print": {
                background: selected === score ? "#111 !important" : "#fff !important",
                borderColor: "#111 !important",
                WebkitPrintColorAdjust: "exact",
                printColorAdjust: "exact",
              },
            }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function ScoreStepper({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled: boolean;
  onChange: (score: number) => void;
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
        sx={{
          appearance: "none",
          border: 0,
          bgcolor: "transparent",
          p: 0,
          fontSize: 18,
          fontWeight: 900,
          lineHeight: 1,
          cursor: disabled ? "default" : "pointer",
          color: "#111827",
        }}
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
          border: "1px solid #9CA3AF",
          borderRadius: 0.5,
          bgcolor: "#fff",
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
        sx={{
          appearance: "none",
          border: 0,
          bgcolor: "transparent",
          p: 0,
          fontSize: 18,
          fontWeight: 900,
          lineHeight: 1,
          cursor: disabled ? "default" : "pointer",
          color: "#111827",
        }}
      >
        +
      </Box>
    </Stack>
  );
}

export default function LeagueOmrSheet() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);
  const scaleContainerRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scoreTableRef = useRef<HTMLTableElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [sheetScale, setSheetScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [forceScoreEditMode, setForceScoreEditMode] = useState(false);

  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id, { skip: !id });
  const league = leagueData?.league;
  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(league?.group_id ?? "", {
    skip: !league?.group_id,
  });
  const { data: participantData, isLoading: participantsLoading } = useGetLeagueParticipantsQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const { data: matchData, isLoading: matchesLoading } = useGetLeagueMatchesQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const [initMatches, { isLoading: isIniting }] = useInitLeagueMatchesMutation();
  const [updateMatch] = useUpdateLeagueMatchMutation();
  const [scanLeagueOmr] = useScanLeagueOmrMutation();
  const [updateLeague, { isLoading: isClosing }] = useUpdateLeagueMutation();

  const isCreator = !!authUser && league?.created_by_id === authUser.id;
  const canManage = (!groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin")) || isCreator;
  const canMark = canManage || league?.join_permission === "public" || (!groupLoading && !!groupData?.myRole);

  const participants = useMemo(() => {
    return [...(participantData?.participants ?? [])]
      .sort((a, b) => {
        const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.created_at.localeCompare(b.created_at);
      })
      .slice(0, 4);
  }, [participantData?.participants]);

  const matches = useMemo(() => (matchData?.matches ?? []).filter((match) => !match.bracket), [matchData?.matches]);
  const matchLookup = useMemo(() => buildMatchLookup(matches), [matches]);
  const stats = useMemo(() => calculateStats(participants, matches), [participants, matches]);
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  const sheetTitle = `${formatSheetDate(league?.start_date)} / ${league?.type ?? "단식"} ${league?.format ?? "단일리그"} / ${league?.rules ?? ""}`;
  const isCompleted = league?.status === "completed";
  const scoreEditMode = isCompleted || forceScoreEditMode;

  useEffect(() => {
    if (!canManage || !matchData || matchData.matches.length > 0 || participants.length !== 4) return;
    initMatches({ id });
  }, [canManage, id, initMatches, matchData, participants.length]);

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
  }, [participants, matches]);

  const handleScore = (match: LeagueMatch | undefined, playerId: string, score: number) => {
    if (!match || !canMark) return;
    const isA = match.participant_a_id === playerId;
    const nextA = isA ? score : match.score_a;
    const nextB = isA ? match.score_b : score;
    updateMatch({
      leagueId: id,
      matchId: match.id,
      updates: {
        score_a: nextA,
        score_b: nextB,
        status: nextA != null && nextB != null ? "done" : "playing",
      },
    });
  };

  const handleRegisterResults = () => {
    setResultDialogOpen(true);
  };

  const collectOmrMarks = (target: HTMLElement | null) => {
    if (!target) return [];
    const targetRect = target.getBoundingClientRect();
    return Array.from(target.querySelectorAll<HTMLElement>("[data-omr-mark='true']")).flatMap((el) => {
      const matchId = el.dataset.matchId;
      const playerId = el.dataset.playerId;
      const score = Number(el.dataset.score);
      if (!matchId || !playerId || !Number.isFinite(score)) return [];
      const rect = el.getBoundingClientRect();
      return [{
        matchId,
        playerId,
        score,
        x: ((rect.left + rect.width / 2) - targetRect.left) / targetRect.width,
        y: ((rect.top + rect.height / 2) - targetRect.top) / targetRect.height,
        w: rect.width / targetRect.width,
        h: rect.height / targetRect.height,
      }];
    });
  };

  const applyOmrResult = async (result: OmrScanResult) => {
    let updated = 0;
    for (const match of matches) {
      if (!match.participant_a_id || !match.participant_b_id) continue;
      const matchResult = result[match.id];
      if (!matchResult) continue;
      const scoreA = matchResult[match.participant_a_id];
      const scoreB = matchResult[match.participant_b_id];
      if (scoreA == null && scoreB == null) continue;
      if (scoreA != null && scoreB != null && [scoreA, scoreB].filter((score) => score === 3).length !== 1) continue;
      await withTimeout(
        updateMatch({
          leagueId: id,
          matchId: match.id,
          updates: {
            score_a: scoreA ?? match.score_a,
            score_b: scoreB ?? match.score_b,
            status: scoreA != null && scoreB != null ? "done" : "playing",
          },
        }).unwrap(),
        OMR_UPDATE_TIMEOUT_MS,
        "OMR 결과 저장 시간이 초과되었습니다.",
      );
      updated += 1;
    }
    return updated;
  };

  const handleResultFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setResultDialogOpen(false);
    if (!file) return;
    try {
      const sheetMarks = collectOmrMarks(sheetRef.current);
      const tableMarks = collectOmrMarks(scoreTableRef.current);
      if (sheetMarks.length === 0 && tableMarks.length === 0) {
        window.alert("OMR 마킹 위치를 찾지 못했습니다. 화면을 새로고침 후 다시 시도해 주세요.");
        return;
      }
      const scenarios = [
        sheetMarks.length ? { name: "sheet", marks: sheetMarks } : null,
        tableMarks.length ? { name: "table", marks: tableMarks } : null,
      ].filter((scenario): scenario is { name: string; marks: OmrMark[] } => Boolean(scenario));

      let result: OmrScanResult;
      let scanRequest: ReturnType<typeof scanLeagueOmr> | null = null;
      try {
        scanRequest = scanLeagueOmr({
          leagueId: id,
          file,
          scenarios,
          darknessThreshold: OMR_DARKNESS_THRESHOLD,
          marginThreshold: OMR_MARGIN_THRESHOLD,
        });
        const response = await withTimeout(
          scanRequest.unwrap(),
          OMR_SERVER_TIMEOUT_MS,
          "OMR 서버 분석 시간이 오래 걸려 기기 내 분석으로 전환합니다.",
        );
        result = response.result;
      } catch (error) {
        scanRequest?.abort();
        if (error instanceof Error && error.message.includes("기기 내 분석")) {
          // 고해상도 스캔 이미지는 서버 분석이 오래 걸릴 수 있어 기기 내 분석으로 넘김.
        }
        const scanResults = await Promise.all([
          sheetMarks.length
            ? scanOmrImage(file, sheetMarks).then((scanResult) => ({ result: scanResult, marks: sheetMarks }))
            : Promise.resolve({ result: {} as OmrScanResult, marks: sheetMarks }),
          tableMarks.length
            ? scanOmrImage(file, tableMarks).then((scanResult) => ({ result: scanResult, marks: tableMarks }))
            : Promise.resolve({ result: {} as OmrScanResult, marks: tableMarks }),
        ]);
        result = pickBestOmrResult(scanResults);
      }
      const updated = await applyOmrResult(result);
      if (updated === 0) {
        window.alert("인식된 마킹이 없습니다. 대진표가 화면에 꽉 차게 촬영되었는지 확인해 주세요.");
        return;
      }
      setForceScoreEditMode(true);
      window.alert(`${updated}개 경기의 점수를 OMR로 인식해 반영했습니다.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "OMR 인식에 실패했습니다.");
    }
  };

  const handleCloseLeague = async () => {
    if (!window.confirm("모든 경기가 종료되었습니까?")) return;
    await updateLeague({ id, updates: { status: "completed" } }).unwrap();
    setForceScoreEditMode(true);
    window.alert("리그가 종료되었습니다.");
  };

  if (leagueLoading || participantsLoading || matchesLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="omr-print-root" sx={{ bgcolor: "#F8FAFC", minHeight: "100%", p: { xs: 1.5, md: 3 }, "@media print": { bgcolor: "#fff", p: 0 } }}>
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
            ".omr-print-root, .omr-print-root *": {
              visibility: "visible !important",
            },
            ".omr-print-root": {
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
        <Typography sx={{ flex: 1, fontWeight: 900, fontSize: 18 }}>4인 OMR 대진표</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          sx={{ borderRadius: 1, fontWeight: 900 }}
        >
          출력
        </Button>
      </Stack>

      {participants.length !== 4 && (
        <Alert severity="warning" sx={{ mb: 1.5, "@media print": { display: "none" } }}>
          4인 OMR 리그는 참가자가 정확히 4명일 때 사용할 수 있습니다. 현재 {participantData?.participants.length ?? 0}명입니다.
        </Alert>
      )}

      {isIniting && (
        <Alert severity="info" sx={{ mb: 1.5, "@media print": { display: "none" } }}>
          경기표를 생성하는 중입니다.
        </Alert>
      )}

      <Box
        ref={scaleContainerRef}
        sx={{
          width: "100%",
          maxWidth: SHEET_WIDTH,
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
          width: SHEET_WIDTH,
          boxSizing: "border-box",
          transform: `scale(${sheetScale})`,
          transformOrigin: "top left",
          bgcolor: "#fff",
          border: "1px solid #D1D5DB",
          borderRadius: 1,
          p: 2,
          "@media print": {
            width: "100%",
            border: "none",
            borderRadius: 0,
            p: 0,
            transform: "none",
          },
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 1.2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 950, lineHeight: 1.2 }}>
              {sheetTitle}
            </Typography>
            <Typography sx={{ mt: 0.35, color: "#EF4444", fontSize: 11, fontWeight: 800 }}>
              각 경기의 득점 세트 수(0~3)를 선택하거나 출력 후 마킹해 주세요.
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
              onClick={handleRegisterResults}
              disabled={isCompleted}
              sx={{ borderRadius: 999, fontWeight: 900, minWidth: 72, px: 1.3, bgcolor: "#22C55E", "&:hover": { bgcolor: "#16A34A" } }}
            >
              결과 등록
            </Button>
            <Button
              variant="contained"
              size="small"
              disabled={isClosing || isCompleted}
              onClick={handleCloseLeague}
              sx={{ borderRadius: 999, fontWeight: 900, minWidth: 50, px: 1.3, bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" } }}
            >
              종료
            </Button>
          </Stack>
          <Box sx={{ width: 48, height: 48, p: 0.2, bgcolor: "#fff", flexShrink: 0 }}>
            <QRCode value={pageUrl} size={44} />
          </Box>
        </Stack>

        <Box
          component="table"
          ref={scoreTableRef}
          sx={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            "& th, & td": {
              border: "1px solid #9CA3AF",
              textAlign: "center",
              verticalAlign: "middle",
              px: 0.3,
              py: 0.45,
              fontSize: 12,
              overflow: "hidden",
            },
            "& th": { bgcolor: "#F3F4F6", fontWeight: 900 },
          }}
        >
          <thead>
            <tr>
              <th style={{ width: 96 }}>참가자명</th>
              {participants.map((participant, index) => (
                <th key={participant.id}>
                  <Stack alignItems="center" spacing={0.3}>
                    <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: "#F59E0B", color: "#111", fontWeight: 900, lineHeight: "18px", fontSize: 10 }}>
                      {index + 1}
                    </Box>
                    <Box sx={{ color: "#F59E0B", fontSize: 10, fontWeight: 900 }}>{divisionLabel(participant.division)}</Box>
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
                      <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: "#F59E0B", color: "#111", fontWeight: 900, lineHeight: "18px", fontSize: 10 }}>
                        {rowIndex + 1}
                      </Box>
                      <Box sx={{ color: "#F59E0B", fontSize: 10, fontWeight: 900 }}>{divisionLabel(rowPlayer.division)}</Box>
                      <Box>{rowPlayer.name}</Box>
                    </Stack>
                  </th>
                  {participants.map((colPlayer) => {
                    if (rowPlayer.id === colPlayer.id) {
                      return (
                        <td
                          key={colPlayer.id}
                          style={{
                            background:
                              "linear-gradient(28deg, transparent 49%, #D1D5DB 49.5%, #D1D5DB 50.5%, transparent 51%)",
                          }}
                        />
                      );
                    }
                    const match = matchLookup.get(matchKey(rowPlayer.id, colPlayer.id));
                    const selectedScore = getScoreFor(match, rowPlayer.id);
                    return (
                      <td key={colPlayer.id}>
                        {scoreEditMode ? (
                          <ScoreStepper
                            value={selectedScore}
                            disabled={!match || !canMark || isCompleted}
                            onChange={(score) => handleScore(match, rowPlayer.id, score)}
                          />
                        ) : (
                          <ScoreMarks
                            selected={selectedScore}
                            disabled={!match || !canMark || isCompleted}
                            matchId={match?.id}
                            playerId={rowPlayer.id}
                            onSelect={(score) => handleScore(match, rowPlayer.id, score)}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td style={{ fontWeight: 900 }}>{rowStat.wins}/{rowStat.losses}</td>
                  <td style={{ fontWeight: 900, color: isCompleted && rowStat.rank === 1 ? "#DC2626" : "#111827" }}>{rowStat.rank || ""}</td>
                  <td style={{ fontWeight: 900 }}>{rowStat.setTotal}/{rowStat.setLost}</td>
                </tr>
              );
            })}
          </tbody>
        </Box>

        <Box
          component="table"
          sx={{
            mt: 1.1,
            width: 310,
            borderCollapse: "collapse",
            tableLayout: "fixed",
            "& th, & td": {
              border: "1px solid #D1D5DB",
              textAlign: "center",
              verticalAlign: "middle",
              height: 24,
              fontSize: 12,
            },
            "& th": { fontWeight: 900, bgcolor: "#fff" },
            ...(isCompleted && {
              "& td": {
                bgcolor: "#8E8E8E",
                color: "#111",
              },
            }),
          }}
        >
          <tbody>
            <tr>
              <th rowSpan={3} style={{ width: 86, fontSize: 17 }}>경기순서</th>
              {MATCH_ORDER_PAIRS.map((_, index) => (
                <td key={`order-${index}`} style={{ color: "#374151" }}>{index + 1}</td>
              ))}
            </tr>
            <tr>
              {MATCH_ORDER_PAIRS.map(([a], index) => (
                <td key={`a-${index}`} style={{ fontSize: 18, fontWeight: 900 }}>{a}</td>
              ))}
            </tr>
            <tr>
              {MATCH_ORDER_PAIRS.map(([, b], index) => (
                <td key={`b-${index}`} style={{ fontSize: 18, fontWeight: 900 }}>{b}</td>
              ))}
            </tr>
          </tbody>
        </Box>
      </Box>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleResultFile}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.heic,.heif,.webp"
        hidden
        onChange={handleResultFile}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={handleResultFile}
      />

      <Dialog
        open={resultDialogOpen}
        onClose={() => setResultDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              overflow: "hidden",
              width: "min(360px, calc(100% - 48px))",
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 900, px: 2.5, py: 2 }}>
          작업 선택
        </DialogTitle>
        <DialogContent sx={{ p: 0, borderTop: "1px solid #E5E7EB" }}>
          <Stack direction="row" justifyContent="space-around" sx={{ py: 2.8 }}>
            <Button
              onClick={() => cameraInputRef.current?.click()}
              sx={{ flexDirection: "column", gap: 1, color: "#374151", minWidth: 86, fontWeight: 800 }}
            >
              <CameraAltIcon sx={{ fontSize: 30, color: "#777" }} />
              <Typography sx={{ fontSize: 11, fontWeight: 800 }}>카메라</Typography>
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              sx={{ flexDirection: "column", gap: 1, color: "#374151", minWidth: 86, fontWeight: 800 }}
            >
              <FolderIcon sx={{ fontSize: 32, color: "#777" }} />
              <Typography sx={{ fontSize: 11, fontWeight: 800 }}>내 파일</Typography>
            </Button>
            <Button
              onClick={() => galleryInputRef.current?.click()}
              sx={{ flexDirection: "column", gap: 1, color: "#374151", minWidth: 86, fontWeight: 800 }}
            >
              <ImageIcon sx={{ fontSize: 30, color: "#3156A6" }} />
              <Typography sx={{ fontSize: 11, fontWeight: 800 }}>사진 및 동영상</Typography>
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      </Box>
    </Box>
  );
}
