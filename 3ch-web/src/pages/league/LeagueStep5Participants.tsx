import React, { useState } from "react";
import { Box, Typography, Button, TextField, List, ListItem, ListItemText, IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { setStep, setStep5Participants } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

const LeagueStep5Participants: React.FC = () => {
  const dispatch = useAppDispatch();
  const existingParticipants = useAppSelector((s) => s.leagueCreation.step5Participants?.participants ?? []);

  const [participants, setParticipants] = useState<string[]>(existingParticipants);
  const [newParticipantName, setNewParticipantName] = useState("");

  const handleAddParticipant = () => {
    const name = newParticipantName.trim();
    if (!name) return;
    if (participants.includes(name)) return;

    setParticipants((prev) => [...prev, name]);
    setNewParticipantName("");
  };

  const handleRemoveParticipant = (nameToRemove: string) => {
    setParticipants((prev) => prev.filter((n) => n !== nameToRemove));
  };

  const handleNext = () => {
    dispatch(setStep5Participants({ participants }));
    dispatch(setStep(6));
  };

  const handlePrev = () => {
    dispatch(setStep(4));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 500, mx: "auto" }}>
      <Typography variant="h5" fontWeight={900} gutterBottom>
        리그 참가자
      </Typography>

      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <TextField
          label="참가자 이름"
          variant="outlined"
          fullWidth
          value={newParticipantName}
          onChange={(e) => setNewParticipantName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddParticipant();
          }}
        />
        <Button variant="contained" onClick={handleAddParticipant} sx={{ flexShrink: 0 }}>
          추가하기
        </Button>
      </Box>

      {participants.length > 0 ? (
        <List sx={{ border: "1px solid #ccc", borderRadius: 1, maxHeight: 200, overflow: "auto" }}>
          {participants.map((participant) => (
            <ListItem
              key={participant}
              secondaryAction={
                <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveParticipant(participant)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText primary={participant} />
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
          참가자가 없습니다.
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

export default LeagueStep5Participants;
