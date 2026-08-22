import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import type { LeagueParticipantItem } from "../features/league/leagueApi";

interface TieBreakRankingDialogProps {
  open: boolean;
  players: LeagueParticipantItem[];
  rankingOrder: string[];
  unresolvedTieGroups: string[][];
  saving?: boolean;
  onClose: () => void;
  onSave: (participantIds: string[]) => void | Promise<void>;
}

export default function TieBreakRankingDialog({
  open,
  players,
  rankingOrder,
  unresolvedTieGroups,
  saving = false,
  onClose,
  onSave,
}: TieBreakRankingDialogProps) {
  const [draftOrder, setDraftOrder] = useState<string[] | null>(null);
  const orderedIds = draftOrder ?? rankingOrder;
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const manualGroupById = useMemo(() => {
    const map = new Map<string, Set<string>>();
    unresolvedTieGroups.forEach((group) => {
      const ids = new Set(group);
      group.forEach((id) => map.set(id, ids));
    });
    return map;
  }, [unresolvedTieGroups]);

  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    const currentId = orderedIds[index];
    const targetId = orderedIds[targetIndex];
    const manualGroup = currentId ? manualGroupById.get(currentId) : undefined;
    if (!currentId || !targetId || !manualGroup?.has(targetId)) return;
    setDraftOrder(() => {
      const next = [...orderedIds];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const handleClose = () => {
    setDraftOrder(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : handleClose} maxWidth="xs" fullWidth sx={{ zIndex: 10003 }}>
      <DialogTitle sx={{ fontWeight: 900 }}>동점순위 결정</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.65, mb: 2 }}>
          동점자 간 세트 득실이 같을 경우 부수가 낮은 참가자가 높은 순위가 되며,
          부수도 동률일 경우 가위바위보를 하여 순위를 정합니다.
        </Typography>

        <Stack spacing={1}>
          {orderedIds.map((id, index) => {
            const player = playerById.get(id);
            if (!player) return null;
            const divisionLabel = player.division
              ? `${player.division}${String(player.division).endsWith("부") ? "" : "부"} `
              : "";
            const manualGroup = manualGroupById.get(id);
            const canMoveUp = index > 0 && Boolean(manualGroup?.has(orderedIds[index - 1]));
            const canMoveDown = index < orderedIds.length - 1 && Boolean(manualGroup?.has(orderedIds[index + 1]));
            return (
              <Box
                key={id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "34px 1fr auto",
                  alignItems: "center",
                  gap: 1,
                  p: 1,
                  border: "1px solid #E5E7EB",
                  borderRadius: 1.5,
                  bgcolor: manualGroup ? "#FFF7ED" : "#F8FAFC",
                }}
              >
                <Typography sx={{ fontWeight: 900, textAlign: "center" }}>{index + 1}</Typography>
                <Box minWidth={0}>
                  <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                    {divisionLabel}{player.name}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: manualGroup ? "#C2410C" : "text.secondary" }}>
                    {manualGroup ? "가위바위보 순위 지정" : "부수 우선 자동 확정"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <IconButton size="small" disabled={!canMoveUp || saving} onClick={() => move(index, -1)} aria-label={`${player.name} 순위 올리기`}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={!canMoveDown || saving} onClick={() => move(index, 1)} aria-label={`${player.name} 순위 내리기`}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={saving}>취소</Button>
        <Button variant="contained" onClick={() => onSave(orderedIds)} disabled={saving || unresolvedTieGroups.length === 0}>
          순위 확정
        </Button>
      </DialogActions>
    </Dialog>
  );
}
