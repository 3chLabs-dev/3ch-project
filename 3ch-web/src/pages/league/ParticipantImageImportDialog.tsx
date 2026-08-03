import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import { useNavigate } from "react-router-dom";
import { useScanParticipantImagesMutation, type RecognizedParticipant } from "../../features/league/leagueApi";

export type ImportedParticipant = {
  division: string;
  name: string;
  member_id?: number | null;
  source_group_id?: string | null;
};

type ReviewRow = RecognizedParticipant & { id: string; selected: boolean; existingDuplicate: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (participants: ImportedParticipant[]) => void | Promise<void>;
  existingNames?: string[];
  groupIds?: string[];
};

const normalizeName = (value: string) => value.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("ko-KR");

export default function ParticipantImageImportDialog({ open, onClose, onConfirm, existingNames = [], groupIds = [] }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState("");
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scan, { isLoading }] = useScanParticipantImagesMutation();
  const existingKeys = useMemo(() => new Set(existingNames.map(normalizeName)), [existingNames]);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setRows([]);
      setError("");
      setQuotaExhausted(false);
      setSaving(false);
    }
  }, [open]);

  const chooseFiles = (selected: FileList | null) => {
    if (!selected) return;
    const images = Array.from(selected).filter((file) => file.type.startsWith("image/")).slice(0, 10);
    setFiles(images);
    setRows([]);
    setQuotaExhausted(false);
    setError(selected.length > 10 ? "이미지는 한 번에 최대 10장까지 등록할 수 있습니다." : "");
  };

  const recognize = async () => {
    if (files.length === 0) return;
    setError("");
    setQuotaExhausted(false);
    try {
      const result = await scan({
        files,
        groupIds,
        idempotencyKey: crypto.randomUUID(),
      }).unwrap();
      const seen = new Set<string>();
      setRows(result.participants.map((participant, index) => {
        const key = normalizeName(participant.name);
        const existingDuplicate = existingKeys.has(key);
        const firstOccurrence = !seen.has(key);
        seen.add(key);
        return {
          ...participant,
          id: `${participant.imageIndex}-${participant.rowIndex}-${index}`,
          selected: firstOccurrence && !existingDuplicate,
          existingDuplicate,
        };
      }));
      if (result.participants.length === 0) setError("참가자 이름을 찾지 못했습니다. 다른 이미지를 선택해 주세요.");
    } catch (caught) {
      const response = (caught as { data?: { message?: string; code?: string } })?.data;
      const message = response?.message;
      setQuotaExhausted(response?.code === "VISION_QUOTA_EXHAUSTED");
      setError(message || "이미지에서 참가자 이름을 인식하지 못했습니다.");
    }
  };

  const updateRow = (id: string, updates: Partial<ReviewRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...updates } : row));
  };

  const selectedRows = rows.filter((row) => row.selected && row.name.trim());
  const submit = async () => {
    if (selectedRows.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(selectedRows.map((row) => ({
        division: row.division.trim(),
        name: row.name.trim(),
        member_id: row.ambiguous ? null : row.member_id,
        source_group_id: row.ambiguous ? null : row.source_group_id,
      })));
      onClose();
    } catch (caught) {
      const message = (caught as { data?: { message?: string } })?.data?.message;
      setError(message || "참가자 등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={isLoading || saving ? undefined : onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 2, m: 1.5, maxHeight: "calc(100dvh - 24px)" } }}>
      <DialogTitle sx={{ fontWeight: 900, fontSize: 18, pr: 6 }}>
        이미지에서 참가자 불러오기
        <IconButton onClick={onClose} disabled={isLoading || saving} sx={{ position: "absolute", right: 10, top: 8 }} aria-label="닫기"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: 2 }}>
        {rows.length === 0 ? (
          <Stack spacing={2}>
            <Typography sx={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>
              다른 서비스의 참가자 목록 캡처를 최대 10장까지 선택할 수 있습니다. 이름 아래의 인사말이나 상태 문구는 제외하고 참가자 이름만 인식합니다.
            </Typography>
            <input ref={inputRef} hidden type="file" accept="image/*" multiple onChange={(event) => chooseFiles(event.target.files)} />
            <Button variant="outlined" startIcon={<PhotoLibraryOutlinedIcon />} onClick={() => inputRef.current?.click()} sx={{ height: 44, fontWeight: 800 }}>
              이미지 선택
            </Button>
            {files.length > 0 && <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1, p: 1.2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.7 }}>{files.length}장 선택됨</Typography>
              <Stack spacing={0.5}>{files.map((file, index) => <Typography key={`${file.name}-${index}`} sx={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{index + 1}. {file.name}</Typography>)}</Stack>
            </Box>}
            <Button variant="contained" disableElevation disabled={files.length === 0 || isLoading} onClick={recognize} sx={{ height: 44, fontWeight: 900 }}>
              {isLoading ? <CircularProgress size={22} color="inherit" /> : `참가자 이름 인식 (${files.length}회 사용)`}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.2}>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>인식 결과</Typography>
              <Typography sx={{ fontSize: 12, color: "#6B7280" }}>이름과 부수를 확인한 뒤 등록할 참가자만 선택해 주세요.</Typography>
            </Box>
            {rows.map((row) => (
              <Box key={row.id} sx={{ display: "grid", gridTemplateColumns: "32px 62px minmax(0,1fr) 32px", gap: 0.7, alignItems: "center", border: "1px solid #E5E7EB", borderRadius: 1, p: 0.8, bgcolor: row.existingDuplicate || row.duplicateCount > 1 ? "#FFF8ED" : "#fff" }}>
                <Checkbox size="small" checked={row.selected} onChange={(event) => updateRow(row.id, { selected: event.target.checked })} />
                <TextField value={row.division} onChange={(event) => updateRow(row.id, { division: event.target.value })} placeholder="부수" size="small" inputProps={{ style: { textAlign: "center", padding: "7px 4px" } }} />
                <Box sx={{ minWidth: 0 }}>
                  <TextField value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} size="small" fullWidth inputProps={{ style: { padding: "7px 8px" } }} />
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {row.member_id && !row.ambiguous && <Chip label="클럽 회원" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                    {row.ambiguous && <Chip label="동명이인 확인 필요" size="small" color="warning" sx={{ height: 20, fontSize: 10 }} />}
                    {row.existingDuplicate && <Chip label="이미 등록됨" size="small" color="warning" sx={{ height: 20, fontSize: 10 }} />}
                    {row.duplicateCount > 1 && <Chip label={`${row.duplicateCount}회 인식`} size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                  </Stack>
                </Box>
                <IconButton size="small" aria-label="결과 삭제" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
              </Box>
            ))}
            <Button variant="text" onClick={() => { setRows([]); setFiles([]); }} sx={{ alignSelf: "flex-start", fontWeight: 800 }}>이미지 다시 선택</Button>
          </Stack>
        )}
        {error && <Alert severity="warning" sx={{ mt: 1.5 }}>{error}</Alert>}
        {quotaExhausted && (
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={() => {
              onClose();
              navigate("/mypage/pricing#token-packages");
            }}
            sx={{ mt: 1.2, height: 44, fontWeight: 900 }}
          >
            사진 인식 충전
          </Button>
        )}
      </DialogContent>
      {rows.length > 0 && <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} sx={{ fontWeight: 800 }}>취소</Button>
        <Button variant="contained" disableElevation disabled={selectedRows.length === 0 || saving} onClick={submit} sx={{ fontWeight: 900 }}>{saving ? <CircularProgress size={20} color="inherit" /> : `${selectedRows.length}명 등록`}</Button>
      </DialogActions>}
    </Dialog>
  );
}
