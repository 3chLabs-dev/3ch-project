import React from "react";
import { Box } from "@mui/material";
import { useSelector } from 'react-redux';
import type { RootState } from "../../app/store";
import { styled } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';



const StyledTableCell = styled(TableCell)(({ theme }) => ({
  border: '1px solid #ccc',
  padding: '6px',
  textAlign: 'center',
  fontSize: 14,
}));

const NumberHeaderCell = styled(StyledTableCell)(({ theme }) => ({
  fontWeight: 600,
  backgroundColor: theme.palette.grey[200],
}));

const NumberRowCell = styled(StyledTableCell)(({ theme }) => ({
  fontWeight: 600,
  backgroundColor: theme.palette.grey[200],
}));

const NameHeaderCell = styled(StyledTableCell)(({ theme }) => ({
  fontWeight: 500,
  backgroundColor: theme.palette.grey[100],
}));

const BodyHeaderCell = styled(StyledTableCell)(({ theme }) => ({
  fontWeight: 600,
  backgroundColor: theme.palette.grey[100],
}));
// 대각선 긋는 셀
const DiagonalScoreCellBase = styled(TableCell)(({ theme }) => ({
  position: 'relative',
  padding: 0,
  textAlign: 'center',
  backgroundColor: theme.palette.action.disabledBackground,
}));

function DiagonalScoreCell() {
  const ref = React.useRef<HTMLTableCellElement>(null);
  const [angle, setAngle] = React.useState(45);

  React.useLayoutEffect(() => {
    if (!ref.current) return;

    const { offsetWidth, offsetHeight } = ref.current;
    const rad = Math.atan(offsetHeight / offsetWidth);
    setAngle((rad * 180) / Math.PI);
  }, []);

  return (
    <DiagonalScoreCellBase
      ref={ref}
      sx={(theme) => ({
        backgroundImage: `
          linear-gradient(
            ${angle}deg,
            transparent 49.5%,
            ${theme.palette.divider} 50%,
            ${theme.palette.divider} 50.5%,
            transparent 51%
          )
        `,
      })}
    />
  );
}

export default function LeagueTable() {
  const { step1BasicInfo, step4Rules, step5Participants } = useSelector(
    (state: RootState) => state.leagueCreation
  );

  const participants = step5Participants?.participants;

  if (!participants?.length) return null;

  return (
   <>
    {/* 🔥 여기만 회전 */}
    <Box
      sx={{
        position: "absolute",
        width: "80vh",
        // height: "100vw",
        transform: "rotate(90deg) translateY(-100%)",
        transformOrigin: "top left",
        overflow: "auto",
        // flexDirection: "column",
      }}
    >
    {/* ===== 상단 정보 ===== */}
    <Box mb={2} fontWeight={600}>
      {step1BasicInfo?.date} / 단식 풀리그 / {step4Rules?.rule}
    </Box>
    {/* ===== 테이블 ===== */}
    <TableContainer component={Paper}>
      <Table>
        {/* ===== 헤더 ===== */}
        <TableHead>
          <TableRow>
            <NumberHeaderCell rowSpan={2}/>
            <NumberHeaderCell rowSpan={2}/>

            {participants.map((_, idx) => (
              <NumberHeaderCell key={idx}>
                {idx + 1}
              </NumberHeaderCell>
            ))}

            <NumberHeaderCell rowSpan={2}>승/패</NumberHeaderCell>
            <NumberHeaderCell rowSpan={2}>순위</NumberHeaderCell>
            <NumberHeaderCell rowSpan={2}>동점자<br></br>세트 득실</NumberHeaderCell>
          </TableRow>

          <TableRow>
            {participants.map((p) => (
              <NameHeaderCell key={p.name}>
                {p.division} {p.name}
              </NameHeaderCell>
            ))}
          </TableRow>
        </TableHead>

        {/* ===== 바디 ===== */}
        <TableBody>
          {participants.map((rowPlayer, rowIdx) => (
            <TableRow key={rowPlayer.name}>
              <NumberRowCell key={rowIdx}>
                {rowIdx + 1}
              </NumberRowCell>
              <BodyHeaderCell>{rowPlayer.division} {rowPlayer.name}</BodyHeaderCell>

              {participants.map((_, colIdx) =>
                rowIdx === colIdx ? (
                  <DiagonalScoreCell
                    key={colIdx}
                  />
                ) : (
                  <StyledTableCell key={colIdx}>0</StyledTableCell>
                )
              )}

              <StyledTableCell>0 / 0</StyledTableCell>
              <StyledTableCell>-</StyledTableCell>
              <StyledTableCell></StyledTableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    </Box>
  </>
  );
}