import React, { useState } from "react";
import { Box, Typography, Button, TextField, List, ListItem, ListItemText, IconButton, Stack } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { setStep, setStep6Schedule } from "../../features/league/leagueCreationSlice";
import type { GameEntry } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

const LeagueStep6Schedule: React.FC = () => {
    const dispatch = useAppDispatch();
    const existingEntries = useAppSelector((s) => s.leagueCreation.step6Schedule?.gameEntries ?? []);

    const [gameEntries, setGameEntries] = useState<GameEntry[]>(existingEntries);
    const [newGameDate, setNewGameDate] = useState("");
    const [newGameTime, setNewGameTime] = useState("");
    const [newGameLocation, setNewGameLocation] = useState("");

    const handleAddGameEntry = () => {
        if (!newGameDate.trim() || !newGameTime.trim()) return;

        const newEntry: GameEntry = {
            date: newGameDate,
            time: newGameTime,
            location: newGameLocation.trim(), // 빈 문자열 허용
        };

        setGameEntries((prev) => [...prev, newEntry]);
        setNewGameDate("");
        setNewGameTime("");
        setNewGameLocation("");
    };

    const handleRemoveGameEntry = (indexToRemove: number) => {
        setGameEntries((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleNext = () => {
        dispatch(setStep6Schedule({ gameEntries }));
        dispatch(setStep(7));
    };

    const handlePrev = () => {
        dispatch(setStep(5));
    };

    return (
        <Box sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
            <Typography variant="h5" fontWeight={900} gutterBottom>
                리그 일정
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                    label="날짜"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={newGameDate}
                    onChange={(e) => setNewGameDate(e.target.value)}
                />
                <TextField
                    label="시간"
                    type="time"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={newGameTime}
                    onChange={(e) => setNewGameTime(e.target.value)}
                />
                <TextField
                    label="장소 (선택)"
                    fullWidth
                    value={newGameLocation}
                    onChange={(e) => setNewGameLocation(e.target.value)}
                />
                <Button
                    variant="contained"
                    onClick={handleAddGameEntry}
                    startIcon={<AddIcon />}
                    disabled={!newGameDate || !newGameTime}
                    sx={{ flexShrink: 0, minWidth: 96 }}
                >
                    추가
                </Button>
            </Stack>

            {gameEntries.length > 0 ? (
                <List sx={{ border: "1px solid #ccc", borderRadius: 1, maxHeight: 250, overflow: "auto" }}>
                    {gameEntries.map((entry, index) => (
                        <ListItem
                            key={`${entry.date}-${entry.time}-${index}`}
                            secondaryAction={
                                <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveGameEntry(index)}>
                                    <DeleteIcon />
                                </IconButton>
                            }
                        >
                            <ListItemText primary={`${entry.date} ${entry.time}`} secondary={entry.location || undefined} />
                        </ListItem>
                    ))}
                </List>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
                    등록된 일정이 없습니다.
                </Typography>
            )}

            <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}>
                <Button variant="outlined" onClick={handlePrev}>
                    이전
                </Button>
                <Button variant="contained" onClick={handleNext}>
                    다음
                </Button>
            </Box>
        </Box>
    );
};

export default LeagueStep6Schedule;
