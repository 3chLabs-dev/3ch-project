import { useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { DEMO_PEOPLE, DEMO_PRIZES } from "./demoSampleData";

type Winners = Record<string, string[]>;
function shuffle<T>(items: readonly T[]) { const result = [...items]; for (let i = result.length - 1; i > 0; i -= 1) { const random = new Uint32Array(1); crypto.getRandomValues(random); const j = random[0] % (i + 1); [result[i], result[j]] = [result[j], result[i]]; } return result; }

export default function DemoDrawPage() {
  const navigate = useNavigate();
  const [winners, setWinners] = useState<Winners>({});
  const [drawing, setDrawing] = useState(false);
  const [rollingName, setRollingName] = useState("");
  const personById = useMemo(() => new Map<string, (typeof DEMO_PEOPLE)[number]>(DEMO_PEOPLE.map((person) => [person.id, person])), []);
  const hasResult = Object.keys(winners).length > 0;

  const runDraw = () => { setDrawing(true); let ticks = 0; const timer = window.setInterval(() => { setRollingName(DEMO_PEOPLE[Math.floor(Math.random() * DEMO_PEOPLE.length)].name); ticks += 1; if (ticks < 18) return; window.clearInterval(timer); const ids = shuffle(DEMO_PEOPLE.map((person) => person.id)); let cursor = 0; const next: Winners = {}; DEMO_PRIZES.forEach((prize) => { next[prize.id] = ids.slice(cursor, cursor + prize.quantity); cursor += prize.quantity; }); setWinners(next); setDrawing(false); confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } }); }, 75); };
  const reset = () => setWinners({});

  return <><Stack spacing={2.2} sx={{ pb: 3 }}><Stack direction="row" alignItems="center" spacing={1}><IconButton onClick={() => navigate("/draw")} size="small"><ArrowBackIcon/></IconButton><Box flex={1} minWidth={0}><Typography fontWeight={900} fontSize={20} noWrap>우리리그 추첨</Typography><Stack direction="row" alignItems="center" spacing={1} mt={0.2}><Typography variant="caption" color="text.secondary" fontWeight={700}>2026-01-01(목) 18:00</Typography>{!hasResult && <Chip label="추첨 대기 중" size="small" sx={{ height: 18, fontWeight: 700, bgcolor: "#FFF7E6", color: "#F59E0B", fontSize: 11 }}/>}</Stack></Box></Stack>
    <Button variant="outlined" disableElevation onClick={runDraw} disabled={drawing} sx={{ borderRadius: 1, fontWeight: 700, alignSelf: "flex-start" }}>{hasResult ? "일괄 재추첨" : "일괄 자동 추첨"}</Button>
    <Stack spacing={1.5}>{DEMO_PRIZES.map((prize, index) => { const prizeWinners = winners[prize.id] ?? []; return <Card key={prize.id} elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}><CardContent sx={{ py: 1.5, px: 1.8, "&:last-child": { pb: 1.5 } }}><Stack direction="row" alignItems="center" spacing={1} mb={1}><Chip label={`${index + 1}`} size="small" sx={{ height: 22, fontWeight: 800, bgcolor: "#EEF2FF", color: "#2F80ED" }}/><Typography fontWeight={900} fontSize={15} flex={1}>{prize.name}</Typography><Chip label={prizeWinners.length ? `당첨 ${prizeWinners.length}명` : `${prize.quantity}명 예정`} size="small" sx={{ height: 22, fontWeight: 700 }}/><Button variant={prizeWinners.length ? "outlined" : "contained"} size="small" disableElevation onClick={runDraw} disabled={drawing} sx={{ borderRadius: 1, fontWeight: 700, minWidth: 56, height: 28, fontSize: 12 }}>{prizeWinners.length ? "재추첨" : "추첨"}</Button></Stack><Divider sx={{ mb: 1 }}/>{prizeWinners.length === 0 ? <Typography color="text.secondary" fontSize={13} fontWeight={700}>추첨 예정</Typography> : <Stack spacing={0.7}>{prizeWinners.map((id, winnerIndex) => { const person = personById.get(id); return <Stack key={id} direction="row" alignItems="center" spacing={1}><Chip label={`${winnerIndex + 1}`} size="small" sx={{ height: 22, fontWeight: 800, minWidth: 28 }}/><Chip label={person?.division} size="small" sx={{ borderRadius: 9999, fontWeight: 700, bgcolor: "#FAAA47", color: "#000", height: 36, minWidth: 36 }}/><Typography fontWeight={800} fontSize={15}>{person?.name}</Typography></Stack>; })}</Stack>}</CardContent></Card>; })}</Stack>
    {hasResult && <Button onClick={reset} sx={{ fontWeight: 700 }}>결과 초기화</Button>}<Typography textAlign="center" color="text.secondary" fontSize={12}>다른 페이지로 이동하면 추첨 결과가 초기화됩니다.</Typography></Stack>
    <Dialog open={drawing} maxWidth="xs" fullWidth><DialogTitle sx={{ fontWeight: 800, pb: 0 }}>우리리그 추첨</DialogTitle><DialogContent sx={{ textAlign: "center" }}><Box sx={{ py: 4 }}><Typography fontSize={38} fontWeight={900} sx={{ filter: "blur(2px)", color: "primary.main", minHeight: 52 }}>{rollingName}</Typography><Typography color="text.secondary" fontSize={13} mt={2}>추첨 중...</Typography></Box></DialogContent><DialogActions/></Dialog>
  </>;
}
