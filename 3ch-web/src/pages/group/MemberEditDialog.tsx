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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

type Props = {
  open: boolean;
  member: {
    id: string;
    name: string;
    email: string;
    role: "owner" | "admin" | "member";
    division?: string;
    externalAliases?: string[];
  };
  onClose: () => void;
  onSave: (updated: { role: "owner" | "admin" | "member"; division: string; externalAliases: string[] }) => void;
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
  const [externalAliases, setExternalAliases] = useState<string[]>(member.externalAliases || []);

  const handleSave = () => {
    onSave({
      role,
      division: division.trim(),
      externalAliases: externalAliases.map((value) => value.trim()).filter(Boolean),
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
          <Typography sx={{ fontWeight: 900, fontSize: 18 }}>클럽 회원 수정</Typography>
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
                <MenuItem value="owner">리더</MenuItem>
                <MenuItem value="admin">운영진</MenuItem>
                <MenuItem value="member">회원</MenuItem>
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

          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#6B7280" }}>
                외부 서비스 닉네임
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                disabled={externalAliases.length >= 20}
                onClick={() => setExternalAliases((current) => [...current, ""])}
                sx={{ minWidth: 0, fontWeight: 800 }}
              >
                추가
              </Button>
            </Box>
            <Stack spacing={1}>
              {externalAliases.length === 0 && (
                <Typography sx={{ fontSize: 12, color: "#9CA3AF" }}>
                  소모임, 네이버 밴드 등 외부 서비스에서 사용하는 닉네임을 등록해 주세요.
                </Typography>
              )}
              {externalAliases.map((alias, index) => (
                <Stack key={index} direction="row" spacing={0.7} alignItems="center">
                  <TextField
                    value={alias}
                    onChange={(event) => setExternalAliases((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                    placeholder="닉네임"
                    inputProps={{ maxLength: 60 }}
                    fullWidth
                    size="small"
                  />
                  <IconButton
                    size="small"
                    aria-label="닉네임 삭제"
                    onClick={() => setExternalAliases((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <DeleteOutlineIcon fontSize="small" color="error" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
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
                클럽 회원 내보내기
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
