import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Box, Button, CircularProgress, Stack, Typography,
  Select, MenuItem, FormControl,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import {
  useGetLeagueQuery,
  useInitTournamentMatchesMutation,
  useUpdateLeagueMutation,
} from "../../features/league/leagueApi";

const BRACKET_SIZES = [4, 8, 16, 32, 64, 128];

const TOURNAMENT_TYPE_OPTIONS = [
  { value: "upper-only",  label: "단일 토너먼트" },
  { value: "upper-lower", label: "상위부·하위부" },
];

const ADVANCEMENT_OPTIONS = [
  {
    value: "upper-only",
    label: "상위 진출",
    desc: "승자만 다음 라운드로 진출",
  },
  {
    value: "upper-lower",
    label: "상·하위 진출",
    desc: "1R 승자는 상위, 패자는 하위 토너먼트로 진출",
  },
];

const SEEDING_OPTIONS_DEFAULT = [
  { value: "seed",       label: "시드(순위)" },
  { value: "random",     label: "랜덤" },
  { value: "manual",     label: "수동" },
];

const SEEDING_OPTIONS_LEAGUE_TOURNAMENT = [
  { value: "standings", label: "시드(순위)" },
  { value: "random",    label: "랜덤" },
  { value: "manual",    label: "수동" },
];

const RULES_OPTIONS = [
  { value: "3전 2선승제", label: "3전 2선승제" },
  { value: "5전 3선승제", label: "5전 3선승제" },
  { value: "7전 4선승제", label: "7전 4선승제" },
];



export default function LeagueTournamentGenerate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isForce = searchParams.get("force") === "true";

  const { data, isLoading } = useGetLeagueQuery(id!);
  const [initTournament, { isLoading: isGenerating }] = useInitTournamentMatchesMutation();
  const [updateLeague] = useUpdateLeagueMutation();

  const league = data?.league;
  const isLeagueTournament = league?.format === "단일리그 + 토너먼트";
  const seedingOptions = isLeagueTournament ? SEEDING_OPTIONS_LEAGUE_TOURNAMENT : SEEDING_OPTIONS_DEFAULT;

  const [advancement, setAdvancement] = useState<string>("upper-only");
  const [upperBracketSize, setUpperBracketSize] = useState<number>(0);
  const [bracketSize, setBracketSize] = useState<number>(128);
  const [seeding, setSeeding] = useState<string>("seed");

  useEffect(() => {
    if (!league) return;
    setAdvancement(league.tournament_advancement ?? "upper-only");
    setUpperBracketSize(league.advance_count ?? 0);
    const target = league.recruit_count ?? 0;
    setBracketSize(BRACKET_SIZES.reduce((prev, cur) =>
      cur >= target && cur < prev ? cur : prev, 128));
    if (league.tournament_seeding) {
      setSeeding(league.tournament_seeding);
    } else {
      setSeeding(league.format === "단일리그 + 토너먼트" ? "standings" : "seed");
    }
  }, [league]);
  const [rules, setRules] = useState<string>(
    () => league?.tournament_rules ?? "5전 3선승제",
  );
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    try {
      // 본선 규칙 저장
      if (id && rules) {
        await updateLeague({ id, updates: { tournament_rules: rules } }).unwrap();
      }
      await initTournament({
        leagueId: id!,
        bracket_size: bracketSize,
        seeding,
        advancement,
        force: isForce || undefined,
      }).unwrap();
      navigate(`/league/${id}/tournament`);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setError(err?.data?.message ?? "오류가 발생했습니다.");
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", pb: 6 }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" sx={{ px: 1, pt: 1, pb: 0.5 }}>
        <Button
          startIcon={<ChevronLeftIcon />}
          onClick={() => navigate(-1)}
          sx={{ color: "text.primary", fontWeight: 700, minWidth: 0, px: 0.5 }}
        >
          토너먼트 대진표 생성
        </Button>
      </Stack>

      <Box sx={{ px: 3, pt: 1 }}>
        <Stack spacing={4}>

          {/* ① 토너먼트 유형 */}
          <Box>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>토너먼트 유형</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={advancement}
                    onChange={(e) => setAdvancement(e.target.value)}
                    displayEmpty
                  >
                    {TOURNAMENT_TYPE_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              {advancement === "upper-lower" && (
                <Box sx={{ flex: 1 }}>
                  <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>상위부 편성</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={upperBracketSize}
                      onChange={(e) => setUpperBracketSize(Number(e.target.value))}
                      displayEmpty
                      renderValue={(v) => v ? `${v}명` : "-선택-"}
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <MenuItem key={n} value={n}>{n}명</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Stack>
            <Typography fontSize={12} color="text.secondary" mt={0.8}>
              {advancement === "upper-only"
                ? "하나의 토너먼트 대진표에 전부 배정됩니다."
                : "예선 순위를 기준으로 상위부·하위부 토너먼트 대진표로 나뉘서 편성됩니다. (상위부 편성 외에는 하위부로 편성)"}
            </Typography>
          </Box>

          {/* ② 다음 진출 방식 */}
          <Box>
            <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>다음 진출 방식</Typography>
            <Stack direction="row" spacing={1.5}>
              {ADVANCEMENT_OPTIONS.map((o) => {
                const selected = advancement === o.value;
                return (
                  <Box
                    key={o.value}
                    onClick={() => setAdvancement(o.value)}
                    sx={{
                      flex: 1,
                      border: selected ? "2px solid #2F80ED" : "1.5px solid #E5E7EB",
                      borderRadius: 2,
                      p: 1.5,
                      cursor: "pointer",
                      bgcolor: selected ? "#EFF6FF" : "background.paper",
                      transition: "all 0.15s",
                    }}
                  >
                    <Typography fontSize={13} fontWeight={700} color={selected ? "#2F80ED" : "text.primary"}>
                      {o.label}
                    </Typography>
                    <Typography fontSize={11} color="text.secondary" mt={0.5}>
                      {o.desc}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>

          {/* ③ 본선 시작 단계 */}
          <Box>
            <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>본선 시작 단계</Typography>
            <FormControl fullWidth size="small">
              <Select
                value={bracketSize}
                displayEmpty
                onChange={(e) => setBracketSize(Number(e.target.value))}
              >
                {BRACKET_SIZES.map((n) => (
                  <MenuItem key={n} value={n}>{n}강</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography fontSize={12} color="text.secondary" mt={0.8}>
              참가인원이 부족할 경우 일부 경기는 부전승으로 처리됩니다.
            </Typography>
          </Box>

          {/* ④ 배치 방식 */}
          <Box>
            <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>배치 방식</Typography>
            <FormControl fullWidth size="small">
              <Select
                value={seeding}
                displayEmpty
                onChange={(e) => setSeeding(e.target.value)}
              >
                {seedingOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography fontSize={12} color="text.secondary" mt={0.8}>
              {seeding === "standings"
                ? "예선리그 순위를 기준으로 시드를 정해 자동 배치합니다."
                : seeding === "seed"
                ? "등록 순서 기준으로 시드를 정해 자동 배치합니다."
                : seeding === "random"
                ? "무작위로 배치합니다."
                : "관리자가 직접 선수를 배치합니다."}
            </Typography>
          </Box>

          {/* ⑤ 본선 규칙 */}
          <Box>
            <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>본선 규칙</Typography>
            <FormControl fullWidth size="small">
              <Select
                value={rules}
                displayEmpty
                onChange={(e) => setRules(e.target.value)}
              >
                {RULES_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

        </Stack>

        {error && (
          <Typography fontSize={13} color="error" mt={2}>
            {error}
          </Typography>
        )}

        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={handleGenerate}
          disabled={isGenerating}
          sx={{
            mt: 4, borderRadius: 2, height: 52, fontWeight: 900, fontSize: 16,
            bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" },
          }}
        >
          {isGenerating ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "완료"}
        </Button>


      </Box>
    </Box>
  );
}
