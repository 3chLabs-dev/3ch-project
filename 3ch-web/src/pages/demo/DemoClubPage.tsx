import { useState } from "react";
import { Box, Button, Card, CardContent, Divider, IconButton, List, ListItem, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import { useNavigate } from "react-router-dom";
import { DEMO_CLUB_MEMBERS, DEMO_RANKINGS } from "./demoSampleData";

function DivisionBadge({ division }: { division: string }) {
  return <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "#FAAA47", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11 }}>{division.replace("부", "")}</Box>;
}

function ClubLink({ label, url }: { label: string; url: string }) {
  return <Box sx={{ border: "1px solid #BFD7FF", borderRadius: 1, px: 1.4, py: 1, color: "#1976D2" }}><Stack direction="row" alignItems="center"><Box flex={1} minWidth={0}><Typography fontSize={12} fontWeight={900}>{label}</Typography><Typography fontSize={10} color="#6B7280" noWrap>{url}</Typography></Box><Typography fontWeight={900}>→</Typography></Stack></Box>;
}

export default function DemoClubPage() {
  const navigate = useNavigate();
  const [rankingOpen, setRankingOpen] = useState(false);
  const memberById = new Map(DEMO_CLUB_MEMBERS.map((member) => [member.id, member]));

  if (rankingOpen) return <Stack spacing={2.2} sx={{ pb: 3 }}>
    <Stack direction="row" alignItems="center" spacing={1}><IconButton onClick={() => setRankingOpen(false)} size="small"><ArrowBackIcon/></IconButton><Typography variant="h6" fontWeight={900}>우리리그 클럽 순위</Typography></Stack>
    <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}><List disablePadding><ListItem sx={{ display: "grid", gridTemplateColumns: "48px 1fr 72px 64px", py: 1.5, px: 2, bgcolor: "#f5f5f5" }}><Typography fontWeight={700} fontSize={13}>순위</Typography><Typography fontWeight={700} fontSize={13}>이름</Typography><Typography fontWeight={700} fontSize={13}>전적</Typography><Typography fontWeight={700} fontSize={13} textAlign="right">점수</Typography></ListItem>{DEMO_RANKINGS.map((row, index) => { const member = memberById.get(row.personId); return <Box key={row.personId}>{index > 0 && <Divider/>}<ListItem sx={{ display: "grid", gridTemplateColumns: "48px 1fr 72px 64px", py: 1.5, px: 2, bgcolor: row.rank <= 3 ? "rgba(255, 193, 7, 0.06)" : "transparent" }}><Typography fontWeight={900} color={row.rank <= 3 ? "#D97706" : "inherit"}>{row.rank}</Typography><Box><Typography fontWeight={800} fontSize={14}>{member?.name}</Typography><Typography fontSize={11} color="text.secondary">{member?.division}</Typography></Box><Typography fontWeight={700} fontSize={13}>{row.wins}승 {row.losses}패</Typography><Typography fontWeight={800} fontSize={13} textAlign="right">{row.rating}</Typography></ListItem></Box>; })}</List></Card>
  </Stack>;

  return <Stack spacing={2} sx={{ pb: 3 }}>
    <Stack direction="row" alignItems="center"><IconButton onClick={() => navigate("/club")} size="small"><ArrowBackIcon/></IconButton><Typography variant="h6" fontWeight={900} flex={1}>클럽 정보</Typography><IconButton size="small"><EditIcon fontSize="small"/></IconButton></Stack>
    <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}><CardContent sx={{ py: 2.2, px: 2, "&:last-child": { pb: 2.2 } }}><Stack spacing={1.5}><Stack direction="row" alignItems="center" spacing={1.5}><Typography sx={{ fontSize: 30 }}>🏓</Typography><Box><Typography fontWeight={900} fontSize={19}>우리리그 클럽</Typography><Typography fontSize={11} color="text.secondary" fontWeight={700}>서울특별시 광진구</Typography></Box></Stack><Typography fontSize={13} color="text.secondary">우리리그 클럽입니다.</Typography><ClubLink label="오픈채팅방" url="https://open.kakao.com/o/demo"/><ClubLink label="리그·대회 개최내역" url="우리리그에서 개최한 리그를 확인해보세요."/></Stack></CardContent></Card>
    <Box><Stack direction="row" alignItems="center" mb={1}><Typography fontWeight={900} fontSize={15} flex={1}>클럽 회원 ({DEMO_CLUB_MEMBERS.length}명)</Typography><Button variant="outlined" size="small" sx={{ height: 28, px: 1, fontSize: 10, fontWeight: 900 }}>회원 사전등록</Button><Button variant="outlined" size="small" startIcon={<EmojiEventsOutlinedIcon sx={{ fontSize: 14 }}/>} onClick={() => setRankingOpen(true)} sx={{ height: 28, px: 1, ml: 0.7, color: "#D97706", borderColor: "#F59E0B", fontSize: 10, fontWeight: 900 }}>순위</Button></Stack>
      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}><Box sx={{ display: "grid", gridTemplateColumns: "68px 58px 1fr 28px", py: 1.2, px: 1.5, bgcolor: "#F7F8FA" }}><Typography fontWeight={800} fontSize={12}>구분</Typography><Typography fontWeight={800} fontSize={12}>부수</Typography><Typography fontWeight={800} fontSize={12}>이름</Typography><Box/></Box>{DEMO_CLUB_MEMBERS.map((member, index) => <Box key={member.id}><Box sx={{ display: "grid", gridTemplateColumns: "68px 58px 1fr 28px", alignItems: "center", py: 0.8, px: 1.5, bgcolor: index === 0 ? "rgba(255,193,7,0.09)" : "#fff" }}><Typography fontWeight={800} fontSize={12}>{index === 0 ? "리더" : index === 1 ? "운영진" : index === 2 ? "사전등록" : "회원"}</Typography><DivisionBadge division={member.division}/><Typography fontWeight={900} fontSize={13} color={index === 0 ? "#1976D2" : "inherit"}>{member.name}</Typography><IconButton size="small" sx={{ p: 0.3 }}><EditIcon sx={{ fontSize: 15, color: "#6B7280" }}/></IconButton></Box>{index < DEMO_CLUB_MEMBERS.length - 1 && <Divider/>}</Box>)}</Card>
    </Box>
  </Stack>;
}
