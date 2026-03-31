import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Box, Button, CircularProgress, Stack, Typography,
  Select, MenuItem, FormControl, InputLabel, Divider,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useGetLeagueQuery, useInitTournamentMatchesMutation } from "../../features/league/leagueApi";

const BRACKET_SIZES = [4, 8, 16, 32, 64, 128];

const SEEDING_OPTIONS = [
  { value: "manual", label: "수동",  desc: "관리자가 직접 배치한 순서로 대진을 구성합니다." },
  { value: "seed",   label: "시드",  desc: "부수 순으로 시드를 정해 자동 배치합니다." },
  { value: "group",  label: "조별",  desc: "각 부수(조) 1위는 다른 부수 2위와 대전. 같은 조끼리는 1라운드에서 만나지 않습니다." },
  { value: "random", label: "랜덤",  desc: "무작위로 배치합니다." },
];

const ADVANCEMENT_OPTIONS = [
  { value: "upper-only",  label: "상위 진출",    desc: "승자만 진출하는 단일 토너먼트" },
  { value: "upper-lower", label: "상·하위 진출", desc: "승자는 상위, 패자는 하위 토너먼트로 진출" },
];

export default function LeagueTournamentGenerate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isForce = searchParams.get("force") === "true";

  const { data, isLoading } = useGetLeagueQuery(id!);
  const [initTournament, { isLoading: isGenerating }] = useInitTournamentMatchesMutation();

  const league = data?.league;

  const [bracketSize, setBracketSize] = useState<number>(() => {
    const target = league?.recruit_count ?? 0;
    return BRACKET_SIZES.reduce((prev, cur) =>
      cur >= target && cur < prev ? cur : prev, 128);
  });
  const [seeding, setSeeding] = useState<string>(() => league?.tournament_seeding ?? "seed");
  const [advancement, setAdvancement] = useState<string>(() => league?.tournament_advancement ?? "upper-only");
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    try {
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

  const selectedSeedingDesc = SEEDING_OPTIONS.find((o) => o.value === seeding)?.desc ?? "";
  const selectedAdvancementDesc = ADVANCEMENT_OPTIONS.find((o) => o.value === advancement)?.desc ?? "";

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", pb: 6 }}>
      {/* 헤더 */}
      <Box sx={{ display: "flex", alignItems: "center", px: 1, pt: 1, pb: 0.5 }}>
        <Button
          startIcon={<ChevronLeftIcon />}
          onClick={() => navigate(-1)}
          sx={{ color: "text.primary", fontWeight: 700, minWidth: 0, px: 0.5 }}
        >
          뒤로
        </Button>
      </Box>

      <Box sx={{ px: 3, pt: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 0.5 }}>
          토너먼트 대진표 생성
        </Typography>
        {league && (
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 3 }}>
            {league.name}
          </Typography>
        )}

        <Stack spacing={3}>
          {/* 참가 인원 */}
          <Box>
            <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>
              참가 인원
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>참가 인원</InputLabel>
              <Select
                value={bracketSize}
                label="참가 인원"
                onChange={(e) => setBracketSize(Number(e.target.value))}
              >
                {BRACKET_SIZES.map((n) => (
                  <MenuItem key={n} value={n}>{n}명</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography fontSize={12} color="text.secondary" mt={0.8}>
              실제 참가자가 더 적으면 나머지는 부전승으로 처리됩니다.
            </Typography>
          </Box>

          <Divider />

          {/* 편성 방식 */}
          <Box>
            <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>
              편성 방식
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>편성 방식</InputLabel>
              <Select
                value={seeding}
                label="편성 방식"
                onChange={(e) => setSeeding(e.target.value)}
              >
                {SEEDING_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedSeedingDesc && (
              <Typography fontSize={12} color="text.secondary" mt={0.8}>
                {selectedSeedingDesc}
              </Typography>
            )}
          </Box>

          <Divider />

          {/* 다음 진출 방식 */}
          <Box>
            <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>
              다음 진출 방식
            </Typography>
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
            {selectedAdvancementDesc && (
              <Typography fontSize={12} color="text.secondary" mt={0.8}>
                {selectedAdvancementDesc}
              </Typography>
            )}
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
            mt: 4, borderRadius: 1, height: 48, fontWeight: 900, fontSize: 15,
            bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" },
          }}
        >
          {isGenerating ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "대진표 생성"}
        </Button>
      </Box>
    </Box>
  );
}
