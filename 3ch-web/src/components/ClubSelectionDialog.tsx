import { useEffect, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Radio,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import type { Group } from "../features/group/groupApi";

type Props = {
  open: boolean;
  groups: Group[];
  onClose: () => void;
  onSave: (orderedGroupIds: string[], primaryGroupId: string) => Promise<void>;
  saving: boolean;
};

export default function ClubSelectionDialog({ open, groups, onClose, onSave, saving }: Props) {
  const [orderedGroups, setOrderedGroups] = useState(groups);
  const [primaryGroupId, setPrimaryGroupId] = useState("");
  const [error, setError] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) return;
    setOrderedGroups(groups);
    setPrimaryGroupId(groups.find((group) => group.is_primary)?.id ?? groups[0]?.id ?? "");
    setError("");
  }, [groups, open]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrderedGroups((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const submit = async () => {
    if (!primaryGroupId) return;
    try {
      setError("");
      await onSave(orderedGroups.map((group) => group.id), primaryGroupId);
    } catch (caught: any) {
      setError(caught?.data?.message ?? "클럽 선택 설정을 저장하지 못했습니다.");
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 900, pr: 6 }}>클럽 선택</DialogTitle>
      <IconButton aria-label="닫기" onClick={onClose} disabled={saving} sx={{ position: "absolute", right: 10, top: 10 }}>
        <CloseIcon />
      </IconButton>
      <DialogContent dividers>
        <Typography sx={{ mb: 1.5, fontSize: 13, color: "text.secondary", lineHeight: 1.6 }}>
          클럽을 드래그해 표시 순서를 바꾸고, 기본으로 선택할 대표 클럽을 지정해 주세요.
        </Typography>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedGroups.map((group) => group.id)} strategy={verticalListSortingStrategy}>
            <Stack spacing={1}>
              {orderedGroups.map((group) => (
                <SortableClubRow
                  key={group.id}
                  group={group}
                  selected={primaryGroupId === group.id}
                  onSelect={() => setPrimaryGroupId(group.id)}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
        {error && <Alert severity="warning" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: "text.secondary" }}>취소</Button>
        <Button variant="contained" disableElevation onClick={submit} disabled={saving || !primaryGroupId}>완료</Button>
      </DialogActions>
    </Dialog>
  );
}

function SortableClubRow({ group, selected, onSelect }: { group: Group; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        minHeight: 56,
        px: 1,
        border: "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        borderRadius: 1.5,
        bgcolor: isDragging ? "action.hover" : "background.paper",
        boxShadow: isDragging ? 3 : 0,
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 1 : 0,
      }}
    >
      <IconButton aria-label={`${group.name} 순서 이동`} {...attributes} {...listeners} sx={{ cursor: "grab", touchAction: "none" }}>
        <DragIndicatorIcon sx={{ color: "text.secondary" }} />
      </IconButton>
      <Box onClick={onSelect} sx={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 800 }}>{group.name}</Typography>
        <Typography sx={{ fontSize: 11.5, color: selected ? "primary.main" : "text.secondary", fontWeight: 700 }}>
          {selected ? "대표 클럽" : "대표 클럽으로 선택"}
        </Typography>
      </Box>
      <Radio checked={selected} onChange={onSelect} value={group.id} inputProps={{ "aria-label": `${group.name} 대표 클럽` }} />
    </Box>
  );
}
