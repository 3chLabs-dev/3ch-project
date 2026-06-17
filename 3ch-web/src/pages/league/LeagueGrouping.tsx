import { useState, useEffect, useMemo } from 'react';
import { Button, Dialog, Box, Typography, Stack, IconButton, Paper, Divider } from '@mui/material';
import { useNavigate, useParams } from "react-router-dom";
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

// DnD 라이브러리
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors
} from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from '@dnd-kit/core';

import {
  useGetLeagueParticipantsQuery,
  useSaveLeagueGroupingMutation,
  type LeagueParticipantItem,
} from "../../features/league/leagueApi";

const COLOR = {
  primary:     "#2563EB", 
  divBadge:    "#FAAA47", 
  darkCard:    "#1A1D2E", 
  background:  "#FFFFFF", 
  cardBorder:  "#E5E7EB", 
} as const;

function DivBadge({ division }: { division?: string | null }) {
  if (!division) return null;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: { xs: 18, sm: 20 }, height: { xs: 18, sm: 20 }, borderRadius: "50%", bgcolor: COLOR.divBadge, color: "#000", fontSize: 9, fontWeight: 900, lineHeight: 1, flexShrink: 0 }}>
      {division}
    </Box>
  );
}

// ─── 드래그 참가자 ───
function SortableParticipant({ user, index }: { user: LeagueParticipantItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(user.id) });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 99 : "auto" };

  return (
    <Box ref={setNodeRef} style={style} {...attributes} {...listeners}
      sx={{
        display: "flex", alignItems: "center", p: { xs: 0.5, sm: 0.75 }, borderRadius: 1.5,
        bgcolor: isDragging ? "grey.100" : "transparent", cursor: "grab", touchAction: "none", width: "100%", boxSizing: "border-box"
      }}
    >
      <DragIndicatorIcon sx={{ color: "grey.400", fontSize: { xs: 14, sm: 16 }, mr: 0.5, flexShrink: 0 }} />
      <Typography sx={{ display: { xs: 'none', md: 'block' }, color: "#9CA3AF", fontSize: 11, fontWeight: 600, width: 10, flexShrink: 0, mr: 0.5 }}>
        {index + 1}
      </Typography>
      <DivBadge division={user.division} />
      
      {/* 💡 핵심: 0번째(맨 윗줄) 사람에게만 (대표) 글씨를 띄워줍니다. 드래그해서 위치가 바뀌면 (대표) 뱃지도 자동으로 맨 윗사람에게 넘어갑니다! */}
      <Typography variant="body2" fontWeight={index === 0 ? "800" : "600"} color={COLOR.darkCard} noWrap sx={{ flex: 1, minWidth: 0, ml: 0.75, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
        {user.name} {index === 0 && <Typography component="span" sx={{ fontSize: 10, color: COLOR.primary, ml: 0.5 }}>(대표)</Typography>}
      </Typography>
    </Box>
  );
}

// ─── 조(그룹) 카드 ───
function DroppableGroupCard({ group, idx }: { group: LeagueParticipantItem[]; idx: number }) {
  const groupId = `group-${idx}`;
  const { setNodeRef } = useDroppable({ id: groupId });

  return (
    <Paper elevation={0} sx={{ p: { xs: 1, sm: 1.5 }, height: "100%", borderRadius: "12px", border: `1px solid ${COLOR.cardBorder}`, bgcolor: "#FFFFFF", display: "flex", flexDirection: "column" }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6" fontWeight="800" color={COLOR.primary} sx={{ fontSize: '1.1rem' }}>{idx + 1}조</Typography>
        <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ bgcolor: "#F3F4F6", px: 1, py: 0.25, borderRadius: 1, fontSize: '0.7rem' }}>{group.length}명</Typography>
      </Box>
      <Box ref={setNodeRef} flex={1} sx={{ minHeight: 60 }}>
        <SortableContext id={groupId} items={group.map(u => String(u.id))} strategy={verticalListSortingStrategy}>
          <Stack spacing={0}>{group.map((user, i) => <SortableParticipant key={user.id} user={user} index={i} />)}</Stack>
        </SortableContext>
      </Box>
      <Divider sx={{ my: 1, borderColor: COLOR.cardBorder }} />
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary" fontWeight="600">부수합</Typography>
        <Typography fontWeight="800" fontSize={15} color={COLOR.darkCard}>{group.reduce((sum, u) => sum + parseInt(u.division || "99"), 0)}</Typography>
      </Box>
    </Paper>
  );
}

// ─── 메인 컴포넌트 ───
export default function LeagueGrouping() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: participantData } = useGetLeagueParticipantsQuery(id ?? "", { skip: !id, pollingInterval: 15000 });
  const rawParticipants: LeagueParticipantItem[] = useMemo(() => participantData?.participants ?? [], [participantData]);
  const [saveGrouping] = useSaveLeagueGroupingMutation();

  const [step, setStep] = useState<'init' | 'modal' | 'result'>('init');
  const [groupOptions, setGroupOptions] = useState<number[]>([]);
  const [selectedGroupCount, setSelectedGroupCount] = useState<number>(1);
  const [finalGroups, setFinalGroups] = useState<LeagueParticipantItem[][]>([]);

  const calculateGroupOptions = (count: number): number[] => {
    if (count <= 0) return [1];
    const options = new Set<number>();
    if (count === 11) { options.add(4); options.add(3); }
    if (count === 30) { options.add(6); options.add(10); }
    const byFour = Math.floor(count / 4);
    const byFive = Math.floor(count / 5);
    if (byFour > 0) options.add(byFour);
    if (byFive > 0) options.add(byFive);
    return Array.from(options).sort((a, b) => a - b);
  };

  // 💡 핵심 로직: DB 데이터 유무에 따른 모달 패스(Bypass)
  useEffect(() => {
    if (rawParticipants.length === 0 || step !== 'init') return;

    // 조(group_name)가 지정되어 있는 사람들만 걸러냄
    const groupedUsers = rawParticipants.filter(p => p.group_name);
    
    if (groupedUsers.length > 0) {
      const groupMap = new Map<string, LeagueParticipantItem[]>();
      
      groupedUsers.forEach(u => {
        const gName = u.group_name!;
        if (!groupMap.has(gName)) groupMap.set(gName, []);
        groupMap.get(gName)!.push(u);
      });

      const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => parseInt(a) - parseInt(b));
      
      const rebuiltGroups = sortedKeys.map(key => {
        const members = groupMap.get(key)!;
        // DB에서 가져온 is_leader가 true인 사람이 무조건 맨 위(인덱스 0)로 오도록 정렬
        return members.sort((a, b) => (b.is_leader ? 1 : 0) - (a.is_leader ? 1 : 0));
      });

      setTimeout(() => {
        setFinalGroups(rebuiltGroups);
        setSelectedGroupCount(rebuiltGroups.length);
        setStep('result'); 
      }, 0);
    } else {
      // ✅ DB에 저장된 정보가 아예 없다면 기존처럼 팝업(모달) 띄우기
      const count = rawParticipants.length;
      const options = calculateGroupOptions(count);
      setTimeout(() => {
        setGroupOptions(options);
        setSelectedGroupCount(options[options.length - 1] || 1); 
        setStep('modal');
      }, 0);
    }
  
  }, [rawParticipants, step]);

  const runGroupingAlgorithm = (groupCount: number) => {
    const sortedUsers = [...rawParticipants].sort((a, b) => parseInt(a.division || "99") - parseInt(b.division || "99"));
    const newGroups: LeagueParticipantItem[][] = Array.from({ length: groupCount }, () => []);
    sortedUsers.forEach((user, index) => {
      const round = Math.floor(index / groupCount); 
      const remainder = index % groupCount; 
      const groupIndex = round % 2 === 0 ? remainder : (groupCount - 1 - remainder);
      newGroups[groupIndex].push(user);
    });
    setFinalGroups(newGroups);
    setStep('result');
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeContainerIdx = finalGroups.findIndex(g => g.some(u => String(u.id) === activeId));
    let overContainerIdx = finalGroups.findIndex(g => g.some(u => String(u.id) === overId));
    if (overContainerIdx === -1 && overId.startsWith("group-")) overContainerIdx = parseInt(overId.split("-")[1], 10);
    if (activeContainerIdx === -1 || overContainerIdx === -1 || activeContainerIdx === overContainerIdx) return; 

    setFinalGroups((prev) => {
      const activeItems = [...prev[activeContainerIdx]];
      const overItems = [...prev[overContainerIdx]];
      const activeItemIdx = activeItems.findIndex(u => String(u.id) === activeId);
      const overItemIdx = overItems.findIndex(u => String(u.id) === overId);
      const itemToMove = activeItems[activeItemIdx];
      activeItems.splice(activeItemIdx, 1); 
      if (overItemIdx >= 0) overItems.splice(overItemIdx, 0, itemToMove); 
      else overItems.push(itemToMove); 
      const next = [...prev];
      next[activeContainerIdx] = activeItems;
      next[overContainerIdx] = overItems;
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainerIdx = finalGroups.findIndex(g => g.some(u => String(u.id) === activeId));
    let overContainerIdx = finalGroups.findIndex(g => g.some(u => String(u.id) === overId));
    if (overContainerIdx === -1 && overId.startsWith("group-")) overContainerIdx = parseInt(overId.split("-")[1], 10);
    if (activeContainerIdx === -1 || overContainerIdx === -1) return;
    if (activeContainerIdx === overContainerIdx) {
      const items = finalGroups[activeContainerIdx];
      const oldIndex = items.findIndex(u => String(u.id) === activeId);
      const newIndex = items.findIndex(u => String(u.id) === overId);
      if (oldIndex !== newIndex) {
        setFinalGroups((prev) => {
          const next = [...prev];
          next[activeContainerIdx] = arrayMove(items, oldIndex, newIndex);
          return next;
        });
      }
    }
  };

  const handleSaveGrouping = async () => {
    if (finalGroups.length === 0) return;
    const payload = finalGroups.flatMap((group, groupIndex) => 
      group.map((user, userIndex) => ({
        participant_id: user.id,
        group_name: `${groupIndex + 1}조`,
        is_leader: userIndex === 0, // 드래그로 조정한 최종 결과의 0번째가 대표가 됨!
      }))
    );
    try {
      await saveGrouping({ leagueId: id ?? "", groupings: payload }).unwrap();
      alert("조 편성이 성공적으로 갱신되었습니다!");
      navigate(-1); // 저장 후엔 이전 화면으로
    } catch (error) {
      console.error("저장 실패 상세 원인:", error);
      alert("저장에 실패했습니다.");
    }
  };

  const renderGroupSelectionModal = () => (
    <Dialog open={step === 'modal'} disableEscapeKeyDown PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
      <Box p={3} minWidth={300}>
        <Typography variant="h6" fontWeight="800" mb={1} color={COLOR.darkCard}>조 편성 방식 선택</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>총 참가자: <Typography component="span" fontWeight="bold" color="primary.main">{rawParticipants.length}명</Typography></Typography>
        <Typography variant="subtitle2" mb={1} fontWeight="bold" color="text.secondary">추천 조 개수</Typography>
        <Stack direction="row" spacing={1} mb={4} flexWrap="wrap">
          {groupOptions.map((opt) => (
            <Button key={opt} variant={selectedGroupCount === opt ? 'contained' : 'outlined'} onClick={() => setSelectedGroupCount(opt)} size="small" sx={{ minWidth: 60, mb: 1, borderRadius: 2, boxShadow: 'none', fontWeight: 600 }}>{opt}개 조</Button>
          ))}
        </Stack>
        <Typography variant="subtitle2" mb={1} fontWeight="bold" color="text.secondary">직접 설정</Typography>
        <Stack direction="row" spacing={2} alignItems="center" mb={4}>
          <Button variant="outlined" onClick={() => setSelectedGroupCount(p => Math.max(1, p - 1))} disabled={selectedGroupCount <= 1} sx={{ minWidth: 40 }}>-</Button>
          <Typography fontWeight="800" fontSize={20} width={50} textAlign="center" color={COLOR.primary}>{selectedGroupCount}</Typography>
          <Button variant="outlined" onClick={() => setSelectedGroupCount(p => p + 1)} disabled={selectedGroupCount >= rawParticipants.length} sx={{ minWidth: 40 }}>+</Button>
        </Stack>
        <Button fullWidth variant="contained" size="large" onClick={() => runGroupingAlgorithm(selectedGroupCount)} sx={{ bgcolor: COLOR.primary, fontWeight: 700, borderRadius: 2, py: 1.5, boxShadow: 'none' }}>
          {selectedGroupCount}개 조로 편성하기
        </Button>
      </Box>
    </Dialog>
  );

  const renderResult = () => (
    <Box>
      <Box mb={2}>
        <IconButton onClick={() => navigate(-1)} sx={{ ml: -1, mb: 0.5, color: "text.primary" }}><ChevronLeftIcon /></IconButton>
        <Typography variant="h5" fontWeight="800" color={COLOR.darkCard}>조 편성</Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5} fontWeight="500">드래그하여 인원과 대표(첫 번째 자리)를 변경하세요.</Typography>
      </Box>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          {finalGroups.map((group, idx) => <DroppableGroupCard key={idx} group={group} idx={idx} />)}
        </Box>
      </DndContext>

      <Stack direction="row" spacing={1} mt={4} justifyContent="center">
        <Button variant="outlined" color="inherit" startIcon={<SettingsIcon />} onClick={() => setStep('modal')} sx={{ borderRadius: "20px", fontWeight: 700, px: 2, fontSize: '0.8rem' }}>조 개수 재설정</Button>
        <Button variant="contained" color="secondary" onClick={handleSaveGrouping} sx={{ borderRadius: "20px", fontWeight: 700, px: 3, boxShadow: "none", fontSize: '0.8rem' }}>저장하기</Button>
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ width: '100%', bgcolor: COLOR.background, p: 1, pb: 10, boxSizing: "border-box", overflowX: "hidden" }}>
      {step === 'init' && <Typography align="center" mt={10} color="text.secondary" fontWeight="600">데이터 확인 중...</Typography>}
      {step === 'modal' && renderGroupSelectionModal()}
      {step === 'result' && renderResult()}
    </Box>
  );
}