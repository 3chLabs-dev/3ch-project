import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setStep, setStep1BasicInfo } from '../../features/league/leagueCreationSlice';
import type { RootState } from '../../app/store';
import { Box, Typography, TextField, Button } from '@mui/material';

const LeagueStep1BasicInfo: React.FC = () => {
  const dispatch = useDispatch();
  const existingData = useSelector((state: RootState) => state.leagueCreation.step1BasicInfo);

  const [name, setName] = useState(existingData?.name || '');
  const [description, setDescription] = useState(existingData?.description || '');
  const [date, setDate] = useState(existingData?.date || '');
  const [time, setTime] = useState(existingData?.time || '');
  const [location, setLocation] = useState(existingData?.location || '');

  const handleNext = () => {
    dispatch(setStep1BasicInfo({ name, description, date, time, location }));
    dispatch(setStep(2));
  };

  const handlePrev = () => {
    dispatch(setStep(0));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 500, mx: 'auto' }}>
      <Typography variant="h5" component="h2" gutterBottom>
        리그 생성 - 기본 정보
      </Typography>
      <TextField
        label="리그 이름"
        variant="outlined"
        fullWidth
        margin="normal"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="설명"
        variant="outlined"
        fullWidth
        margin="normal"
        multiline
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <TextField
        label="날짜"
        type="date"
        variant="outlined"
        fullWidth
        margin="normal"
        InputLabelProps={{ shrink: true }}
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <TextField
        label="시간"
        type="time"
        variant="outlined"
        fullWidth
        margin="normal"
        InputLabelProps={{ shrink: true }}
        value={time}
        onChange={(e) => setTime(e.target.value)}
      />
      <TextField
        label="장소"
        variant="outlined"
        fullWidth
        margin="normal"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
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

export default LeagueStep1BasicInfo;
