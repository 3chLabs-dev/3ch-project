import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useScanOcrMutation } from "../../features/league/leagueApi";

const LANGUAGE_OPTIONS = [
  { value: "kor+eng", label: "한국어 + 영어" },
  { value: "kor", label: "한국어" },
  { value: "eng", label: "영어" },
];

const PSM_OPTIONS = [
  { value: 3, label: "자동" },
  { value: 6, label: "문단" },
  { value: 11, label: "드문드문 있는 텍스트" },
];

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "OCR 처리에 실패했습니다.";
  const maybeError = error as { data?: { message?: string; details?: string }; error?: string };
  return maybeError.data?.message ?? maybeError.error ?? "OCR 처리에 실패했습니다.";
}

export default function OcrScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("kor+eng");
  const [psm, setPsm] = useState(6);
  const [scanOcr, { data, error, isLoading, reset }] = useScanOcrMutation();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    reset();
  };

  const handleScan = async () => {
    if (!file) return;
    await scanOcr({ file, language, psm }).unwrap().catch(() => {});
  };

  const handleCopy = async () => {
    if (!data?.text) return;
    await navigator.clipboard?.writeText(data.text);
  };

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F8FAFC", px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
      <Stack spacing={2.5} sx={{ maxWidth: 1040, mx: "auto" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <Typography sx={{ flex: 1, fontSize: 24, fontWeight: 900, color: "#111827" }}>OCR 텍스트 인식</Typography>
          <Button component="label" variant="contained" startIcon={<UploadFileOutlinedIcon />} sx={{ fontWeight: 800 }}>
            이미지 선택
            <input hidden accept="image/*" type="file" onChange={handleFileChange} />
          </Button>
        </Stack>

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", borderColor: "#E5E7EB" }}>
          <Stack direction={{ xs: "column", md: "row" }} sx={{ minHeight: 360 }}>
            <Box sx={{ flex: 1, bgcolor: "#EEF2F7", display: "grid", placeItems: "center", p: 2 }}>
              {previewUrl ? (
                <Box
                  component="img"
                  src={previewUrl}
                  alt=""
                  sx={{ maxWidth: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 1, boxShadow: "0 10px 30px rgba(15,23,42,0.12)" }}
                />
              ) : (
                <Typography sx={{ color: "#64748B", fontWeight: 800 }}>이미지를 선택하세요</Typography>
              )}
            </Box>

            <Stack spacing={2} sx={{ width: { xs: "100%", md: 360 }, p: 2.5, bgcolor: "#FFFFFF" }}>
              <TextField
                select
                label="언어"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                size="small"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="분석 방식"
                value={psm}
                onChange={(event) => setPsm(Number(event.target.value))}
                size="small"
              >
                {PSM_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
              <Button disabled={!file || isLoading} onClick={handleScan} variant="contained" sx={{ fontWeight: 900 }}>
                OCR 실행
              </Button>
              {isLoading ? <LinearProgress /> : null}
              {error ? <Alert severity="error">{getErrorMessage(error)}</Alert> : null}
              {data ? (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip size="small" label={data.engine} />
                    <Chip size="small" label={data.language} />
                    <Chip size="small" label={`${data.lines.length}줄`} />
                  </Stack>
                  <Button
                    disabled={!data.text}
                    onClick={handleCopy}
                    startIcon={<ContentCopyOutlinedIcon />}
                    variant="outlined"
                    sx={{ alignSelf: "flex-start", fontWeight: 800 }}
                  >
                    텍스트 복사
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Stack>
        </Paper>

        {data ? (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: "#E5E7EB" }}>
            <Typography sx={{ mb: 1.5, fontSize: 18, fontWeight: 900 }}>인식 결과</Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                minHeight: 160,
                bgcolor: "#0F172A",
                color: "#E2E8F0",
                borderRadius: 1,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                fontFamily: "Consolas, monospace",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {data.text || "인식된 텍스트가 없습니다."}
            </Box>
          </Paper>
        ) : null}
      </Stack>
    </Box>
  );
}
