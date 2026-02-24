import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import TuneIcon from "@mui/icons-material/Tune";
import CachedIcon from "@mui/icons-material/Cached";
import HistoryIcon from "@mui/icons-material/History";
import confetti from "canvas-confetti";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useGetLeagueParticipantsQuery, useGetLeaguesQuery } from "../../features/league/leagueApi";
import { useGetDrawsQuery } from "../../features/draw/drawApi";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setPreferredGroupId } from "../../features/league/leagueCreationSlice";
import { generateId } from "../../utils/dateUtils";
import confettiImg from "../../assets/128_축포.png";

type DrawPhase = "list" | "create" | "animating" | "done";
type DrawType = "league" | "tournament";

type DrawResult = {
  id: string;
  groupId: string;
  type: DrawType;
  name: string;
  createdAt: string;
};
type DrawSourceItem = {
  id: string;
  name: string;
};

export default function DrawMain() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const preferredGroupId = useAppSelector((s) => s.leagueCreation.preferredGroupId);
  const isLoggedIn = !!token;

  const { data } = useGetMyGroupsQuery(undefined, {
    skip: !isLoggedIn,
    refetchOnMountOrArgChange: true,
  });
  const myGroups = useMemo(() => data?.groups ?? [], [data]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const selectedSourceLeagueId = null;
  const [phase, setPhase] = useState<DrawPhase>("list");
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase !== "done") return;
    const fire = (originX: number, angle: number) =>
      confetti({ particleCount: 6, angle, spread: 50, origin: { x: originX, y: 0.65 }, colors: ["#2F80ED", "#56CCF2", "#F2994A", "#27AE60", "#EB5757"], zIndex: 9999 });
    let count = 0;
    animationRef.current = setInterval(() => {
      fire(0.1, 60);
      fire(0.9, 120);
      if (++count >= 8) { clearInterval(animationRef.current!); animationRef.current = null; }
    }, 200);
    return () => { if (animationRef.current) clearInterval(animationRef.current); };
  }, [phase]);
  const drawType: DrawType = "league";
  const drawName = "";
  const [prizeName, setPrizeName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [results, setResults] = useState<DrawResult[]>([]);

  const defaultGroupId = useMemo(() => {
    if (myGroups.length === 0) return null;
    if (preferredGroupId && myGroups.some((g) => g.id === preferredGroupId)) {
      return preferredGroupId;
    }
    return myGroups[0].id;
  }, [myGroups, preferredGroupId]);

  const effectiveSelectedGroupId =
    selectedGroupId && myGroups.some((g) => g.id === selectedGroupId)
      ? selectedGroupId
      : defaultGroupId;

  const selectedGroup = effectiveSelectedGroupId
    ? myGroups.find((g) => g.id === effectiveSelectedGroupId) ?? null
    : null;

  const canCreate =
    isLoggedIn &&
    !!selectedGroup &&
    (selectedGroup.role === "owner" || selectedGroup.role === "admin");

  const { data: leagueData } = useGetLeaguesQuery(
    effectiveSelectedGroupId ? { group_id: effectiveSelectedGroupId } : undefined,
    { skip: !isLoggedIn || !effectiveSelectedGroupId, refetchOnMountOrArgChange: true },
  );
  const leagueSources = useMemo<DrawSourceItem[]>(
    () => (leagueData?.leagues ?? []).map((l) => ({ id: l.id, name: l.name })),
    [leagueData],
  );

  const tournamentDraws = useMemo(
    () => results.filter((r) => r.groupId === effectiveSelectedGroupId && r.type === "tournament"),
    [results, effectiveSelectedGroupId],
  );

  const { data: participantData, isLoading: isLoadingParticipants, error: participantError } = useGetLeagueParticipantsQuery(
    selectedSourceLeagueId ?? "",
    {
      skip: !selectedSourceLeagueId || phase !== "create",
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const participantRows = useMemo(() => {
    const loaded = participantData?.participants ?? [];
    const memberCounts: Record<string, number> = {};
    return loaded.map((p) => ({
      key: p.id,
      division: p.division || "-",
      name: p.name,
      weight: memberCounts[p.name] ?? 1,
    }));
  }, [participantData]);

  const runDraw = () => {
    if (!effectiveSelectedGroupId) return;
    setPhase("animating");
    window.setTimeout(() => {
      setResults((prev) => [
        ...prev,
        {
          id: generateId(),
          groupId: effectiveSelectedGroupId,
          type: drawType,
          name: drawName.trim() || `${drawType === "league" ? "리그" : "대회"} 추첨`,
          createdAt: new Date().toISOString(),
        },
      ]);
      setPhase("done");
    }, 1600);
  };

  if (phase === "create") {
    return (
      <Stack spacing={2.2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => setPhase("list")} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography fontWeight={900} fontSize={20}>
            {drawType === "league" ? "리그 추첨" : "대회 추첨"}
          </Typography>
        </Stack>

        <Typography variant="h6" fontWeight={900}>
          추첨하기
        </Typography>

        <Typography fontWeight={800} fontSize={14}>경품</Typography>
        <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <CardContent sx={{ p: 1.5, display: "grid", gap: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="상품명"
                value={prizeName}
                onChange={(e) => setPrizeName(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Select
                size="small"
                value={String(quantity)}
                onChange={(e: SelectChangeEvent<string>) => setQuantity(Number(e.target.value))}
                sx={{ width: 84 }}
              >
                {[1, 2, 3, 4, 5].map((q) => (
                  <MenuItem key={q} value={String(q)}>
                    {q}명
                  </MenuItem>
                ))}
              </Select>
              <Button size="small" variant="outlined" sx={{ minWidth: 50 }}>
                완료
              </Button>
              <IconButton size="small">
                <DragHandleIcon fontSize="small" />
              </IconButton>
            </Stack>

            <TextField size="small" placeholder="당첨자" disabled />
          </CardContent>
        </Card>

        <Button
          fullWidth
          variant="contained"
          disableElevation
          sx={{
            borderRadius: 1,
            bgcolor: "#BDBDBD",
            color: "#111",
            fontWeight: 700,
            py: 0.9,
            "&:hover": { bgcolor: "#AFAFAF" },
          }}
        >
          추가하기
        </Button>

        <Divider sx={{ my: 0.5 }} />

        <Typography variant="subtitle1" fontWeight={900}>
          참가자
        </Typography>

        {isLoadingParticipants ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : participantError ? (
          <Typography sx={{ color: "#E53935", textAlign: "center", py: 3, fontWeight: 700 }}>
            참가자 목록을 불러오는데 실패했습니다.
          </Typography>
        ) : participantRows.length === 0 ? (
          <Typography sx={{ color: "#6B7280", textAlign: "center", py: 3, fontWeight: 700 }}>
            참가자가 없습니다.
          </Typography>
        ) : (
          <>
            <Stack direction="row" sx={{ px: 0.5 }}>
              <Typography variant="caption" sx={{ width: 52, color: "text.secondary", fontWeight: 700 }}>
                부수
              </Typography>
              <Typography variant="caption" sx={{ flex: 1, color: "text.secondary", fontWeight: 700 }}>
                이름
              </Typography>
              <Typography variant="caption" sx={{ width: 72, color: "text.secondary", fontWeight: 700 }}>
                확률
              </Typography>
            </Stack>
            <Divider />

            <Stack spacing={0.8}>
              {participantRows.map((row) => (
                <Stack key={row.key} direction="row" alignItems="center" sx={{ px: 0.5 }}>
                  <Box sx={{ width: 52 }}>
                    <Chip label={row.division} size="small" sx={{ height: 22, fontWeight: 800 }} />
                  </Box>
                  <Typography sx={{ flex: 1, fontWeight: 800, fontSize: 16 }}>{row.name}</Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ width: 72 }}>
                    <Typography sx={{ fontWeight: 900 }}>-</Typography>
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        border: "1px solid #BDBDBD",
                        borderRadius: 0.5,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {row.weight}
                    </Box>
                    <Typography sx={{ fontWeight: 900 }}>+</Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </>
        )}

        <Divider sx={{ my: 0.5 }} />

        <Button
          fullWidth
          variant="contained"
          onClick={runDraw}
          disableElevation
          sx={{ borderRadius: 1, py: 1.1, fontWeight: 700 }}
        >
          완료
        </Button>
      </Stack>
    );
  }

  if (phase === "animating") {
    return (
      <Stack spacing={3} alignItems="center" sx={{ pt: 8 }}>
        <CachedIcon sx={{ fontSize: 52 }} />
        <Typography color="text.secondary" fontWeight={700}>
          추첨 진행 중...
        </Typography>
        <Box sx={{ width: "100%", maxWidth: 260 }}>
          <LinearProgress />
        </Box>
      </Stack>
    );
  }

  if (phase === "done") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: 2.5,
          pt: 1,
        }}
      >
        <Typography variant="h6" fontSize={32} fontWeight={900} color="#2F80ED" mt={2}>
          추첨 생성 완료
        </Typography>
        <Typography color="text.secondary" fontWeight={700} mt={1}>
          이제 우리리그에서 해당 추첨을 진행할 수 있습니다.
        </Typography>
        <Box
          sx={{
            mt: 3,
            width: "100%",
            height: 200,
            // border: "2px solid #2F80ED",
            borderRadius: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <Box
            component="img"
            src={confettiImg}
            alt="축하"
            sx={{
              width: 180,
              height: 180,
              objectFit: "contain",
            }}
          />
          {/* <Typography sx={{ fontSize: 156, lineHeight: 1, mb: 4 }}>🎉</Typography> */}
          {/* <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#2F80ED" }}>축하합니다!</Typography> */}
        </Box>
        <Button fullWidth variant="contained" onClick={() => { if (animationRef.current) { clearInterval(animationRef.current); animationRef.current = null; } setPhase("list"); }} 
          sx={{
            mt: 3,
            borderRadius: 1,
            height: 44,
            fontWeight: 900,
            bgcolor: "#2F80ED",
            "&:hover": { bgcolor: "#256FD1" },
          }}
        >
          확인
        </Button>
      </Box>
    );
  }

  return (
    <Stack spacing={2.2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" fontWeight={900} lineHeight={1.1}>
          {user?.name || user?.email || "우리리그"}
        </Typography>
        {myGroups.length > 1 && (
          <Select
            size="small"
            value={effectiveSelectedGroupId ?? ""}
            onChange={(e: SelectChangeEvent<string>) => {
              const nextGroupId = e.target.value;
              setSelectedGroupId(nextGroupId || null);
              dispatch(setPreferredGroupId(nextGroupId || null));
            }}
            sx={{
              borderRadius: 1,
              height: 32,
              fontSize: "0.85rem",
              fontWeight: 700,
              bgcolor: "#EEF2FF",
              "& .MuiSelect-select": { py: 0.5, px: 1.5 },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#C7D2FE" },
            }}
          >
            {myGroups.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Stack>

      <SectionHeader title="리그 추첨" />
      {!isLoggedIn ? (
        <EmptyCard text="로그인 후 이용할 수 있습니다." />
      ) : myGroups.length === 0 ? (
        <EmptyCard text="가입된 클럽이 없습니다." />
      ) : leagueSources.length > 0 ? (
        <Stack spacing={1}>
          {leagueSources.map((item) => (
            <LeagueResultCard
              key={item.id}
              item={item}
              canCreate={canCreate}
              navigate={navigate}
            />
          ))}
        </Stack>
      ) : (
        <EmptyCard text="개설된 리그가 없습니다." />
      )}

      <SectionHeader title="대회 추첨" />
      {!isLoggedIn ? (
        <EmptyCard text="로그인 후 이용할 수 있습니다." />
      ) : tournamentDraws.length > 0 ? (
        <Stack spacing={1}>
          {tournamentDraws.map((d) => (
            <ResultCard key={d.id} name={d.name} />
          ))}
        </Stack>
      ) : (
        <EmptyCard text="개설된 대회가 없습니다." />
      )}
    </Stack>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="subtitle1" fontWeight={900}>
        {title}
      </Typography>
      <IconButton size="small">
        <TuneIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <CardContent
        sx={{
          py: 2.2,
          px: 2,
          minHeight: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          "&:last-child": { pb: 2.2 },
        }}
      >
        <Typography color="text.secondary" fontWeight={700}>
          {text}
        </Typography>
      </CardContent>
    </Card>
  );
}

function LeagueResultCard({ item, canCreate, navigate }: {
  item: { id: string; name: string };
  canCreate: boolean;
  navigate: (path: string) => void;
}) {
  const { data } = useGetDrawsQuery(item.id, { refetchOnMountOrArgChange: true });
  const hasDraws = (data?.draws?.length ?? 0) > 0;
  return (
    <ResultCard
      name={item.name}
      onClick={canCreate ? () => navigate(`/draw/${item.id}?create=1`) : undefined}
      onHistory={hasDraws ? () => navigate(`/draw/${item.id}`) : undefined}
    />
  );
}

function ResultCard({ name, onClick, onHistory }: { name: string; onClick?: () => void; onHistory?: () => void }) {
  return (
    <Card
      elevation={2}
      sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
    >
      <CardContent sx={{ py: 1.2, px: 2, "&:last-child": { pb: 1.2 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontWeight={800} sx={{ flex: 1, minWidth: 0 }} noWrap>{name}</Typography>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {onHistory && (
              <IconButton size="small" onClick={onHistory} sx={{ color: "#6B7280" }} title="추첨 목록">
                <HistoryIcon fontSize="small" />
              </IconButton>
            )}
            {onClick && (
              <Button
                size="small"
                variant="outlined"
                onClick={onClick}
                sx={{ fontWeight: 700, borderRadius: 1, whiteSpace: "nowrap" }}
              >
                추첨하기
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
