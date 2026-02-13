import { useMemo, useState } from "react";
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
import CelebrationOutlinedIcon from "@mui/icons-material/CelebrationOutlined";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useGetLeagueParticipantsQuery, useGetLeaguesQuery } from "../../features/league/leagueApi";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setPreferredGroupId } from "../../features/league/leagueCreationSlice";

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
  const [selectedSourceLeagueId, setSelectedSourceLeagueId] = useState<string | null>(null);
  const [phase, setPhase] = useState<DrawPhase>("list");
  const [drawType, setDrawType] = useState<DrawType>("league");
  const [drawName, setDrawName] = useState("");
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
    return loaded.map((p, idx) => ({
      key: p.id,
      division: p.division || `${idx + 1}부`,
      name: p.name,
      weight: memberCounts[p.name] ?? 1,
    }));
  }, [participantData]);

  const startCreate = (type: DrawType, sourceName: string, sourceLeagueId: string) => {
    setDrawType(type);
    setSelectedSourceLeagueId(sourceLeagueId);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    setDrawName(`${y}-${m}-${d} ${sourceName} 추첨`);
    setPrizeName("");
    setQuantity(1);
    setPhase("create");
  };

  const runDraw = () => {
    if (!effectiveSelectedGroupId) return;
    setPhase("animating");
    window.setTimeout(() => {
      setResults((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          groupId: effectiveSelectedGroupId,
          type: drawType,
          name: drawName.trim() || `${drawType === "league" ? "리그" : "대회"} 추첨`,
          createdAt: new Date().toISOString(),
        },
      ]);
      setPhase("done");
    }, 1600);
  };

  if (!isLoggedIn) {
    return <EmptyCard text="로그인 후 이용 가능합니다." />;
  }

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
      <Stack spacing={2.5} alignItems="center" sx={{ pt: 4 }}>
        <Typography variant="h6" fontWeight={900}>
          추첨 생성 완료
        </Typography>
        <Typography color="text.secondary" fontWeight={700}>
          이제 우리리그에서 해당 추첨을 진행할 수 있습니다.
        </Typography>
        <Box
          sx={{
            mt: 3,
            width: "100%",
            height: 200,
            border: "2px solid #2F80ED",
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#2F80ED",
            fontWeight: 900,
          }}
        >
          <CelebrationOutlinedIcon sx={{ fontSize: 92, color: "#4E8DF5" }} />
        </Box>
        <Button fullWidth variant="contained" onClick={() => setPhase("list")} sx={{ borderRadius: 1, fontWeight: 700 }}>
          확인
        </Button>
      </Stack>
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
      {leagueSources.length > 0 ? (
        <Stack spacing={1}>
          {leagueSources.map((item) => (
            <ResultCard
              key={item.id}
              name={item.name}
              onClick={canCreate ? () => startCreate("league", item.name, item.id) : undefined}
            />
          ))}
        </Stack>
      ) : (
        <EmptyCard text="개설된 리그가 없습니다." />
      )}

      <SectionHeader title="대회 추첨" />
      {tournamentDraws.length > 0 ? (
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

function ResultCard({ name, onClick }: { name: string; onClick?: () => void }) {
  return (
    <Card
      elevation={2}
      onClick={onClick}
      sx={{
        borderRadius: 1,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <CardContent sx={{ py: 1.6, "&:last-child": { pb: 1.6 } }}>
        <Typography fontWeight={800}>{name}</Typography>
      </CardContent>
    </Card>
  );
}
