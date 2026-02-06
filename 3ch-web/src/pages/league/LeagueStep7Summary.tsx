import React from "react";
import { Box, Typography, Button, Paper, List, ListItem, ListItemText, Stack } from "@mui/material";
import { setStep, resetLeagueCreation } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

const LeagueTypeOptions = [
  { value: "singles", label: "단식" },
  { value: "doubles", label: "복식" },
  { value: "2-person-team", label: "2인 단체전" },
  { value: "3-person-team", label: "3인 단체전" },
  { value: "4-person-team", label: "4인 단체전" },
] as const;

const LeagueFormatOptions = [
  { value: "single-league", label: "단일리그" },
  { value: "group-league", label: "조별리그" },
  { value: "group-and-knockout", label: "조별리그 + 본선리그" },
] as const;

const LeagueRulesOptions = [
  { value: "best-of-3", label: "3전 2선승제" },
  { value: "best-of-5", label: "5전 3선승제" },
  { value: "best-of-7", label: "7전 4선승제" },
  { value: "3-sets", label: "3세트제" },
] as const;

const LeagueStep7Summary: React.FC = () => {
  const dispatch = useAppDispatch();
  const leagueData = useAppSelector((s) => s.leagueCreation);

  const { step1BasicInfo, step2Type, step3Format, step4Rules, step5Participants, step6Schedule } = leagueData;

  const handleCreateBracket = () => {
    console.log("Final League Data:", leagueData);
    alert("대진표 생성 요청을 보냈습니다!");

    dispatch(resetLeagueCreation());
    dispatch(setStep(1)); // 메인/초기로 돌리고 싶으면 여기만 조절
  };

  const handlePrev = () => {
    dispatch(setStep(6));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        리그 정보 요약/확정
      </Typography>

      <Stack spacing={2.5}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            기본 정보
          </Typography>
          {step1BasicInfo ? (
            <List dense>
              <ListItem><ListItemText primary="이름" secondary={step1BasicInfo.name} /></ListItem>
              <ListItem><ListItemText primary="설명" secondary={step1BasicInfo.description} /></ListItem>
              <ListItem><ListItemText primary="날짜" secondary={step1BasicInfo.date} /></ListItem>
              <ListItem><ListItemText primary="시간" secondary={step1BasicInfo.time} /></ListItem>
              <ListItem><ListItemText primary="장소" secondary={step1BasicInfo.location} /></ListItem>
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">정보가 없습니다.</Typography>
          )}
        </Paper>

        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            유형 선택
          </Typography>
          {step2Type ? (
            <Typography>
              {LeagueTypeOptions.find((opt) => opt.value === step2Type.selectedType)?.label ?? "정보가 없습니다."}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">정보가 없습니다.</Typography>
          )}
        </Paper>

        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            방식 선택
          </Typography>
          {step3Format ? (
            <Typography>
              {LeagueFormatOptions.find((opt) => opt.value === step3Format.format)?.label ?? "정보가 없습니다."}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">정보가 없습니다.</Typography>
          )}
        </Paper>

        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            규칙
          </Typography>
          {step4Rules ? (
            <Typography>
              {LeagueRulesOptions.find((opt) => opt.value === step4Rules.rule)?.label ?? "정보가 없습니다."}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">정보가 없습니다.</Typography>
          )}
        </Paper>

        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            참가자 목록
          </Typography>
          {step5Participants && step5Participants.participants.length > 0 ? (
            <List dense>
              {step5Participants.participants.map((p) => (
                <ListItem key={p}><ListItemText primary={p} /></ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">참가자가 없습니다.</Typography>
          )}
        </Paper>

        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            리그 일정
          </Typography>
          {step6Schedule && step6Schedule.gameEntries.length > 0 ? (
            <List dense>
              {step6Schedule.gameEntries.map((entry, idx) => (
                <ListItem key={`${entry.date}-${entry.time}-${idx}`}>
                  <ListItemText primary={`${entry.date} ${entry.time}`} secondary={entry.location || undefined} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">등록된 일정이 없습니다.</Typography>
          )}
        </Paper>
      </Stack>

      <Box sx={{ mt: 4, display: "flex", justifyContent: "space-between" }}>
        <Button variant="outlined" onClick={handlePrev}>
          이전
        </Button>
        <Button variant="contained" onClick={handleCreateBracket}>
          대진표 생성하기
        </Button>
      </Box>
    </Box>
  );
};

export default LeagueStep7Summary;
