import { useMemo, useState } from "react";
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import confetti from "canvas-confetti";
import { DEMO_PEOPLE, DEMO_PRIZES } from "./demoSampleData";

type Winners = Record<string, string[]>;
const STORAGE_KEY = "woorileague.demo.draw.winners";

function secureShuffle<T>(items: readonly T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function loadWinners(): Winners {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}

export default function DemoDrawPage() {
  const [winners, setWinners] = useState<Winners>(loadWinners);
  const [drawing, setDrawing] = useState(false);
  const personById = useMemo(() => new Map<string, (typeof DEMO_PEOPLE)[number]>(DEMO_PEOPLE.map((person) => [person.id, person])), []);
  const hasResult = Object.keys(winners).length > 0;

  const runDraw = () => {
    setDrawing(true);
    window.setTimeout(() => {
      const shuffled = secureShuffle(DEMO_PEOPLE.map((person) => person.id));
      let cursor = 0;
      const next: Winners = {};
      DEMO_PRIZES.forEach((prize) => { next[prize.id] = shuffled.slice(cursor, cursor + prize.quantity); cursor += prize.quantity; });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setWinners(next);
      setDrawing(false);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.65 } });
    }, 900);
  };

  const reset = () => { sessionStorage.removeItem(STORAGE_KEY); setWinners({}); };

  return <Stack spacing={2.5} sx={{ pb: 4 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h5" fontWeight={900}>추첨 둘러보기</Typography><Button component={RouterLink} to="/draw" size="small">추첨 메뉴</Button></Stack>
    <Alert severity="info">체험용 무작위 추첨입니다. 결과는 현재 브라우저 탭에만 저장되며 실제 경품 지급과 관계없습니다.</Alert>
    <Card elevation={2}><CardContent><Typography variant="h6" fontWeight={900}>우리리그 추첨</Typography><Typography color="text.secondary" mt={0.5}>우리리그 리그 참가자 8명을 대상으로 진행합니다.</Typography><Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>{DEMO_PRIZES.map((prize) => <Chip key={prize.id} label={`${prize.name} ${prize.quantity}명`} color="primary" variant="outlined"/>)}</Stack></CardContent></Card>
    <Card elevation={2}><CardContent><Typography fontWeight={900} mb={1.5}>추첨 대상자</Typography><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{DEMO_PEOPLE.map((person) => <Chip key={person.id} label={`${person.name} · ${person.division}`}/>)}</Stack></CardContent></Card>
    {hasResult && <Stack spacing={1.5}>{DEMO_PRIZES.map((prize) => <Card key={prize.id} elevation={2}><CardContent><Typography color="primary" fontWeight={900}>{prize.name}</Typography><Stack spacing={0.8} mt={1}>{(winners[prize.id] ?? []).map((id) => { const person = personById.get(id); return <Typography key={id} fontWeight={900} fontSize={18}>🎉 {person?.name} <Typography component="span" color="text.secondary" fontSize={14}>{person?.division}</Typography></Typography>; })}</Stack></CardContent></Card>)}</Stack>}
    <Button variant="contained" size="large" disabled={drawing} onClick={runDraw}>{drawing ? "추첨 중..." : hasResult ? "다시 추첨" : "추첨 시작"}</Button>
    {hasResult && <Button variant="text" onClick={reset}>결과 초기화</Button>}
  </Stack>;
}
