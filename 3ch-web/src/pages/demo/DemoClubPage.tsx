import { Alert, Button, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { DEMO_CLUB_MEMBERS, DEMO_RANKINGS } from "./demoSampleData";

export default function DemoClubPage() {
  const memberById = new Map(DEMO_CLUB_MEMBERS.map((member) => [member.id, member]));
  return <Stack spacing={2.5} sx={{ pb: 4 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h5" fontWeight={900}>클럽 둘러보기</Typography><Button component={RouterLink} to="/club" size="small">클럽 메뉴</Button></Stack>
    <Alert severity="info">실제 회원 정보가 아닌 우리리그 기능 소개용 샘플 데이터입니다.</Alert>
    <Card elevation={2}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Stack><Typography variant="h6" fontWeight={900}>🏓 우리리그 클럽</Typography><Typography color="text.secondary" mt={0.5}>서울 광진구 · 탁구</Typography></Stack><Chip label="회원 10명" color="primary"/></Stack><Typography mt={2} sx={{ lineHeight: 1.8 }}>우리리그 클럽입니다.</Typography></CardContent></Card>
    <Card elevation={2}><CardContent><Typography variant="h6" fontWeight={900} mb={2}>클럽 회원</Typography><Stack spacing={1}>{DEMO_CLUB_MEMBERS.map((member) => <Stack key={member.id} direction="row" justifyContent="space-between" sx={{ py: 0.7, borderBottom: "1px solid #eee" }}><Typography fontWeight={800}>{member.name}</Typography><Chip label={member.division} size="small"/></Stack>)}</Stack></CardContent></Card>
    <Card elevation={2}><CardContent><Typography variant="h6" fontWeight={900} mb={1}>클럽 순위</Typography><Typography color="text.secondary" fontSize={14} mb={2}>회원들의 샘플 경기 기록과 레이팅을 기준으로 구성한 순위입니다.</Typography><TableContainer><Table size="small"><TableHead><TableRow><TableCell>순위</TableCell><TableCell>회원</TableCell><TableCell align="right">전적</TableCell><TableCell align="right">레이팅</TableCell></TableRow></TableHead><TableBody>{DEMO_RANKINGS.map((row) => { const member = memberById.get(row.personId); return <TableRow key={row.personId}><TableCell sx={{ fontWeight: 900 }}>{row.rank}</TableCell><TableCell><Typography fontWeight={800}>{member?.name}</Typography><Typography variant="caption" color="text.secondary">{member?.division}</Typography></TableCell><TableCell align="right">{row.wins}승 {row.losses}패</TableCell><TableCell align="right">{row.rating}</TableCell></TableRow>; })}</TableBody></Table></TableContainer></CardContent></Card>
  </Stack>;
}
