import { useMemo, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  useDeleteAllLeagueMatchesMutation,
  useDeleteLeagueProgramMutation,
  useGetLeagueProgramQuery,
  useGetLeagueMatchesQuery,
  useGetLeagueParticipantsQuery,
  useGetLeagueQuery,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { formatLeagueDate } from "../../utils/dateUtils";
import { distributeSnake } from "../../features/league/algorithms/distributeSnake";

const ADVANCEMENT_LABEL: Record<string, string> = {
  "upper-only": "상위 진출",
  "upper-lower": "상·하위 진출",
};

const SEEDING_LABEL: Record<string, string> = {
  manual: "수동",
  seed: "시드",
  random: "랜덤",
};

type StoredProgramBlock = {
  title?: string;
  type?: "SINGLES" | "DOUBLES" | "TEAM";
  format?: "LEAGUE" | "GROUP" | "TOURNAMENT";
  groupSizes?: number[];
  teamGroupSizes?: number[];
  groupShuffleSeed?: number;
  teamShuffleSeed?: number;
};

type StoredProgramOption = {
  title?: string;
  groupSizes?: number[];
  blocks?: StoredProgramBlock[];
};

function getProgramTypeLabel(type?: StoredProgramBlock["type"]) {
  switch (type) {
    case "SINGLES":
      return "단식";
    case "DOUBLES":
      return "복식";
    case "TEAM":
      return "단체전";
    default:
      return "";
  }
}

function getProgramFormatLabel(format?: StoredProgramBlock["format"]) {
  switch (format) {
    case "LEAGUE":
      return "단일리그";
    case "GROUP":
      return "조별리그";
    case "TOURNAMENT":
      return "토너먼트";
    default:
      return "";
  }
}

function getProgramBracketPath(format?: StoredProgramBlock["format"]) {
  return format === "TOURNAMENT" ? "tournament-bracket" : "bracket";
}

function getProgramBracketLabel() {
  return "대진표 보기";
}

export default function LeagueProgramList() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id!);
  const { data: matchesData, isLoading: matchesLoading } = useGetLeagueMatchesQuery(id!);
  const { data: participantsData, isLoading: participantsLoading } = useGetLeagueParticipantsQuery(id!, { skip: !id });
  const { data: programData, isLoading: programLoading } = useGetLeagueProgramQuery(id!, { skip: !id });
  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(
    leagueData?.league?.group_id ?? "",
    { skip: !leagueData?.league?.group_id },
  );
  const [deleteAllMatches, { isLoading: isDeleting }] = useDeleteAllLeagueMatchesMutation();
  const [deleteLeagueProgram] = useDeleteLeagueProgramMutation();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [storedProgram, setStoredProgram] = useState<StoredProgramOption | null>(null);
  const [formationDialog, setFormationDialog] = useState<{ roundIndex: number; mode: "team" | "group" } | null>(null);

  const league = leagueData?.league;
  const matches = matchesData?.matches ?? [];
  const participants = participantsData?.participants ?? [];
  const hasProgram = Boolean(storedProgram?.blocks?.length);
  const canManage = !groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin");

  const programRounds = storedProgram?.blocks?.length
    ? storedProgram.blocks.map((block, index) => ({
        round: index + 1,
        title: block.title ?? `${index + 1}라운드 ${getProgramTypeLabel(block.type)}`.trim(),
        format: block.format ?? "GROUP",
        formatLabel: getProgramFormatLabel(block.format),
        bracketLabel: getProgramBracketLabel(),
        bracketPath: getProgramBracketPath(block.format),
        type: block.type,
      }))
    : [];

  const r1Match = matches.find((m) => m.round_number === 1 && m.bracket === "upper");
  const bracketSizeLabel = r1Match?.match_label ?? "";
  const advancementLabel = ADVANCEMENT_LABEL[league?.tournament_advancement ?? ""] ?? "";
  const seedingLabel = SEEDING_LABEL[league?.tournament_seeding ?? ""] ?? "";
  const isLoading = leagueLoading || matchesLoading || groupLoading || programLoading || participantsLoading;

  useEffect(() => {
    setStoredProgram((programData?.program?.program_data as StoredProgramOption | null | undefined) ?? null);
  }, [programData]);

  const programPlayers = useMemo(() => {
    return [...participants]
      .map((participant) => {
        const level = Number.parseInt(participant.division ?? "", 10);
        return {
          name: participant.name,
          level: Number.isNaN(level) ? 999 : level,
        };
      })
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [participants]);

  const rotateBySeed = <T,>(items: T[], seed: number) => {
    if (items.length < 2) return items;
    const offset = seed % items.length || 1;
    const rotated = [...items.slice(offset), ...items.slice(0, offset)];
    return Math.floor(seed / items.length) % 2 === 1
      ? rotated.reverse()
      : rotated;
  };

  const reshuffleWithinLevel = <T extends { level?: number }>(items: T[], seed?: number) => {
    if (seed == null) return items;
    const buckets = new Map<number, T[]>();
    items.forEach((item) => {
      const level = item.level ?? 999;
      buckets.set(level, [...(buckets.get(level) ?? []), item]);
    });
    return [...buckets.keys()]
      .sort((a, b) => a - b)
      .flatMap((level) => rotateBySeed(buckets.get(level) ?? [], seed + level * 997));
  };

  const formatFormationName = (name: string, level?: number) =>
    level == null ? name : name.replace(new RegExp(`\\s*\\(${level}\\)$`), "");

  const splitIntoTwoGroups = (count: number) => {
    if (count <= 0) return [];
    if (count <= 2) return [count];
    return [Math.ceil(count / 2), Math.floor(count / 2)];
  };

  const activeFormationBlock = formationDialog && storedProgram?.blocks
    ? storedProgram.blocks[formationDialog.roundIndex]
    : undefined;
  const teamGroupSizes = activeFormationBlock?.groupSizes ?? storedProgram?.groupSizes ?? [programPlayers.length];
  const defaultFormationSeed = formationDialog ? (formationDialog.roundIndex + 1) * 1000 : 0;
  const teamFormationPlayers = reshuffleWithinLevel(
    programPlayers,
    activeFormationBlock?.teamShuffleSeed ?? defaultFormationSeed + 101,
  );
  const teamResultGroups = activeFormationBlock
    ? distributeSnake(teamFormationPlayers, teamGroupSizes)
    : [];
  const teamUnits = teamResultGroups.map((team, teamIndex) => {
    const leader = team.players[0];
    return {
      name: `팀 ${leader?.name ?? teamIndex + 1}`,
      level: leader?.level ?? teamIndex + 1,
      roster: team.players,
    };
  });
  const groupResultSizes = activeFormationBlock?.type === "TEAM"
    ? activeFormationBlock?.teamGroupSizes ?? splitIntoTwoGroups(teamUnits.length)
    : activeFormationBlock?.groupSizes ?? storedProgram?.groupSizes ?? [programPlayers.length];
  const formationGroups = formationDialog?.mode === "team"
    ? teamResultGroups
    : activeFormationBlock?.type === "TEAM"
      ? distributeSnake(reshuffleWithinLevel(teamUnits, activeFormationBlock?.groupShuffleSeed ?? defaultFormationSeed + 503), groupResultSizes)
      : distributeSnake(reshuffleWithinLevel(programPlayers, activeFormationBlock?.groupShuffleSeed ?? defaultFormationSeed + 503), groupResultSizes);

  const handleDelete = async () => {
    setConfirmOpen(false);
    if (!id || !canManage) return;

    try {
      await deleteLeagueProgram({ leagueId: id }).unwrap();
      localStorage.removeItem(`league-program-${id}`);
      setStoredProgram(null);
      await deleteAllMatches({ leagueId: id }).unwrap();
    } catch {
      // 서버 삭제 실패 시 현재 프로그램 캐시를 유지합니다.
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
    <Box sx={{ maxWidth: 500, mx: "auto", pb: 8 }}>
      <Stack direction="row" alignItems="center" sx={{ px: 1, pt: 1.5, pb: 1 }}>
        <IconButton size="small" onClick={() => navigate(`/league/${id}`)} sx={{ mr: 0.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: 17, fontWeight: 900, flex: 1 }}>
          이벤트 프로그램
        </Typography>
        {canManage && (
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            onClick={() => navigate(`/league/${id}/program/new`)}
            sx={{
              borderRadius: "20px",
              fontSize: 12,
              fontWeight: 700,
              px: 1.5,
              height: 32,
              textTransform: "none",
              boxShadow: "none",
              bgcolor: "#2563EB",
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            생성
          </Button>
        )}
      </Stack>

      {league && (
        <Stack direction="row" spacing={0.75} sx={{ px: 2, pb: 2, flexWrap: "wrap" }}>
          <Chip label={formatLeagueDate(league.start_date)} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F1F5F9", color: "#475569", height: 24 }} />
          {league.type && <Chip label={league.type} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F1F5F9", color: "#475569", height: 24 }} />}
          {league.rules && <Chip label={league.rules} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F1F5F9", color: "#475569", height: 24 }} />}
        </Stack>
      )}

      <Box sx={{ px: 2 }}>
        {hasProgram ? (
          <Box sx={{ bgcolor: "#fff", border: "1px solid #E5E7EB", borderRadius: 2, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <Box sx={{ height: 4, bgcolor: "#2563EB", borderRadius: "8px 8px 0 0" }} />

            <Box sx={{ px: 2.5, pt: 2, pb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AccountTreeOutlinedIcon sx={{ fontSize: 20, color: "#2563EB" }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>
                    {storedProgram?.title ?? `${league?.type ?? "클럽 이벤트"} 프로그램`}
                  </Typography>
                  {league?.start_date && (
                    <Typography sx={{ fontSize: 12, color: "#94A3B8", mt: 0.2 }}>
                      {formatLeagueDate(league.start_date)}
                    </Typography>
                  )}
                </Box>
              </Stack>

              <Stack direction="row" spacing={0.75} flexWrap="wrap" mb={2}>
                {bracketSizeLabel && <Chip label={bracketSizeLabel} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#EFF6FF", color: "#2563EB", height: 22, border: "1px solid #BFDBFE" }} />}
                {advancementLabel && <Chip label={advancementLabel} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F5F3FF", color: "#7C3AED", height: 22, border: "1px solid #DDD6FE" }} />}
                {seedingLabel && <Chip label={`시드: ${seedingLabel}`} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F0FDF4", color: "#16A34A", height: 22, border: "1px solid #BBF7D0" }} />}
              </Stack>

              <Stack spacing={1}>
                {programRounds.map((round) => (
                  <Box key={round.round} sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, p: 1.25, bgcolor: "#F9FAFB" }}>
                    <Stack direction="row" alignItems="center" spacing={0.75} mb={1}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, flex: 1 }}>
                        {round.title}
                      </Typography>
                      <Chip label={round.formatLabel} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }} />
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        disableElevation
                        endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
                        onClick={() => navigate(`/league/${id}/program/matches?program=1&round=${round.round}`)}
                        sx={{ flex: 1, height: 38, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap", borderColor: "#2563EB", color: "#2563EB", "&:hover": { bgcolor: "#EFF6FF" } }}
                      >
                        경기 순서
                      </Button>
                      <Button
                        variant="contained"
                        disableElevation
                        endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
                        onClick={() => navigate(`/league/${id}/program/${round.bracketPath}?program=1&round=${round.round}&format=${round.format}`)}
                        sx={{ flex: 1, height: 38, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", boxShadow: "none", whiteSpace: "nowrap", bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }}
                      >
                        {round.bracketLabel}
                      </Button>
                    </Stack>

                    {(round.type === "TEAM" || round.format === "GROUP") && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        {round.type === "TEAM" && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setFormationDialog({ roundIndex: round.round - 1, mode: "team" })}
                            sx={{ flex: 1, height: 34, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap" }}
                          >
                            팀 편성 결과
                          </Button>
                        )}
                        {round.format === "GROUP" && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setFormationDialog({ roundIndex: round.round - 1, mode: "group" })}
                            sx={{ flex: 1, height: 34, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap" }}
                          >
                            조 편성 결과
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Box>
                ))}

                {canManage && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditOutlinedIcon sx={{ fontSize: 15 }} />}
                      onClick={() => navigate(`/league/${id}/program/new?edit=true`)}
                      sx={{ flex: 1, height: 36, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap", borderColor: "#E5E7EB", color: "#6B7280", "&:hover": { bgcolor: "#F9FAFB" } }}
                    >
                      프로그램 수정
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DeleteOutlineIcon sx={{ fontSize: 15 }} />}
                      onClick={() => setConfirmOpen(true)}
                      disabled={isDeleting}
                      sx={{ flex: 1, height: 36, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap", borderColor: "#FEE2E2", color: "#EF4444", "&:hover": { bgcolor: "#FFF5F5" } }}
                    >
                      삭제
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Box>
          </Box>
        ) : (
          <Box sx={{ bgcolor: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 2, py: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AccountTreeOutlinedIcon sx={{ fontSize: 26, color: "#94A3B8" }} />
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                프로그램이 없습니다
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#9CA3AF", mt: 0.3 }}>
                {canManage ? "프로그램을 생성해 주세요." : "아직 프로그램이 생성되지 않았습니다."}
              </Typography>
            </Box>
            {canManage && (
              <Button
                variant="contained"
                disableElevation
                startIcon={<AddIcon />}
                onClick={() => navigate(`/league/${id}/program/new`)}
                sx={{ mt: 0.5, borderRadius: 1.5, fontWeight: 700, fontSize: 13, textTransform: "none", boxShadow: "none", bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }}
              >
                프로그램 생성
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Dialog
        open={formationDialog !== null}
        onClose={() => setFormationDialog(null)}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>
          {formationDialog?.mode === "team" ? "팀 편성 결과" : "조 편성 결과"}
        </DialogTitle>
        <DialogContent dividers>
          {formationGroups.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: "text.secondary", py: 2, textAlign: "center" }}>
              편성 결과가 없습니다.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 1.25,
              }}
            >
            {formationGroups.map((group) => (
            <Box
              key={group.name}
              sx={{
                border: "1px solid #E5E7EB",
                borderRadius: 1.5,
                p: 1.5,
                bgcolor: "#fff",
              }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 900, mb: 1.25 }}>
                {formationDialog?.mode === "team" ? group.name.replace(/조$/, "팀") : group.name}
              </Typography>
              <Stack spacing={0.75}>
                {group.players.map((player) => {
                  const roster = (player as typeof player & { roster?: Array<{ name: string; level: number }> }).roster;
                  return (
                    <Box key={player.name}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                        {player.level}부 - {formatFormationName(player.name, player.level)}
                      </Typography>
                      {roster && (
                        <Box sx={{ pl: 1.5, mt: 0.5, color: "#6B7280" }}>
                          {roster.map((member) => (
                            <Typography key={member.name} sx={{ fontSize: 12 }}>
                              {member.level}부 - {formatFormationName(member.name, member.level)}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Box>
            ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setFormationDialog(null)} sx={{ fontWeight: 700 }}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}>
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>프로그램 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>
            생성된 프로그램을 삭제하면 프로그램 경기 정보가 사라집니다. 계속하시겠습니까?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ color: "text.secondary", fontWeight: 700 }}>
            취소
          </Button>
          <Button onClick={handleDelete} variant="contained" disableElevation sx={{ bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" }, fontWeight: 700, borderRadius: 1 }}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
