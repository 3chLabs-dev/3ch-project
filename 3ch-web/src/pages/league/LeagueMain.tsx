import React from 'react';
import { useDispatch } from 'react-redux';
import { setStep } from '../../features/league/leagueCreationSlice';
// import type { RootState } from '../../app/store'; // 임시 주석
import { Box, Typography, Button } from '@mui/material';

const LeagueMain: React.FC = () => {
  const dispatch = useDispatch();
  const hasExistingLeagues = false;

  const handleCreateNewLeague = () => {
    dispatch(setStep(1));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        리그 메인
      </Typography>
      {hasExistingLeagues ? (
        <Typography>개설된 리그 목록...</Typography>
      ) : (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            개설된 리그가 없습니다
          </Typography>
          <Button variant="contained" color="primary" onClick={handleCreateNewLeague}>
            신규 생성하기
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default LeagueMain;
