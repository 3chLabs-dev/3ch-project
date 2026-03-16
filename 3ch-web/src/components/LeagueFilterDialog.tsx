import { useMemo, useRef, useState } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    IconButton,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

type LeagueStatus = "all" | "scheduled" | "completed" | "cancelled";
type QuickRange = "1w" | "1m" | "3m" | "6m" | "1y" | null;

interface LeagueFilterDialogProps {
    open: boolean;
    onClose: () => void;
    onApply?: (filters: {
        startDate: string;
        endDate: string;
        status: LeagueStatus;
    }) => void;
}

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 0.6,
    bgcolor: "#fff",
    height: 32,
  },
  "& .MuiOutlinedInput-input": {
    py: 0.5,
    fontSize: "0.95rem",
  },
};

const chipButtonSx = (active: boolean) => ({
    minWidth: 0,
    px: 1.6,
    py: 0.6,
    borderRadius: 0.6,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1,

    border: `1px solid ${active ? "#2F80ED" : "#D1D5DB"}`,
    backgroundColor: active ? "#EFF6FF" : "#F9FAFB",
    color: active ? "#1D6FBF" : "#6B7280",

    "&:hover": {
        backgroundColor: active ? "#E6F0FF" : "#F3F4F6",
    },
});

function addMonthsToDate(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
}

function addDaysToDate(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function formatDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export default function LeagueFilterDialog({
    open,
    onClose,
    onApply,
}: LeagueFilterDialogProps) {
    const startDateRef = useRef<HTMLInputElement | null>(null);
    const endDateRef = useRef<HTMLInputElement | null>(null);

    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState<LeagueStatus>("all");
    const [quickRange, setQuickRange] = useState<QuickRange>(null);

    const today = useMemo(() => new Date(), []);

    const handleQuickRange = (range: QuickRange) => {
        setQuickRange(range);

        const end = formatDate(today);
        let start = "";

        switch (range) {
            case "1w":
                start = formatDate(addDaysToDate(today, -7));
                break;
            case "1m":
                start = formatDate(addMonthsToDate(today, -1));
                break;
            case "3m":
                start = formatDate(addMonthsToDate(today, -3));
                break;
            case "6m":
                start = formatDate(addMonthsToDate(today, -6));
                break;
            case "1y":
                start = formatDate(addMonthsToDate(today, -12));
                break;
            default:
                return;
        }

        setStartDate(start);
        setEndDate(end);
    };

    const handleApply = () => {
        onApply?.({
            startDate,
            endDate,
            status,
        });
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            PaperProps={{
                sx: {
                    borderRadius: 0,
                    m: 0,
                    width: "100%",
                    maxWidth: 420,
                },
            }}
        >
            <DialogContent sx={{ px: 3, py: 2.5 }}>
                    <Stack spacing={2.5}>
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                            <Typography fontSize={22} fontWeight={900}>
                                리그 일정 필터
                            </Typography>

                            <IconButton onClick={onClose} sx={{ p: 0.5 }}>
                                <CloseIcon sx={{ fontSize: 24, color: "#111" }} />
                            </IconButton>
                        </Stack>

                        <Box sx={{ borderTop: "1px solid #D9D9D9", pt: 2 }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Typography sx={{ minWidth: 30, fontWeight: 800, fontSize: 14 }}>
                                    기간
                                </Typography>

                                <Box
                                    sx={{ flex: 1, cursor: "pointer" }}
                                    onClick={() => startDateRef.current?.showPicker?.()}
                                >
                                    <TextField
                                        inputRef={startDateRef}
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            setStartDate(e.target.value);
                                            setQuickRange(null);
                                        }}
                                        fullWidth
                                        sx={inputSx}
                                    />
                                </Box>

                                <Typography fontWeight={900}>~</Typography>

                                <Box
                                    sx={{ flex: 1, cursor: "pointer" }}
                                    onClick={() => endDateRef.current?.showPicker?.()}
                                >
                                    <TextField
                                        inputRef={endDateRef}
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => {
                                            setEndDate(e.target.value);
                                            setQuickRange(null);
                                        }}
                                        fullWidth
                                        sx={inputSx}
                                    />
                                </Box>
                            </Stack>

                        <Stack direction="row" spacing={0.8} pl={5.1} mt={1.5} flexWrap="wrap">
                            <Button sx={chipButtonSx(quickRange === "1w")} onClick={() => handleQuickRange("1w")}>
                                일주일
                            </Button>
                            <Button sx={chipButtonSx(quickRange === "1m")} onClick={() => handleQuickRange("1m")}>
                                1개월
                            </Button>
                            <Button sx={chipButtonSx(quickRange === "3m")} onClick={() => handleQuickRange("3m")}>
                                3개월
                            </Button>
                            <Button sx={chipButtonSx(quickRange === "6m")} onClick={() => handleQuickRange("6m")}>
                                6개월
                            </Button>
                            <Button sx={chipButtonSx(quickRange === "1y")} onClick={() => handleQuickRange("1y")}>
                                1년
                            </Button>
                        </Stack>
                    </Box>

                    <Box sx={{ borderTop: "1px solid #D9D9D9", pt: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Typography sx={{ minWidth: 30, fontWeight: 800, fontSize: 14 }}>
                                상태
                            </Typography>

                            <Stack direction="row" spacing={0.8} flexWrap="wrap">
                                <Button
                                    sx={chipButtonSx(status === "all")}
                                    onClick={() => setStatus("all")}
                                >
                                    전체
                                </Button>
                                <Button
                                    sx={chipButtonSx(status === "scheduled")}
                                    onClick={() => setStatus("scheduled")}
                                >
                                    예정
                                </Button>
                                <Button
                                    sx={chipButtonSx(status === "completed")}
                                    onClick={() => setStatus("completed")}
                                >
                                    종료
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                    <Box sx={{ borderTop: "1px solid #D9D9D9", pt: 2 }}></Box>
                    

                    <Box sx={{ pt: 8 }}>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleApply}
                            sx={{
                                borderRadius: 999,
                                py: 1.6,
                                fontWeight: 900,
                                fontSize: 18,
                                boxShadow: "none",
                            }}
                        >
                            완료
                        </Button>
                    </Box>
                </Stack>
            </DialogContent>
        </Dialog>
    );
}