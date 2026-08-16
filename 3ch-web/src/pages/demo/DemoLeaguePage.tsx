import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, Step, StepLabel, Stepper, Tab, Tabs, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { DEMO_BRACKET, DEMO_CUSTOM_PROGRAM, DEMO_LEAGUE, DEMO_MATCHES, DEMO_PEOPLE, DEMO_RECOMMENDED_PROGRAM } from "./demoSampleData";

const creationSteps = ["기본 정보", "구성 방식", "프로그램", "참가자 사전등록", "생성 완료"];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <Stack direction="row" justifyContent="space-between" spacing={2}><Typography color="text.secondary" fontWeight={700}>{label}</Typography><Typography textAlign="right" fontWeight={900}>{value}</Typography></Stack>;
}

function ProgramCards({ items }: { items: readonly { round: string; program: string; format: string; detail: string }[] }) {
  return <Stack spacing={1}>{items.map((item) => <Card key={item.round} variant="outlined"><CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Chip label={item.round} size="small" color="primary"/><Typography fontWeight={900}>{item.program} · {item.format}</Typography></Stack><Typography mt={1} color="text.secondary" fontSize={14}>{item.detail}</Typography></CardContent></Card>)}</Stack>;
}

export default function DemoLeaguePage() {
  const [creationStep, setCreationStep] = useState(0);
  const [mode, setMode] = useState<"recommend" | "custom">("recommend");
  const [tab, setTab] = useState(0);
  const created = creationStep === creationSteps.length - 1;

  return <Stack spacing={2.5} sx={{ pb: 4 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h5" fontWeight={900}>리그 둘러보기</Typography><Typography color="text.secondary" mt={0.5}>리그 생성부터 경기순서와 대진표까지 체험해보세요.</Typography></Box><Button component={RouterLink} to="/league" size="small">리그 메뉴</Button></Stack>
    <Alert severity="info">체험용 샘플 데이터입니다. 운영 데이터는 생성되거나 수정되지 않습니다.</Alert>

    {!created ? <Card elevation={2}><CardContent><Stepper activeStep={creationStep} alternativeLabel sx={{ mb: 3 }}>{creationSteps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
      {creationStep === 0 && <Stack spacing={1.3}><Typography variant="h6" fontWeight={900}>기본 정보</Typography><InfoRow label="리그명" value={DEMO_LEAGUE.name}/><InfoRow label="일시" value={`${DEMO_LEAGUE.date} ${DEMO_LEAGUE.time}`}/><InfoRow label="장소" value={DEMO_LEAGUE.location}/><InfoRow label="탁구대" value={`${DEMO_LEAGUE.courtCount}대`}/><InfoRow label="참가자" value={`${DEMO_LEAGUE.participantCount}명`}/><Typography variant="caption" color="text.secondary">데모에서는 입력값을 수정할 수 없습니다.</Typography></Stack>}
      {creationStep === 1 && <Stack spacing={2}><Typography variant="h6" fontWeight={900}>구성 방식</Typography><Typography color="text.secondary">체험할 프로그램 구성을 선택해주세요. 세부 옵션은 미리 설정되어 있습니다.</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><Button fullWidth variant={mode === "recommend" ? "contained" : "outlined"} onClick={() => setMode("recommend")}>추천 프로그램</Button><Button fullWidth variant={mode === "custom" ? "contained" : "outlined"} onClick={() => setMode("custom")}>직접 구성</Button></Stack></Stack>}
      {creationStep === 2 && <Stack spacing={2}><Typography variant="h6" fontWeight={900}>{mode === "recommend" ? "추천 프로그램" : "직접 구성 프로그램"}</Typography><ProgramCards items={mode === "recommend" ? DEMO_RECOMMENDED_PROGRAM : DEMO_CUSTOM_PROGRAM}/></Stack>}
      {creationStep === 3 && <Stack spacing={1}><Typography variant="h6" fontWeight={900}>참가자 사전등록</Typography>{DEMO_PEOPLE.map((person) => <Stack key={person.id} direction="row" justifyContent="space-between" sx={{ py: 1, borderBottom: "1px solid #eee" }}><Typography fontWeight={800}>{person.name}</Typography><Chip label={person.division} size="small"/></Stack>)}</Stack>}
      <Stack direction="row" spacing={1.5} mt={3}><Button fullWidth variant="outlined" disabled={creationStep === 0} onClick={() => setCreationStep((step) => step - 1)}>이전</Button><Button fullWidth variant="contained" onClick={() => setCreationStep((step) => step + 1)}>{creationStep === 3 ? "리그 생성" : "다음"}</Button></Stack>
    </CardContent></Card> : <>
      <Card elevation={2}><CardContent><Typography variant="h6" fontWeight={900}>{DEMO_LEAGUE.name}</Typography><Typography color="text.secondary" mt={0.5}>{DEMO_LEAGUE.date} · {DEMO_LEAGUE.time} · {DEMO_LEAGUE.location}</Typography><Stack direction="row" spacing={1} mt={2}><Chip label={`${DEMO_LEAGUE.participantCount}명`}/><Chip label={`${DEMO_LEAGUE.courtCount}대`}/><Chip label={mode === "recommend" ? "추천 프로그램" : "직접 구성"} color="primary"/></Stack></CardContent></Card>
      <Card elevation={2}><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth"><Tab label="리그 상세"/><Tab label="경기순서"/><Tab label="대진표"/></Tabs><Divider/><CardContent>
        {tab === 0 && <Stack spacing={2}><Typography fontWeight={900}>참가자 명단</Typography>{DEMO_PEOPLE.map((person) => <Stack key={person.id} direction="row" justifyContent="space-between"><Typography>{person.name}</Typography><Chip label={person.division} size="small"/></Stack>)}<Typography fontWeight={900} mt={1}>운영 프로그램</Typography><ProgramCards items={mode === "recommend" ? DEMO_RECOMMENDED_PROGRAM : DEMO_CUSTOM_PROGRAM}/></Stack>}
        {tab === 1 && <Stack spacing={1}>{DEMO_MATCHES.map((match) => <Card key={match.order} variant="outlined"><CardContent sx={{ p: 1.7, "&:last-child": { pb: 1.7 } }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={900}>{match.order}경기 · {match.court}</Typography><Chip label={match.status} size="small" color="success"/></Stack><Typography mt={1} fontWeight={800}>{match.left} <Box component="span" color="primary.main">{match.score}</Box> {match.right}</Typography></CardContent></Card>)}<Alert severity="info">경기 결과는 기능 소개용 예시이며 데모에서는 수정할 수 없습니다.</Alert></Stack>}
        {tab === 2 && <Stack spacing={1.5}>{DEMO_BRACKET.map((match) => <Card key={match.label} variant="outlined"><CardContent><Typography color="primary" fontWeight={900}>{match.label}</Typography><Typography fontWeight={800} mt={1}>{match.left} {match.score} {match.right}</Typography><Typography color="text.secondary" mt={0.5}>승자: {match.winner}</Typography></CardContent></Card>)}<Alert severity="success">샘플 우승자: 김민준</Alert></Stack>}
      </CardContent></Card><Button variant="outlined" onClick={() => { setCreationStep(0); setTab(0); }}>처음부터 다시 체험</Button>
    </>}
  </Stack>;
}
