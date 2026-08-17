import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { LeagueListItem } from "../features/league/leagueApi";
import { getLeagueClubColor } from "../features/league/leagueScheduleColors";

type Props = {
  open: boolean;
  onClose: () => void;
  groups: Array<{ id: string; name: string }>;
  leagues: LeagueListItem[];
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function LeagueCalendarDialog({ open, onClose, groups, leagues }: Props) {
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [visibleGroupIds, setVisibleGroupIds] = useState<string[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const groupIds = useMemo(() => groups.map((group) => group.id), [groups]);
  const activeGroupIds = visibleGroupIds.length > 0 ? visibleGroupIds : groupIds;

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);

  const eventsByDate = useMemo(() => {
    const events = new Map<string, LeagueListItem[]>();
    leagues.forEach((league) => {
      if (!league.group_id || !activeGroupIds.includes(league.group_id)) return;
      const key = league.start_date.slice(0, 10);
      events.set(key, [...(events.get(key) ?? []), league]);
    });
    return events;
  }, [activeGroupIds, leagues]);

  const toggleGroup = (groupId: string) => {
    const current = activeGroupIds;
    const next = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    setVisibleGroupIds(next.length === groupIds.length ? [] : next);
  };

  const moveMonth = (amount: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="lg">
      <DialogTitle sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontWeight={900}>전체 클럽 리그 일정</Typography>
          <IconButton onClick={onClose} aria-label="닫기"><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 1, sm: 2.5 }, pb: 2.5 }}>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
          {groups.map((group) => {
            const color = getLeagueClubColor(group.id, groupIds);
            const selected = activeGroupIds.includes(group.id);
            return (
              <Chip
                key={group.id}
                label={group.name}
                onClick={() => toggleGroup(group.id)}
                variant={selected ? "filled" : "outlined"}
                sx={{
                  fontWeight: 800,
                  bgcolor: selected ? color : "transparent",
                  color: selected ? "#fff" : color,
                  borderColor: color,
                  "&:hover": { bgcolor: selected ? color : `${color}14` },
                }}
              />
            );
          })}
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center">
            <IconButton onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeftIcon /></IconButton>
            <Typography sx={{ minWidth: 105, textAlign: "center", fontWeight: 900 }}>
              {month.getFullYear()}.{String(month.getMonth() + 1).padStart(2, "0")}
            </Typography>
            <IconButton onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRightIcon /></IconButton>
          </Stack>
          <Button size="small" variant="outlined" onClick={() => {
            const now = new Date();
            setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
          }}>오늘</Button>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderTop: "1px solid", borderLeft: "1px solid", borderColor: "divider" }}>
          {WEEKDAYS.map((day, index) => (
            <Box key={day} sx={{ py: 0.75, textAlign: "center", borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography fontSize={12} fontWeight={800} color={index === 0 ? "error.main" : index === 6 ? "primary.main" : "text.secondary"}>{day}</Typography>
            </Box>
          ))}
          {calendarDays.map((date) => {
            const key = toDateKey(date);
            const events = eventsByDate.get(key) ?? [];
            const inMonth = date.getMonth() === month.getMonth();
            const isToday = key === toDateKey(new Date());
            return (
              <Box key={key} sx={{ minHeight: { xs: 82, sm: 118 }, p: { xs: 0.4, sm: 0.75 }, overflow: "hidden", borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", bgcolor: inMonth ? "background.paper" : "action.hover" }}>
                <Typography fontSize={12} fontWeight={isToday ? 900 : 600} color={!inMonth ? "text.disabled" : date.getDay() === 0 ? "error.main" : "text.primary"} sx={isToday ? { display: "inline-flex", width: 22, height: 22, borderRadius: "50%", alignItems: "center", justifyContent: "center", bgcolor: "primary.main", color: "primary.contrastText" } : undefined}>
                  {date.getDate()}
                </Typography>
                <Stack spacing={0.35} sx={{ mt: 0.35 }}>
                  {events.slice(0, fullScreen ? 2 : 3).map((league) => {
                    const color = league.premium_enabled ? "#7C3AED" : getLeagueClubColor(league.group_id, groupIds);
                    return (
                      <Box key={league.id} role="button" tabIndex={0} onClick={() => { onClose(); navigate(`/league/${league.league_code ?? league.id}`); }} onKeyDown={(event) => { if (event.key === "Enter") { onClose(); navigate(`/league/${league.league_code ?? league.id}`); } }} sx={{ px: 0.55, py: 0.3, borderRadius: 0.5, bgcolor: color, color: "#fff", cursor: "pointer", border: league.premium_enabled ? "1px solid #F2C94C" : undefined, boxShadow: league.premium_enabled ? "0 2px 7px rgba(91,33,182,0.28)" : undefined }}>
                        <Typography fontSize={{ xs: 9, sm: 11 }} fontWeight={800} noWrap>{league.premium_enabled ? "👑 " : ""}{league.title ?? league.name}</Typography>
                      </Box>
                    );
                  })}
                  {events.length > (fullScreen ? 2 : 3) && (
                    <Button
                      size="small"
                      onClick={() => setExpandedDate(key)}
                      sx={{ minWidth: 0, p: 0, justifyContent: "flex-start", fontSize: 10, fontWeight: 800 }}
                    >
                      +{events.length - (fullScreen ? 2 : 3)}개 더보기
                    </Button>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>

        {expandedDate && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: "action.hover" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography fontSize={14} fontWeight={900}>{expandedDate} 리그</Typography>
              <Button size="small" onClick={() => setExpandedDate(null)}>접기</Button>
            </Stack>
            <Stack spacing={0.75}>
              {(eventsByDate.get(expandedDate) ?? []).map((league) => {
                const color = league.premium_enabled ? "#8B5CF6" : getLeagueClubColor(league.group_id, groupIds);
                return (
                  <Button
                    key={league.id}
                    fullWidth
                    onClick={() => { onClose(); navigate(`/league/${league.league_code ?? league.id}`); }}
                    sx={{ justifyContent: "flex-start", borderLeft: `4px solid ${color}`, bgcolor: "background.paper", color: "text.primary", fontWeight: 800 }}
                  >
                    {league.group_name ? `${league.group_name} · ` : ""}{league.title ?? league.name}
                  </Button>
                );
              })}
            </Stack>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
