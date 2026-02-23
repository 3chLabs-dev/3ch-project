import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  TextField,
  Checkbox,
  Button,
  Stack,
  FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { Participant } from "../../features/league/leagueCreationSlice";

type Props = {
  open: boolean;
  participant: Participant;
  onClose: () => void;
  onSave: (updated: Participant) => void;
};

export default function ParticipantDetailDialog({
  open,
  participant,
  onClose,
  onSave,
}: Props) {
  const [division, setDivision] = useState(participant.division || "");
  const [name, setName] = useState(participant.name);
  const [paid, setPaid] = useState(participant.paid);
  const [arrived, setArrived] = useState(participant.arrived);
  const [footPool, setFootPool] = useState(participant.footPool);

  const [prevParticipant, setPrevParticipant] = useState(participant);
  if (prevParticipant !== participant) {
    setPrevParticipant(participant);
    setDivision(participant.division || "");
    setName(participant.name);
    setPaid(participant.paid);
    setArrived(participant.arrived);
    setFootPool(participant.footPool);
  }

  const handleSave = () => {
    onSave({
      division: division.trim(),
      name: name.trim(),
      paid,
      arrived,
      footPool,
    });

    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 1,
          overflow: "hidden",
          maxWidth: 430,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontWeight: 900, fontSize: 18 }}>참가자 상세</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.8, color: "#6B7280" }}>
              이름
            </Typography>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: "#fff" },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.8, color: "#6B7280" }}>
              부수
            </Typography>
            <TextField
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="예: 1부, 2부, A조"
              fullWidth
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: "#fff" },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1, color: "#6B7280" }}>
              상태
            </Typography>
            <Stack spacing={0.5}>
              <FormControlLabel
                control={<Checkbox checked={paid} onChange={(e) => setPaid(e.target.checked)} />}
                label={<Typography sx={{ fontWeight: 700 }}>입금 완료</Typography>}
              />
              <FormControlLabel
                control={<Checkbox checked={arrived} onChange={(e) => setArrived(e.target.checked)} />}
                label={<Typography sx={{ fontWeight: 700 }}>도착 완료</Typography>}
              />
              <FormControlLabel
                control={<Checkbox checked={footPool} onChange={(e) => setFootPool(e.target.checked)} />}
                label={<Typography sx={{ fontWeight: 700 }}>뒷풀이 참여</Typography>}
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ width: "100%" }}>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={onClose}
            sx={{
              borderRadius: 1,
              height: 40,
              fontWeight: 900,
              bgcolor: "#BDBDBD",
              "&:hover": { bgcolor: "#BDBDBD" },
            }}
          >
            취소
          </Button>

          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={handleSave}
            disabled={!name.trim()}
            sx={{
              borderRadius: 1,
              height: 40,
              fontWeight: 900,
              bgcolor: "#2F80ED",
              "&:hover": { bgcolor: "#256FD1" },
              "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" },
            }}
          >
            저장
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}