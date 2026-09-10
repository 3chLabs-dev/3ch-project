import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, LinearProgress, MenuItem, Paper, Stack, Step, StepLabel, Stepper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import FolderIcon from "@mui/icons-material/Folder";
import ImageIcon from "@mui/icons-material/Image";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import CropIcon from "@mui/icons-material/Crop";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import TuneIcon from "@mui/icons-material/Tune";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { RootState } from "../../app/store";
import { useSelector } from "react-redux";
import { useGetMyGroupsQuery, type Group } from "../../features/group/groupApi";
import {
  useAddParticipantsMutation, useCreateLeagueMutation, useGetLeagueParticipantsQuery,
  useGetMyGroupLeaguesQuery, useInitLeagueMatchesMutation, useScanLeagueResultImportMutation,
  useUpdateLeagueMatchMutation, useSyncLeagueProgramMatchesMutation, type LeagueListItem, type LeagueMatch, type LeagueResultImportMatch, type LeagueResultImportParticipant,
} from "../../features/league/leagueApi";
import { generateProgramRoundMatches } from "../../utils/programMatchGenerator";
import type { MatchRuleType, ProgramOption, ProgramType } from "../../features/league/types/tournament.types";
import LeagueFilterDialog from "../../components/LeagueFilterDialog";
import { formatLeagueDateTime } from "../../utils/dateUtils";
import { getLeagueClubColor } from "../../features/league/leagueScheduleColors";
import { ParticipantName } from "../../components/ParticipantName";

type Mode = "new" | "existing";
type LeagueStatus = "scheduled" | "active" | "completed";
const steps = ["등록 대상", "리그 유형", "리그 방식", "리그 규칙", "사진 등록"];
const GUIDE_IMAGES = [1,2,3,4,5].map((index) => `/images/vision-guide/guide-0${index}.png`);
type ImageEditorState = { file: File; url: string };
const idempotencyKey = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const todayLeagueName = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} 리그`;
};
const errorMessage = (error: unknown) => {
  const value = error as { data?: { message?: string }; message?: string };
  return value?.data?.message || value?.message || "처리 중 오류가 발생했습니다.";
};
const matchRuleType = (rule: string): MatchRuleType => rule === "5전 3선승제" ? "BEST_OF_5" : rule === "3세트제" ? "THREE_SET" : "BEST_OF_3";
const programType = (type: string): ProgramType => type === "복식" ? "DOUBLES" : type === "단체전" ? "TEAM" : "SINGLES";

export default function LeagueQuickResult() {
  const navigate = useNavigate();
  const token = useSelector((state: RootState) => state.auth.token);
  const preferredGroupId = useSelector((state: RootState) => state.leagueCreation.preferredGroupId);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorImageRef = useRef<HTMLImageElement>(null);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("new");
  const [leagueId, setLeagueId] = useState("");
  const [groupId, setGroupId] = useState(preferredGroupId || "");
  const [name, setName] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const defaultLeagueName = todayLeagueName();
  const [leagueType, setLeagueType] = useState("단식");
  const [format, setFormat] = useState("단일리그");
  const [groupCount, setGroupCount] = useState(2);
  const [rule, setRule] = useState("3전 2선승제");
  const [files, setFiles] = useState<File[]>([]);
  const [guideSlide, setGuideSlide] = useState(0);
  const [imageEditor, setImageEditor] = useState<ImageEditorState | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultGroup, setResultGroup] = useState(0);
  const [selectedParticipantKeys, setSelectedParticipantKeys] = useState<Set<string>>(new Set());
  const [participants, setParticipants] = useState<LeagueResultImportParticipant[]>([]);
  const [matches, setMatches] = useState<LeagueResultImportMatch[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [leagueFilterOpen, setLeagueFilterOpen] = useState(false);
  const [leagueFilterStart, setLeagueFilterStart] = useState("");
  const [leagueFilterEnd, setLeagueFilterEnd] = useState("");
  const [leagueFilterStatus, setLeagueFilterStatus] = useState<LeagueStatus[]>(["scheduled", "active", "completed"]);
  const [visibleLeagueCounts, setVisibleLeagueCounts] = useState<Record<string, number>>({});
  const [scan, { isLoading: scanning }] = useScanLeagueResultImportMutation();
  const [createLeague] = useCreateLeagueMutation();
  const [addParticipants] = useAddParticipantsMutation();
  const [initMatches] = useInitLeagueMatchesMutation();
  const [updateMatch] = useUpdateLeagueMatchMutation();
  const [syncProgramMatches] = useSyncLeagueProgramMatchesMutation();
  const { data: groupsData } = useGetMyGroupsQuery(undefined, { skip: !token });
  const { data: leaguesData } = useGetMyGroupLeaguesQuery(undefined, { skip: !token });
  const { data: existingParticipantData } = useGetLeagueParticipantsQuery(leagueId, { skip: mode !== "existing" || !leagueId });
  const manageableGroups = (groupsData?.groups || []).filter((group) => group.role === "owner" || (group.role === "admin" && group.management_permissions?.league));
  const scheduleGroupIds = manageableGroups.map((group) => group.id);
  const filteredExistingLeagues = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return (leaguesData?.leagues || []).filter((league) => {
      if (!league.start_date || !scheduleGroupIds.includes(league.group_id ?? "")) return false;
      const dateOnly = league.start_date.slice(0, 10);
      if (leagueFilterStart && dateOnly < leagueFilterStart) return false;
      if (leagueFilterEnd && dateOnly > leagueFilterEnd) return false;
      if (!leagueFilterStatus.length) return true;
      const startAt = new Date(league.start_date);
      const status: LeagueStatus = league.status === "completed" || startAt < now ? "completed" : league.status === "active" ? "active" : "scheduled";
      return leagueFilterStatus.includes(status);
    }).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }, [leagueFilterEnd, leagueFilterStart, leagueFilterStatus, leaguesData?.leagues, scheduleGroupIds.join("|")]);
  const expectedFiles = format === "조별리그" ? groupCount : 1;
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  useEffect(() => () => { if (imageEditor) URL.revokeObjectURL(imageEditor.url); }, [imageEditor]);

  if (!token) {
    return <Navigate to={`/login?redirect=${encodeURIComponent("/league/quick-result")}`} replace />;
  }

  const openImageEditor = (file?: File) => {
    if (!file || files.length >= expectedFiles) return;
    setCropMode(false); setCrop(undefined); setCompletedCrop(undefined); setEditorLoaded(false);
    setImageEditor({ file, url: URL.createObjectURL(file) });
  };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => { openImageEditor(event.target.files?.[0]); event.target.value = ""; };
  const rotateImage = async (degrees: number) => {
    const image = editorImageRef.current;
    if (!image || !imageEditor) return;
    const canvas = document.createElement("canvas"); canvas.width = image.naturalHeight; canvas.height = image.naturalWidth;
    const context = canvas.getContext("2d"); if (!context) return;
    context.translate(canvas.width / 2, canvas.height / 2); context.rotate(degrees * Math.PI / 180);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .92)); if (!blob) return;
    setEditorLoaded(false); setImageEditor({ file: new File([blob], imageEditor.file.name, { type: "image/jpeg" }), url: URL.createObjectURL(blob) });
  };
  const enableCrop = () => {
    const image = editorImageRef.current; if (!image) return;
    setCropMode(true); setCrop({ unit:"%", x:0, y:0, width:100, height:100 });
    setCompletedCrop({ unit:"px", x:0, y:0, width:image.width, height:image.height });
  };
  const confirmEditedImage = async () => {
    const image = editorImageRef.current; if (!image || !imageEditor) return;
    const selected = cropMode && completedCrop ? completedCrop : { x:0, y:0, width:image.width, height:image.height };
    const scaleX = image.naturalWidth / Math.max(image.width, 1), scaleY = image.naturalHeight / Math.max(image.height, 1);
    const sx=selected.x*scaleX, sy=selected.y*scaleY, sw=selected.width*scaleX, sh=selected.height*scaleY;
    const canvas=document.createElement("canvas"); canvas.width=Math.min(2000,Math.max(1,Math.round(sw))); canvas.height=Math.max(1,Math.round(sh*canvas.width/sw));
    const context=canvas.getContext("2d"); if (!context) return;
    context.drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>((resolve)=>canvas.toBlob(resolve,"image/jpeg",.92)); if(!blob)return;
    setFiles((current)=>[...current,new File([blob],`league-sheet-${current.length+1}.jpg`,{type:"image/jpeg"})]);
    setParticipants([]); setMatches([]); setError(""); setImageEditor(null);
  };
  const openFilePicker = async () => {
    const picker=(window as typeof window & { showOpenFilePicker?: (options: unknown)=>Promise<Array<{getFile:()=>Promise<File>}>> }).showOpenFilePicker;
    if(!picker){fileInputRef.current?.click();return;}
    try { const [handle]=await picker({multiple:false,types:[{description:"이미지 파일",accept:{"image/*":[".jpg",".jpeg",".png",".webp",".heic",".heif"]}}]}); openImageEditor(await handle.getFile()); } catch(e){ if((e as {name?:string}).name!=="AbortError")fileInputRef.current?.click(); }
  };
  const recognize = async () => {
    try {
      setError(""); setProgress(15);
      const result = await scan({ files, groupIds: groupId ? [groupId] : [], idempotencyKey: idempotencyKey() }).unwrap();
      setProgress(100); setParticipants(result.participants); setMatches(result.matches); setSelectedParticipantKeys(new Set(result.participants.map((item)=>item.key))); setResultGroup(0); setResultOpen(true);
    } catch (e) { setProgress(0); setError(errorMessage(e)); }
  };
  const canContinue = () => {
    if (step === 0) return mode === "new" ? Boolean(groupId) : Boolean(leagueId);
    if (step === 4) return files.length === expectedFiles;
    return true;
  };
  const save = async () => {
    try {
      setError(""); setProgress(5);
      let targetLeagueId = leagueId;
      const existing = existingParticipantData?.participants || [];
      const normalizedExisting = new Set(existing.map((item) => item.name.replace(/\s+/g, "").toLowerCase()));
      const selectedParticipants = participants.filter((item)=>selectedParticipantKeys.has(item.key) && item.name.trim());
      const unique = selectedParticipants.filter((item, index, all) => all.findIndex((other) => other.name === item.name && other.division === item.division) === index);
      const missing = unique.filter((item) => !normalizedExisting.has(item.name.replace(/\s+/g, "").toLowerCase()));
      let quickProgram: ProgramOption | null = null;
      let quickProgramMatches: LeagueMatch[] = [];
      if (mode === "new") {
        const groupSizes = format === "조별리그"
          ? Array.from({ length: groupCount }, (_, imageIndex) => selectedParticipants.filter((item) => item.imageIndex === imageIndex).length)
          : [unique.length];
        if (groupSizes.some((size) => size < 2)) throw new Error("각 조에서 참가자를 2명 이상 선택해 주세요.");
        const matchCount = groupSizes.reduce((sum, size) => sum + size * Math.max(0, size - 1) / 2, 0);
        const roundFormat = format === "조별리그" ? "GROUP" as const : "LEAGUE" as const;
        const formationPlayers = (imageIndex: number) => selectedParticipants.filter((item) => item.imageIndex === imageIndex).map((item) => ({
          name: item.name,
          level: Number.parseInt(item.division, 10) || 0,
          sourceGroupId: groupId,
        }));
        const block = {
          title: "1라운드",
          type: programType(leagueType),
          format: roundFormat,
          roundOption: format === "조별리그" ? "PRELIM" as const : "NONE" as const,
          matchRule: rule as ProgramOption["matchRule"],
          expectedMinutes: matchCount * 10,
          matchCount,
          groupSizes,
          ...(format === "조별리그" ? { groupAssignments: groupSizes.map((_, index) => formationPlayers(index)), groupFormationPublished: true } : {}),
        };
        quickProgram = {
          title: "빠른 결과 등록 프로그램", groupSizes, matchRule: rule as ProgramOption["matchRule"], matchCount,
          expectedMinutes: matchCount * 10, recommendationScore: 0, description: "대진표 사진에서 생성한 프로그램",
          blocks: [block], totalBlockMatchCount: matchCount, totalProgramMinutes: matchCount * 10, isOverTime: false,
          rounds: [{ id: 1, expanded: true, program: programType(leagueType), format: roundFormat, option: format === "조별리그" ? "PRELIM" : "NONE", matchRule: matchRuleType(rule), teamPlayerCount: 3, teamMatchType: "SSS", groupSizes, ...(format === "조별리그" ? { groupAssignments: groupSizes.map((_, index) => formationPlayers(index)) } : {}) }],
        };
        const leagueName = name.trim() || defaultLeagueName;
        const created = await createLeague({
          name: leagueName, title: leagueName, type: "클럽 이벤트", format: "이벤트 프로그램", sport: "탁구",
          start_date: new Date().toISOString(), rules: "프로그램별 설정", group_id: groupId,
          recruit_count: unique.length, participant_count: unique.length, sort_order: "이름 > 부수",
          register_unmatched_as_pre_members: true,
          participants: unique.map((item) => ({ name: item.name, division: item.division, member_id: item.member_id })),
          program_data: quickProgram,
        }).unwrap();
        targetLeagueId = created.league.id;
        const createdParticipants = created.participants || [];
        const generatedMatches = generateProgramRoundMatches(targetLeagueId, quickProgram, createdParticipants, 1).map((match) => ({ ...match, program_round: 1, program_block_type: programType(leagueType) }));
        quickProgramMatches = generatedMatches;
        await syncProgramMatches({ leagueId: targetLeagueId, matches: generatedMatches, resetResults: false }).unwrap();
      } else if (missing.length) {
        await addParticipants({ leagueId: targetLeagueId, participants: missing.map((item) => ({ name: item.name, division: item.division, member_id: item.member_id })) }).unwrap();
      }
      setProgress(40);
      const initialized = mode === "new" && quickProgram
        ? { matches: quickProgramMatches }
        : await initMatches({ id: targetLeagueId, force: false }).unwrap();
      const participantName = (key: string) => participants.find((item) => item.key === key)?.name || "";
      let saved = 0;
      for (const recognized of matches.filter((item)=>selectedParticipantKeys.has(item.participantAKey)&&selectedParticipantKeys.has(item.participantBKey))) {
        const a = participantName(recognized.participantAKey);
        const b = participantName(recognized.participantBKey);
        const target = initialized.matches.find((item) =>
          (item.participant_a_name === a && item.participant_b_name === b) || (item.participant_a_name === b && item.participant_b_name === a));
        if (!target) continue;
        const reversed = target.participant_a_name === b;
        await updateMatch({ leagueId: targetLeagueId, matchId: target.id, updates: {
          score_a: reversed ? recognized.scoreB : recognized.scoreA,
          score_b: reversed ? recognized.scoreA : recognized.scoreB, status: "done",
        } }).unwrap();
        saved += 1; setProgress(40 + Math.round((saved / Math.max(matches.length, 1)) * 60));
      }
      navigate(mode === "new"
        ? `/league/${targetLeagueId}/program/bracket?program=1&round=1&back=detail&quickFinals=1`
        : `/league/${targetLeagueId}/bracket`, { replace: true });
    } catch (e) { setProgress(0); setError(errorMessage(e)); }
  };

  return <Box sx={{ maxWidth: 720, mx: "auto", pb: 12 }}>
    <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2, pb: 2, borderBottom: "1px solid #D9DDE6" }}>빠른 결과 등록</Typography>
    <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      {step === 0 && <Stack spacing={2}>
        <Typography fontWeight={900}>어디에 결과를 등록할까요?</Typography>
        <Stack direction="row" spacing={1}>{([['new','리그 신규 생성'],['existing','생성된 리그에 등록']] as const).map(([value,label]) => <Button key={value} fullWidth variant={mode === value ? "contained" : "outlined"} onClick={() => setMode(value)}>{label}</Button>)}</Stack>
        {mode === "new" ? <><TextField label="리그 이름" placeholder={nameFocused ? "" : defaultLeagueName} value={name} onFocus={()=>setNameFocused(true)} onBlur={()=>setNameFocused(false)} onChange={(e) => setName(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ "& input::placeholder": { color: "#9CA3AF", opacity: 1 } }} /><TextField select label="클럽" value={groupId} onChange={(e) => setGroupId(e.target.value)}>{manageableGroups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}</TextField>{!manageableGroups.length && <Alert severity="info">리그를 만들 수 있는 클럽이 필요합니다.</Alert>}</> :
          <ExistingLeaguePicker leagues={filteredExistingLeagues} groups={manageableGroups} visibleCounts={visibleLeagueCounts} onMore={(id, count)=>setVisibleLeagueCounts((current)=>({...current,[id]:count+5}))} onFilter={()=>setLeagueFilterOpen(true)} onSelect={(id)=>{setLeagueId(id);navigate(`/league/${id}/bracket?resultImport=1`);}} />}
      </Stack>}
      {step === 1 && <Choice title="리그 유형" value={leagueType} values={["단식","복식","단체전"]} onChange={setLeagueType} />}
      {step === 2 && <Stack spacing={1.5}><Typography fontWeight={900}>리그 방식</Typography><Button variant={format === "단일리그" ? "contained" : "outlined"} onClick={()=>setFormat("단일리그")} sx={{height:48}}>단일리그</Button><Button variant={format === "조별리그" ? "contained" : "outlined"} onClick={()=>setFormat("조별리그")} sx={{height:48}}>조별리그</Button>{format === "조별리그" && <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}><IconButton onClick={()=>setGroupCount((n)=>Math.max(2,n-1))} sx={{border:"1px solid #93C5FD",color:"#1976D2"}}><RemoveIcon /></IconButton><Box sx={{minWidth:64,py:.8,textAlign:"center",border:"1px solid #D1D5DB",borderRadius:2,fontWeight:900,fontSize:18}}>{groupCount}</Box><IconButton onClick={()=>setGroupCount((n)=>Math.min(16,n+1))} sx={{border:"1px solid #93C5FD",color:"#1976D2"}}><AddIcon /></IconButton><Typography fontWeight={800}>개 조</Typography></Stack>}</Stack>}
      {step === 3 && <Choice title="리그 규칙" value={rule} values={["3전 2선승제","5전 3선승제","3세트제"]} onChange={setRule} />}
      {step === 4 && <Stack spacing={2}><Typography fontWeight={900}>대진표 사진 등록</Typography><Typography color="text.secondary" fontSize={14}>{format === "조별리그" ? `1조부터 순서대로 ${groupCount}장을 한 장씩 등록해 주세요.` : "대진표 사진 1장을 등록해 주세요."}</Typography><Box sx={{position:"relative",bgcolor:"#F3F4F6",borderRadius:2,overflow:"hidden"}}><Box component="img" src={GUIDE_IMAGES[guideSlide]} alt={`안내 이미지 ${guideSlide+1}`} sx={{width:"100%",height:180,objectFit:"contain"}}/><IconButton disabled={guideSlide===0} onClick={()=>setGuideSlide(n=>n-1)} sx={{position:"absolute",left:8,top:"42%",bgcolor:"white"}}><NavigateBeforeIcon/></IconButton><IconButton disabled={guideSlide===GUIDE_IMAGES.length-1} onClick={()=>setGuideSlide(n=>n+1)} sx={{position:"absolute",right:8,top:"42%",bgcolor:"white"}}><NavigateNextIcon/></IconButton></Box><Stack direction="row" justifyContent="center" spacing={.6}>{GUIDE_IMAGES.map((_,i)=><Box key={i} onClick={()=>setGuideSlide(i)} sx={{width:i===guideSlide?18:7,height:7,borderRadius:5,bgcolor:i===guideSlide?"#2563EB":"#CBD5E1",cursor:"pointer"}}/>)}</Stack><input ref={cameraInputRef} hidden type="file" accept="image/*" capture="environment" onChange={handleFile}/><input ref={galleryInputRef} hidden type="file" accept="image/*" onChange={handleFile}/><input ref={fileInputRef} hidden type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={handleFile}/><Stack direction="row" justifyContent="space-around"><SourceButton label="카메라" icon={<CameraAltIcon sx={{fontSize:32,color:"#777"}}/>} onClick={()=>cameraInputRef.current?.click()}/><SourceButton label="사진" icon={<ImageIcon sx={{fontSize:32,color:"#3156A6"}}/>} onClick={()=>galleryInputRef.current?.click()}/><SourceButton label="내 파일" icon={<FolderIcon sx={{fontSize:34,color:"#777"}}/>} onClick={openFilePicker}/></Stack>{files.length>0&&<Stack direction="row" spacing={1} sx={{overflowX:"auto"}}>{urls.map((url,i)=><Box key={url} sx={{position:"relative",flex:"0 0 92px"}}><Box component="img" src={url} sx={{width:92,height:92,objectFit:"cover",borderRadius:1}}/><Chip label={`${i+1}조`} size="small" sx={{position:"absolute",left:4,bottom:4}}/><IconButton size="small" onClick={()=>setFiles(all=>all.filter((_,j)=>j!==i))} sx={{position:"absolute",right:1,top:1,bgcolor:"white"}}><RemoveIcon fontSize="small"/></IconButton></Box>)}</Stack>}<Typography textAlign="center" fontSize={13} fontWeight={800}>{files.length}/{expectedFiles}장 확인 완료</Typography><Button variant="contained" disabled={files.length !== expectedFiles || scanning} onClick={recognize}>AI 인식 시작</Button></Stack>}
      {progress > 0 && <Box sx={{ mt: 2 }}><LinearProgress variant="determinate" value={progress} /><Typography textAlign="right" fontSize={12}>{progress}%</Typography></Box>}{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mt: 4 }}><Button fullWidth variant="contained" disableElevation disabled={step === 0 || scanning || progress > 0 && progress < 100} onClick={() => setStep((s) => s-1)} sx={{height:44,borderRadius:1,fontWeight:900,bgcolor:"#777","&:hover":{bgcolor:"#777"},"&.Mui-disabled":{bgcolor:"#BDBDBD",color:"#fff"}}}>이전</Button>{step < 4 && <Button fullWidth variant="contained" disableElevation disabled={!canContinue()} onClick={() => setStep((s)=>s+1)} sx={{height:44,borderRadius:1,fontWeight:900,bgcolor:"#2F80ED","&:hover":{bgcolor:"#256FD1"},"&.Mui-disabled":{bgcolor:"#CFE1FB",color:"#fff"}}}>다음</Button>}</Stack>
    </Paper>
    <LeagueFilterDialog key={leagueFilterOpen ? "open" : "closed"} open={leagueFilterOpen} onClose={()=>setLeagueFilterOpen(false)} startDate={leagueFilterStart} endDate={leagueFilterEnd} status={leagueFilterStatus} onApply={({startDate,endDate,status})=>{setLeagueFilterStart(startDate);setLeagueFilterEnd(endDate);setLeagueFilterStatus(status);setVisibleLeagueCounts({});setLeagueFilterOpen(false);}} />
    <Dialog open={resultOpen} onClose={()=>{if(!(progress>0&&progress<100))setResultOpen(false)}} fullWidth maxWidth="lg" slotProps={{paper:{sx:{position:"relative",borderRadius:{xs:2,sm:3},m:{xs:1,sm:4},width:{xs:"calc(100% - 16px)",sm:"calc(100% - 64px)"},maxHeight:{xs:"calc(100% - 16px)",sm:"calc(100% - 64px)"}}}}}><DialogTitle fontWeight={900}>AI 인식 결과</DialogTitle><DialogContent dividers sx={{px:{xs:1.5,sm:3}}}><Typography sx={{mb:2,color:"#6B7280",fontSize:13,fontWeight:700}}>클럽 회원 이름과 동일하면 회원 계정에 연결합니다. 나머지는 사전등록 회원으로 등록되며 참가명단 열에서 이름과 부수를 수정할 수 있습니다.</Typography>{expectedFiles>1&&<Stack direction="row" spacing={1} sx={{mb:2,overflowX:"auto"}}>{Array.from({length:expectedFiles},(_,i)=><Button key={i} variant={resultGroup===i?"contained":"outlined"} onClick={()=>setResultGroup(i)} sx={{minWidth:64}}>{i+1}조</Button>)}</Stack>}<ResultMatrix participants={participants.filter((item)=>item.imageIndex===resultGroup&&selectedParticipantKeys.has(item.key))} matches={matches.filter((item)=>item.imageIndex===resultGroup)} allMatches={matches} onChange={setMatches} onParticipantsChange={(key, updates)=>setParticipants((all)=>all.map((item)=>item.key===key?{...item,...updates}:item))}/></DialogContent><DialogActions><Button disabled={progress>0&&progress<100} onClick={()=>setResultOpen(false)}>취소</Button><Button variant="contained" disabled={!selectedParticipantKeys.size||progress>0&&progress<100} onClick={save}>대진표에 입력</Button></DialogActions>{progress>0&&progress<100&&<Box sx={{position:"absolute",inset:0,bgcolor:"rgba(255,255,255,.82)",display:"grid",placeItems:"center",zIndex:2}}><Paper elevation={8} sx={{width:"min(420px,80%)",p:2.5,borderRadius:3}}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={900}>경기 결과 저장 중</Typography><Typography color="primary" fontWeight={900}>{progress}%</Typography></Stack><LinearProgress variant="determinate" value={progress} sx={{mt:1,height:10,borderRadius:99}}/></Paper></Box>}</Dialog>
    <Dialog open={Boolean(imageEditor)} onClose={()=>setImageEditor(null)} fullWidth maxWidth="md"><DialogTitle fontWeight={900}>사진 확인</DialogTitle><DialogContent dividers><Typography sx={{mb:1,color:"#6B7280",fontSize:13,fontWeight:700}}>이름과 점수가 잘 인식되도록 정방향으로 맞추고, 대진표 부분만 인식 영역으로 지정해 주세요.</Typography><Box sx={{height:"min(58vh,520px)",bgcolor:"#111827",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden","& .ReactCrop":{maxWidth:"100%",maxHeight:"100%",lineHeight:0,touchAction:"none"},"& .ReactCrop__crop-mask":{fill:"rgba(0,0,0,.62)"},"& .ReactCrop__crop-selection":{border:"1px solid rgba(255,255,255,.9)",backgroundImage:"none",animation:"none"},"& .ReactCrop__drag-handle":{display:"block !important",width:28,height:28,background:"transparent",border:0,borderRadius:0},"& .ReactCrop__drag-handle.ord-nw":{top:0,left:0,transform:"none",borderTop:"3px solid #fff",borderLeft:"3px solid #fff"},"& .ReactCrop__drag-handle.ord-ne":{top:0,right:0,transform:"none",borderTop:"3px solid #fff",borderRight:"3px solid #fff"},"& .ReactCrop__drag-handle.ord-se":{right:0,bottom:0,transform:"none",borderRight:"3px solid #fff",borderBottom:"3px solid #fff"},"& .ReactCrop__drag-handle.ord-sw":{bottom:0,left:0,transform:"none",borderBottom:"3px solid #fff",borderLeft:"3px solid #fff"},"& .ReactCrop__drag-handle.ord-n, & .ReactCrop__drag-handle.ord-s":{display:"block !important",width:48,height:24,left:"50%"},"& .ReactCrop__drag-handle.ord-n":{top:0,transform:"translateX(-50%)",borderTop:"3px solid #fff"},"& .ReactCrop__drag-handle.ord-s":{bottom:0,transform:"translateX(-50%)",borderBottom:"3px solid #fff"},"& .ReactCrop__drag-handle.ord-e, & .ReactCrop__drag-handle.ord-w":{display:"block !important",width:24,height:48,top:"50%"},"& .ReactCrop__drag-handle.ord-e":{right:0,transform:"translateY(-50%)",borderRight:"3px solid #fff"},"& .ReactCrop__drag-handle.ord-w":{left:0,transform:"translateY(-50%)",borderLeft:"3px solid #fff"}}}>{imageEditor&&<ReactCrop crop={crop} onChange={(_,percent)=>setCrop(percent)} onComplete={setCompletedCrop} disabled={!cropMode} keepSelection={cropMode} ruleOfThirds={cropMode} minWidth={48} minHeight={48}><img ref={editorImageRef} src={imageEditor.url} onLoad={()=>setEditorLoaded(true)} alt="선택한 대진표" draggable={false} style={{display:"block",maxWidth:"100%",maxHeight:"min(58vh,520px)",objectFit:"contain"}}/></ReactCrop>}</Box><Stack direction="row" justifyContent="center" spacing={2} sx={{pt:1}}><EditorButton label="왼쪽으로 회전" icon={<RotateLeftIcon/>} onClick={()=>rotateImage(-90)}/><EditorButton label="자르기" icon={<CropIcon color={cropMode?"primary":"inherit"}/>} onClick={enableCrop}/><EditorButton label="오른쪽으로 회전" icon={<RotateRightIcon/>} onClick={()=>rotateImage(90)}/></Stack></DialogContent><DialogActions><Button onClick={()=>setImageEditor(null)}>취소</Button><Button variant="contained" disabled={!editorLoaded} onClick={confirmEditedImage}>{format==="조별리그"?`${files.length+1}조 사진 확인`:"사진 확인"}</Button></DialogActions></Dialog>
    <Dialog open={scanning} fullWidth maxWidth="xs"><DialogContent sx={{px:3.5,py:4}}><Typography textAlign="center" fontWeight={900}>AI가 사진 속 이름과 점수를 인식하는 중입니다.</Typography><Typography textAlign="center" sx={{my:1.5,color:"#6B7280",fontSize:13,lineHeight:1.5}}>사진 상태에 따라 인식 결과가 다를 수 있습니다.<br/>결과 화면에서 이름과 점수를 확인하고 수정해 주세요.</Typography><LinearProgress sx={{height:11,borderRadius:99,bgcolor:"#DBEAFE","& .MuiLinearProgress-bar":{borderRadius:99}}}/></DialogContent></Dialog>
  </Box>;
}

function Choice({ title, value, values, onChange }: { title: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <Stack spacing={1.5}><Typography fontWeight={900}>{title}</Typography>{values.map((item) => <Button key={item} variant={value === item ? "contained" : "outlined"} onClick={() => onChange(item)} sx={{height:48}}>{item}</Button>)}</Stack>;
}

function SourceButton({label,icon,onClick}:{label:string;icon:React.ReactNode;onClick:()=>void}){return <Button onClick={onClick} sx={{flexDirection:"column",gap:.6,color:"#374151",fontWeight:800}}>{icon}<Typography fontSize={11} fontWeight={800}>{label}</Typography></Button>}
function EditorButton({label,icon,onClick}:{label:string;icon:React.ReactNode;onClick:()=>void}){return <Stack alignItems="center"><Tooltip title={label}><IconButton onClick={onClick}>{icon}</IconButton></Tooltip><Typography fontSize={11} color="text.secondary" fontWeight={700}>{label}</Typography></Stack>}

function ExistingLeaguePicker({ leagues, groups, visibleCounts, onMore, onFilter, onSelect }: {
  leagues: LeagueListItem[];
  groups: Group[];
  visibleCounts: Record<string, number>;
  onMore: (groupId: string, visibleCount: number) => void;
  onFilter: () => void;
  onSelect: (leagueId: string) => void;
}) {
  const groupIds = groups.map((group) => group.id);
  const sections = groups.map((group) => ({ group, leagues: leagues.filter((league) => league.group_id === group.id) })).filter((section) => section.leagues.length);
  return <Stack spacing={2}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography fontWeight={900}>리그 일정</Typography>
      <IconButton size="small" aria-label="리그 일정 필터" onClick={onFilter}><TuneIcon fontSize="small" /></IconButton>
    </Stack>
    {!sections.length && <Paper variant="outlined" sx={{ p: 2.5, textAlign: "center", borderRadius: 2 }}><Typography color="text.secondary" fontWeight={700}>조건에 맞는 리그가 없습니다.</Typography></Paper>}
    {sections.map(({ group, leagues: groupLeagues }) => {
      const color = getLeagueClubColor(group.id, groupIds);
      const visibleCount = visibleCounts[group.id] ?? 5;
      return <Stack key={group.id} spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color }}/><Typography fontSize={14} fontWeight={900}>{group.name}</Typography><Typography fontSize={12} color="text.secondary">{groupLeagues.length}개</Typography><Divider sx={{ flex: 1 }}/></Stack>
        {groupLeagues.slice(0, visibleCount).map((league) => <Card key={league.id} elevation={2} onClick={()=>onSelect(league.id)} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,.08)", cursor: "pointer", borderLeft: `4px solid ${color}` }}><CardContent sx={{ py: 1.8, px: 2.5, "&:last-child": { pb: 1.8 } }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box sx={{ minWidth: 0 }}><Stack direction="row" spacing={.75} alignItems="center"><Typography fontWeight={700} fontSize={15} noWrap>{league.title || league.name}</Typography>{league.premium_enabled&&<Chip label="👑 프리미엄" size="small" sx={{ height:22,bgcolor:"#6D28D9",color:"#FFF2A8",fontSize:10.5,fontWeight:950 }}/>}</Stack><Typography fontSize={12} color="text.secondary">{formatLeagueDateTime(league.start_date)}</Typography></Box><Typography fontSize={14} color="text.secondary" fontWeight={700} sx={{ ml: 1, whiteSpace: "nowrap" }}>{league.recruit_count>0?`${league.participant_count} / ${league.recruit_count}명`:`${league.participant_count}명`}</Typography></Stack></CardContent></Card>)}
        {visibleCount < groupLeagues.length && <Button variant="outlined" endIcon={<ExpandMoreIcon />} onClick={()=>onMore(group.id,visibleCount)} sx={{ alignSelf:"center",minWidth:124,bgcolor:"#fff",borderColor:"#2F80ED",color:"#2F80ED",borderRadius:1.5,fontWeight:800 }}>더보기</Button>}
      </Stack>;
    })}
  </Stack>;
}

function ResultMatrix({ participants, matches, allMatches, onChange, onParticipantsChange }: {
  participants: LeagueResultImportParticipant[];
  matches: LeagueResultImportMatch[];
  allMatches: LeagueResultImportMatch[];
  onChange: Dispatch<SetStateAction<LeagueResultImportMatch[]>>;
  onParticipantsChange: (key: string, updates: Partial<LeagueResultImportParticipant>) => void;
}) {
  const updateScore = (match: LeagueResultImportMatch, participantKey: string, value: number) => {
    const field = match.participantAKey === participantKey ? "scoreA" : "scoreB";
    onChange((current) => current.map((item) => item === match
      ? { ...item, [field]: Math.max(0, Math.min(99, value)), needsReview: false }
      : item));
  };
  const findMatch = (a: string, b: string) => matches.find((match) =>
    (match.participantAKey === a && match.participantBKey === b)
    || (match.participantAKey === b && match.participantBKey === a));

  return <Box sx={{ mt: 2 }}>
    <Typography sx={{ mb: 1 }} fontWeight={900}>경기 결과</Typography>
    <Typography sx={{ display: { xs: "block", sm: "none" }, mb: 0.7, color: "#6B7280", fontSize: 11, fontWeight: 700 }}>
      경기 결과는 좌우로 밀어서 확인할 수 있습니다.
    </Typography>
    <TableContainer sx={{ border: "1px solid #D1D5DB", overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: Math.max(570, 190 + participants.length * 135), tableLayout: "fixed", "& th:first-of-type, & td:first-of-type": { position: "sticky", left: 0, zIndex: 2, boxShadow: "2px 0 3px rgba(15,23,42,0.08)" }, "& thead th:first-of-type": { zIndex: 3 } }}>
        <TableHead>
          <TableRow>
            <TableCell align="center" sx={{ width: 190, bgcolor: "#F3F4F6", fontWeight: 800 }}>참가명단</TableCell>
            {participants.map((participant, index) => <TableCell key={participant.key} align="center" sx={{ bgcolor: "#F3F4F6", p: 1 }}>
              <Chip label={index + 1} size="small" color="primary" sx={{ mb: .5, height: 23, fontWeight: 900 }} />
              <ParticipantName name={participant.name} division={participant.division} nameSx={{ fontWeight: 900, fontSize: 13 }} sx={{ justifyContent: "center" }} />
            </TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {participants.map((rowParticipant, rowIndex) => <TableRow key={rowParticipant.key}>
            <TableCell sx={{ bgcolor: "#F8FAFC", p: .75 }}>
              <Stack direction="row" spacing={.6} alignItems="center">
                <Chip label={rowIndex + 1} size="small" color="primary" variant="outlined" />
                <TextField size="small" placeholder="이름" value={rowParticipant.name} onChange={(event) => onParticipantsChange(rowParticipant.key, { name: event.target.value, member_id: rowParticipant.canonical_name === event.target.value ? rowParticipant.member_id : null })} inputProps={{ style: { padding: "7px 6px", fontWeight: 800 } }} sx={{ width: 92, flexShrink: 0, bgcolor: "#fff" }} />
                <TextField size="small" placeholder="부수" value={rowParticipant.division} onChange={(event) => onParticipantsChange(rowParticipant.key, { division: event.target.value })} inputProps={{ style: { textAlign: "center", padding: "7px 3px" } }} sx={{ width: 46, flexShrink: 0, bgcolor: "#fff" }} />
              </Stack>
            </TableCell>
            {participants.map((columnParticipant) => {
              if (rowParticipant.key === columnParticipant.key) return <TableCell key={columnParticipant.key} sx={{ bgcolor: "#E5E7EB" }} />;
              const match = findMatch(rowParticipant.key, columnParticipant.key);
              if (!match) return <TableCell key={columnParticipant.key} align="center" sx={{ color: "#9CA3AF" }}>-</TableCell>;
              const score = match.participantAKey === rowParticipant.key ? match.scoreA : match.scoreB;
              return <TableCell key={columnParticipant.key} align="center" sx={{ p: .5, bgcolor: match.needsReview ? "#FFF7ED" : "#fff" }}>
                <Stack direction="row" spacing={.3} alignItems="center" justifyContent="center">
                  <IconButton size="small" onClick={() => updateScore(match, rowParticipant.key, score - 1)} disabled={score <= 0}>−</IconButton>
                  <TextField size="small" type="text" value={score} onChange={(event) => updateScore(match, rowParticipant.key, Number(event.target.value.replace(/\D/g, "")) || 0)} inputProps={{ inputMode: "numeric", pattern: "[0-9]*", style: { textAlign: "center", padding: "7px 2px", fontWeight: 900 } }} sx={{ width: 48 }} />
                  <IconButton size="small" onClick={() => updateScore(match, rowParticipant.key, score + 1)}>+</IconButton>
                </Stack>
              </TableCell>;
            })}
          </TableRow>)}
        </TableBody>
      </Table>
    </TableContainer>
    {allMatches.some((match) => match.needsReview && matches.includes(match)) && <Typography sx={{ mt: 1, color: "#EA580C", fontSize: 12, fontWeight: 700 }}>주황색 셀은 AI 신뢰도가 낮아 확인이 필요합니다.</Typography>}
  </Box>;
}
