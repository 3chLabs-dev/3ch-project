import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useGetLeaguePointRankingQuery, useUpdateLeaguePointRankingAdjustmentsMutation, useUpdateLeaguePointRankingSettingsMutation } from "../../features/league/leagueApi";
import type { GroupRankingPointRules } from "../../features/group/groupApi";
import { DivisionBadge } from "../../components/ParticipantName";

const rankingLabels = { league: "단일리그", group: "조별리그", tournamentUpper: "토너먼트(상위)", tournamentLower: "토너먼트(하위)" } as const;
const rankLabels = { first: "1위", second: "2위", third: "3위", fourth: "4위" } as const;

export default function LeaguePointRankingPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsMode = searchParams.get("settings") === "1";
  const [seasonId, setSeasonId] = useState<string | undefined>(() => searchParams.get("season") || undefined);
  const [visibleCount, setVisibleCount] = useState(10);
  const { data, isLoading, error } = useGetLeaguePointRankingQuery({ leagueId: id, seasonId }, { skip: !id });
  const [saveSettings, settingsState] = useUpdateLeaguePointRankingSettingsMutation();
  const [saveAdjustments, adjustmentsState] = useUpdateLeaguePointRankingAdjustmentsMutation();
  const [enabled, setEnabled] = useState(false); const [rules, setRules] = useState<GroupRankingPointRules>();
  const [adjustments, setAdjustments] = useState<Record<string, { league_points:number; tournament_points:number; championships:number }>>({});
  useEffect(() => { if (!data) return; setEnabled(data.override_enabled); setRules(structuredClone(data.point_rules)); setAdjustments(Object.fromEntries(data.adjustments.map((a) => [a.participant_id, { league_points:a.league_points, tournament_points:a.tournament_points, championships:a.championships }]))); }, [data]);
  const rows = useMemo(() => [...(data?.league.rankings ?? []), ...(data?.tournament.rankings ?? [])], [data]);
  const updateRank = (section:keyof GroupRankingPointRules["rankings"], key:"first"|"second"|"third"|"fourth", value:number) => setRules((old) => old ? ({ ...old, rankings:{ ...old.rankings, [section]:{ ...old.rankings[section], [key]:value } } }) : old);
  const save = async () => { if (!data || !rules) return; await saveSettings({ leagueId:id, seasonId:data.season.id, enabled, pointRules:rules }).unwrap(); await saveAdjustments({ leagueId:id, seasonId:data.season.id, adjustments:data.participants.map((p) => ({ participant_id:p.id, ...(adjustments[p.id] ?? { league_points:0,tournament_points:0,championships:0 }) })) }).unwrap(); };
  if (isLoading) return <Box sx={{ p:3, textAlign:"center" }}><CircularProgress /></Box>;
  if (error || !data || !rules) return <Box sx={{ p:2 }}><Alert severity="error">리그 순위를 불러오지 못했습니다.</Alert></Box>;
  const changeSeason = (value: string) => { setSeasonId(value); setVisibleCount(10); setSearchParams(settingsMode ? { settings:"1",season:value } : { season:value }); };
  if (!settingsMode) {
    const openMemberDetail = (memberId: number) => navigate(
      `/club/${data.league_info.group_id}/member/${memberId}`,
      { state: { fromLeagueRanking: true, returnTo: `${location.pathname}${location.search}` } },
    );
    return <Box sx={{ maxWidth:720, mx:"auto", p:2, pb:8 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb:2 }}>
        <Button onClick={() => navigate(`/league/${id}`)} sx={{ minWidth:36 }}><ArrowBackIcon /></Button>
        <Typography variant="h6" fontWeight={900} sx={{ flex:1 }}>순위</Typography>
        <Select size="small" value={data.season.id} onChange={(e) => changeSeason(String(e.target.value))} sx={{ minWidth:116, borderRadius:2 }}>{data.seasons.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</Select>
        {data.can_manage && <Button variant="outlined" onClick={() => setSearchParams({ settings:"1", season:data.season.id })} sx={{ whiteSpace:"nowrap", borderRadius:2, fontWeight:800 }}>순위 설정</Button>}
      </Stack>
      {data.unit_rankings.length > 0 ? data.unit_rankings.map((section) => <RankingSection key={`${section.type}-${section.round}`} title={section.title} rows={section.rows} visibleCount={visibleCount} currentUserId={data.currentUserId} onSelect={openMemberDetail} onMore={() => setVisibleCount((count) => count+10)} />) : <>
        <RankingSection title="리그" rows={data.league.rankings} visibleCount={visibleCount} currentUserId={data.currentUserId} onSelect={openMemberDetail} onMore={() => setVisibleCount((count) => count+10)} />
        {data.tournament.rankings.some((row) => row.total_points > 0 || row.matches_played > 0) && <RankingSection title="대회" rows={data.tournament.rankings} visibleCount={visibleCount} currentUserId={data.currentUserId} onSelect={openMemberDetail} onMore={() => setVisibleCount((count) => count+10)} />}
      </>}
    </Box>;
  }
  return <Box sx={{ maxWidth:720, mx:"auto", p:2, pb:8 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb:2 }}><Button onClick={() => setSearchParams({ season:data.season.id })} sx={{ minWidth:36 }}><ArrowBackIcon /></Button><Typography variant="h6" fontWeight={900} sx={{ flex:1 }}>{data.league_info.name} 순위 설정</Typography><Select size="small" value={data.season.id} onChange={(e) => changeSeason(String(e.target.value))}>{data.seasons.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</Select></Stack>
    {data.can_manage && <FormControlLabel control={<Checkbox checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />} label={<Typography fontWeight={800}>이번 리그만 별도 적용</Typography>} />}
    <Box sx={{ opacity:enabled ? 1 : .62, pointerEvents:enabled ? "auto" : "none" }}>
      <FormControlLabel
        control={<Checkbox checked={rules.combineAllRounds === true} disabled={!data.can_combine_all_rounds} onChange={(e) => setRules({ ...rules, combineAllRounds:e.target.checked })} />}
        label={<Box><Typography fontWeight={800}>모든 라운드 포인트 합계</Typography>{!data.can_combine_all_rounds && <Typography fontSize={11} color="text.secondary">복식·단체전의 동일 팀 편성 조건을 만족하지 않습니다.</Typography>}</Box>}
      />
      <Typography fontWeight={900} sx={{ mt:2, mb:1 }}>기본 포인트</Typography>
      <Stack direction="row" spacing={1}><NumberField label="리그 참석" value={rules.attendance.league} onChange={(v) => setRules({ ...rules, attendance:{ ...rules.attendance, league:v } })} /><NumberField label="대회 참석" value={rules.attendance.tournament} onChange={(v) => setRules({ ...rules, attendance:{ ...rules.attendance, tournament:v } })} /></Stack>
      <Typography fontWeight={900} sx={{ mt:2, mb:1 }}>경기당 포인트</Typography>
      <Stack direction="row" spacing={1} alignItems="center"><Select size="small" fullWidth value={rules.matchPoints.mode} onChange={(e) => setRules({ ...rules, matchPoints:{ ...rules.matchPoints, mode:e.target.value as "sets"|"win" } })}><MenuItem value="sets">획득한 세트스코어</MenuItem><MenuItem value="win">승점 방식</MenuItem></Select>{rules.matchPoints.mode === "win" && <NumberField label="승리 승점" value={rules.matchPoints.winPoints} onChange={(v) => setRules({ ...rules, matchPoints:{ ...rules.matchPoints, winPoints:v } })} />}</Stack>
      <Stack direction="row" flexWrap="wrap">{([['singles','단식'],['doubles','복식'],['team','단체전']] as const).map(([key,label]) => <FormControlLabel key={key} control={<Checkbox checked={rules.matchPoints.eventTypes[key]} onChange={(e) => setRules({ ...rules, matchPoints:{ ...rules.matchPoints, eventTypes:{ ...rules.matchPoints.eventTypes,[key]:e.target.checked } } })} />} label={label} />)}{([['league','단일리그'],['group','조별리그'],['tournament','토너먼트']] as const).map(([key,label]) => <FormControlLabel key={key} control={<Checkbox checked={rules.matchPoints.formats[key]} onChange={(e) => setRules({ ...rules, matchPoints:{ ...rules.matchPoints, formats:{ ...rules.matchPoints.formats,[key]:e.target.checked } } })} />} label={label} />)}</Stack>
      <Typography fontWeight={900} sx={{ mt:2, mb:1 }}>입상자 포인트</Typography>
      {(Object.keys(rankingLabels) as Array<keyof typeof rankingLabels>).map((section) => { const rule=rules.rankings[section]; const rounds=["8","16","32","64","128"] as const; const nextRound=section.startsWith("tournament") ? rounds.find((round) => rule.eliminationRounds?.[round] == null) : undefined; return <Box key={section} sx={{ mb:1.5, p:1.2, border:"1px solid #E5E7EB", borderRadius:2 }}><FormControlLabel control={<Checkbox checked={rule.enabled} onChange={(e) => setRules({ ...rules, rankings:{ ...rules.rankings,[section]:{ ...rule,enabled:e.target.checked } } })} />} label={<Typography fontWeight={800} fontSize={13}>{rankingLabels[section]}</Typography>} /><Box sx={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:.7 }}>{(Object.keys(rankLabels) as Array<keyof typeof rankLabels>).map((key) => <NumberField key={key} label={rankLabels[key]} value={rule[key]} onChange={(v) => updateRank(section,key,v)} />)}{Object.entries(rule.eliminationRounds ?? {}).map(([round,value]) => <NumberField key={round} label={`${round}강`} value={Number(value)} onChange={(v) => setRules({ ...rules,rankings:{ ...rules.rankings,[section]:{ ...rule,eliminationRounds:{ ...rule.eliminationRounds,[round]:v } } } })} />)}{nextRound && <Button variant="outlined" sx={{ gridColumn:"1/-1" }} onClick={() => setRules({ ...rules,rankings:{ ...rules.rankings,[section]:{ ...rule,eliminationRounds:{ ...rule.eliminationRounds,[nextRound]:0 } } } })}>{nextRound}강 포인트 추가</Button>}</Box></Box>; })}
      <FormControlLabel control={<Checkbox checked={rules.rankings.tournamentLower.excludeUpperPointsOnLowerAdvance === true} onChange={(e) => setRules({ ...rules,rankings:{ ...rules.rankings,tournamentLower:{ ...rules.rankings.tournamentLower,excludeUpperPointsOnLowerAdvance:e.target.checked } } })} />} label="토너먼트 하위부 진출 시, 상위부 포인트 제외" />
    </Box>
    <Typography fontWeight={900} sx={{ mt:2, mb:1 }}>참가자 포인트 보정</Typography><Typography fontSize={12} color="text.secondary" sx={{ mb:1 }}>계산된 포인트에 더하거나 뺄 값을 입력합니다.</Typography>
    <Stack spacing={.8}>{data.participants.map((p) => { const a=adjustments[p.id] ?? { league_points:0,tournament_points:0,championships:0 }; const total=rows.filter((r) => Number(r.member_id)===Number(p.member_id) || r.name===p.name).reduce((sum,r) => sum+r.total_points,0); return <Box key={p.id} sx={{ p:1, border:"1px solid #E5E7EB", borderRadius:2 }}><Stack direction="row" alignItems="center" spacing={.45}><Typography fontWeight={800}>{p.name}</Typography><DivisionBadge division={p.division}/><Box sx={{flex:1}}/><Typography color="#2563EB" fontWeight={900}>{total}점</Typography></Stack><Stack direction="row" spacing={.7} sx={{ mt:.7 }}><NumberField label="리그 보정" value={a.league_points} disabled={!enabled} onChange={(v) => setAdjustments({ ...adjustments, [p.id]:{ ...a, league_points:v } })} /><NumberField label="대회 보정" value={a.tournament_points} disabled={!enabled} onChange={(v) => setAdjustments({ ...adjustments, [p.id]:{ ...a, tournament_points:v } })} /><NumberField label="우승 보정" value={a.championships} disabled={!enabled} onChange={(v) => setAdjustments({ ...adjustments, [p.id]:{ ...a, championships:v } })} /></Stack></Box>; })}</Stack>
    {data.can_manage && <Button fullWidth variant="contained" disabled={settingsState.isLoading || adjustmentsState.isLoading} onClick={() => void save()} sx={{ mt:2, height:44, fontWeight:900 }}>저장</Button>}
  </Box>;
}
function NumberField({label,value,onChange,disabled=false}:{label:string;value:number;onChange:(v:number)=>void;disabled?:boolean}) { return <TextField type="number" size="small" fullWidth label={label} value={value} disabled={disabled} onChange={(e)=>onChange(Number(e.target.value)||0)} inputProps={{ step:1 }} />; }

type LeagueRankingListRow = { rank:number|null; name:string; division?:string|null; total_points:number; member_id?:number|null; member_ids?:number[]; is_pre_registered?:boolean };
function RankingSection({ title, rows, visibleCount, currentUserId, onSelect, onMore }: { title:string; rows:LeagueRankingListRow[]; visibleCount:number; currentUserId:number; onSelect:(id:number)=>void; onMore:()=>void }) {
  const allRows=rows.filter((row)=>row.total_points>0||row.rank!=null); const visible=allRows.slice(0,visibleCount); const mine=allRows.find((row)=>row.member_id===currentUserId||row.member_ids?.includes(currentUserId)); const pinned=mine&&!visible.includes(mine)?mine:null;
  const card=(row:LeagueRankingListRow,isPinned=false)=>{const bg=row.rank===1?"#E9C23B":row.rank===2?"#D1D5DB":row.rank===3?"#D6A348":"#F3F4F6";const color=row.rank&&row.rank<=3?"#FFF":"#374151";const canOpen=row.member_id!=null&&!row.is_pre_registered;return <Card key={`${row.rank}-${row.name}-${isPinned}`} elevation={2} sx={{borderRadius:.85,boxShadow:"0 4px 12px rgba(0,0,0,.08)",bgcolor:isPinned?"#EEF2FF":"#FFF"}}><CardContent sx={{py:.95,px:1.3,"&:last-child":{pb:.95}}}><Stack direction="row" alignItems="center" spacing={.75}><Box sx={{width:42,height:30,borderRadius:"5px 0 0 5px",clipPath:"polygon(0 0,100% 0,82% 100%,0 100%)",bgcolor:bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,color,flexShrink:0}}>{row.rank??"-"}</Box><Box sx={{flex:1,minWidth:0}}><Stack direction="row" alignItems="center" spacing={.5}><Typography onClick={()=>canOpen&&onSelect(Number(row.member_id))} sx={{minWidth:0,fontSize:13.5,fontWeight:900,color:isPinned?"#1D4ED8":"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:canOpen?"pointer":"default",textDecoration:canOpen?"underline":"none"}}>{row.name}</Typography><DivisionBadge division={row.division}/>{row.is_pre_registered&&<Typography sx={{fontSize:9,fontWeight:800,color:"#6B7280",whiteSpace:"nowrap"}}>사전등록</Typography>}</Stack></Box><Box sx={{textAlign:"right",minWidth:52}}><Typography sx={{fontSize:24,fontWeight:900,color:"#1D4ED8",lineHeight:1}}>{row.total_points}</Typography><Typography sx={{fontSize:10,color:"text.secondary",fontWeight:700,lineHeight:1.1}}>포인트</Typography></Box></Stack></CardContent></Card>};
  return <Box sx={{mb:3}}><Typography fontWeight={900} fontSize={18} sx={{mb:1.2}}>{title}</Typography><Stack spacing={.8}>{visible.map((row)=>card(row))}</Stack>{allRows.length>visibleCount&&<Button fullWidth variant="outlined" endIcon={<ExpandMoreIcon sx={{fontSize:18}}/>} onClick={onMore} sx={{mt:1.1,height:42,borderRadius:2.5,borderColor:"#2F80ED",bgcolor:"#FFF",color:"#1976D2",fontSize:14,fontWeight:900}}>더보기</Button>}{pinned&&<Box sx={{mt:.8}}>{card(pinned,true)}</Box>}</Box>;
}
