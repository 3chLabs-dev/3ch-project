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
  Button,
  Stack,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

type Props = {
  open: boolean;
  member: {
    id: string;
    name: string;
    email: string;
    role: "owner" | "admin" | "member";
    division?: string;
  };
  onClose: () => void;
  onSave: (updated: { role: "owner" | "admin" | "member"; division: string }) => void;
  onRemove?: () => void;
  isOwner: boolean;
};

export default function MemberEditDialog({
  open,
  member,
  onClose,
  onSave,
  onRemove,
  isOwner,
}: Props) {
  const [role, setRole] = useState(member.role);
  const [division, setDivision] = useState(member.division || "");

  const handleSave = () => {
    onSave({
      role,
      division: division.trim(),
    });
    handleClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
          <Typography sx={{ fontWeight: 900, fontSize: 18 }}>모임원 수정</Typography>
          <IconButton onClick={handleClose} size="small">
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
              value={member.name || member.email}
              disabled
              fullWidth
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: "#F9FAFB" },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.8, color: "#6B7280" }}>
              역할
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value as "owner" | "admin" | "member")}
                disabled={!isOwner || member.role === "owner"}
                sx={{
                  borderRadius: 1,
                  bgcolor: !isOwner || member.role === "owner" ? "#F9FAFB" : "#fff",
                }}
              >
                <MenuItem value="owner">모임장</MenuItem>
                <MenuItem value="admin">운영진</MenuItem>
                <MenuItem value="member">멤버</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.8, color: "#6B7280" }}>
              부수
            </Typography>
            <TextField
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="예: 1부, 2부, A조 등"
              fullWidth
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: "#fff" },
              }}
            />
          </Box>

          {onRemove && member.role !== "owner" && (
            <Box sx={{ textAlign: "center", pt: 1 }}>
              <Button
                onClick={onRemove}
                size="small"
                sx={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#EF4444",
                  textDecoration: "underline",
                  "&:hover": {
                    bgcolor: "transparent",
                    textDecoration: "underline",
                  },
                }}
              >
                모임원 내보내기
              </Button>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ width: "100%" }}>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={handleClose}
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
            sx={{
              borderRadius: 1,
              height: 40,
              fontWeight: 900,
              bgcolor: "#2F80ED",
              "&:hover": { bgcolor: "#256FD1" },
            }}
          >
            저장
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
