import React from "react";
import { useMemo } from "react";
import { Box, InputBase } from "@mui/material";
import { styled } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { useParams } from "react-router-dom";
import { formatLeagueDate } from "../../utils/dateUtils";
import {
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery
} from "../../features/league/leagueApi";

const StyledTableCell = styled(TableCell)(({ }) => ({
  border: '1px solid #ccc',
  padding: '6px',
  textAlign: 'center',
  fontSize: 14,
  width: 65,
}));

const NumberHeaderCell = styled(StyledTableCell)(({ theme }) => ({
  fontWeight: 600,
  backgroundColor: theme.palette.grey[200],
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  height: "500px"
}));

const NumberRowCell = styled(StyledTableCell)(({ theme }) => ({
  fontWeight: 600,
  backgroundColor: theme.palette.grey[200],
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}));

const NameHeaderCell = styled(StyledTableCell)(({ theme }) => ({
  fontWeight: 500,
  backgroundColor: theme.palette.grey[100],
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}));

const BodyHeaderCell = styled(StyledTableCell)(({ theme }) => ({
  fontWeight: 600,
  backgroundColor: theme.palette.grey[100],
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
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
  const [angle, setAngle] = React.useState(135);

  React.useLayoutEffect(() => {
    if (!ref.current) return;

    const { offsetWidth, offsetHeight } = ref.current;
    const rad = Math.atan(offsetHeight / offsetWidth);
    const deg = ((rad * 180) / Math.PI)
    setAngle( 180 - deg );
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
  const { id } = useParams<{ id: string }>();
  const { data: leagueData } = useGetLeagueQuery(id ?? "", {
      skip: !id,
    });
  const { data: participantData } = useGetLeagueParticipantsQuery(
      id ?? "",
      { skip: !id, pollingInterval: 15000 },
  );
  const league = leagueData?.league;
  if(!league) return;
  const date = formatLeagueDate(league.start_date);
  const type = league.type;
  const format = league.format;
  const rules = league.rules;

  const rawParticipants = useMemo(() => participantData?.participants ?? [], [participantData]);

  if (!rawParticipants?.length) return null;

   /* =========================
     🔥 Canvas 설정
  ========================= */

  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const wrapperTableRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  const n = rawParticipants.length;
  const gameOrder = (n * (n - 1)) / 2;

  React.useLayoutEffect(() => {
    function updateScale() {
      if ( !wrapperRef.current || !wrapperTableRef.current ) return;

      const wrapperWidth = wrapperRef.current.clientWidth;
      const wrapperHeight = wrapperRef.current.clientHeight;
      
      const { clientWidth, clientHeight } = wrapperTableRef.current;

      const scaleX = wrapperWidth / clientWidth;
      const scaleY = wrapperHeight / clientHeight;

      setScale(Math.min(scaleX, scaleY));
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  },);

  return (
   <>
   <Box
      ref={wrapperRef}
      sx={{
        width: "396px",
        height: "716px",
        overflow: "hidden",
        position: "relative",
        background: "#fff",
      }}
    >
    {/* 🔥 여기만 회전 */}
    <Box 
      ref={wrapperTableRef}
      sx={{ justifyContent: "center",
            writingMode: "vertical-rl",
            transform: `scale(${scale})`,
            textOrientation: "sideways",
            alignItems: "center",
            transformOrigin: "top left",
            minHeight: '1500px', // 최솟값을 넣어서 표의 일그러짐 및 하단 공간 잡기
    }}>
    {/* ===== 상단 정보 ===== */}
    <Box mb={2} fontWeight={600}>
      {date} / {type} {format} / {rules}
    </Box>
    {/* ===== 테이블 ===== */}
    <TableContainer component={Paper} sx={{ heigth: '1000px', width: '100%'}}>
      <Table>
        {/* ===== 헤더 ===== */}
        <TableHead>
          <TableRow>
            <NumberHeaderCell rowSpan={2}/>
            <NumberHeaderCell rowSpan={2}/>

            {rawParticipants.map((_, idx) => (
              <NumberHeaderCell key={idx}>
                {idx + 1}
              </NumberHeaderCell>
            ))}

            <NumberHeaderCell rowSpan={2}>승/패</NumberHeaderCell>
            <NumberHeaderCell rowSpan={2}>순위</NumberHeaderCell>
            <NumberHeaderCell rowSpan={2}>동점자<br></br>세트 득실</NumberHeaderCell>
          </TableRow>

          <TableRow>
            {rawParticipants.map((p) => (
              <NameHeaderCell key={p.name}>
                {p.division || "-"} {p.name}
              </NameHeaderCell>
            ))}
          </TableRow>
        </TableHead>

        {/* ===== 바디 ===== */}
        <TableBody>
          {rawParticipants.map((rowPlayer, rowIdx) => (
            <TableRow key={rowPlayer.name}>
              <NumberRowCell key={rowIdx}>
                {rowIdx + 1}
              </NumberRowCell>
              <BodyHeaderCell>{rowPlayer.division || "-"} {rowPlayer.name}</BodyHeaderCell>

              {rawParticipants.map((_, colIdx) =>
                rowIdx === colIdx ? (<DiagonalScoreCell key={colIdx}/>) : (<StyledTableCell key={colIdx} data-type="target"><InputBase inputProps={{ style: { textAlign: "center", fontSize: 14, width: 32, height: 28, },}} sx={{ width: 32, height: 28, }}/>
                    </StyledTableCell>
                )
              )}

              <StyledTableCell><InputBase inputProps={{ style: {textAlign: "center", fontSize: 14, width: 32, height: 28,},}} sx={{ width: 32, height: 28,}}/> / <InputBase inputProps={{ style: { textAlign: "center", fontSize: 14, width: 32, height: 28, }, }} sx={{ width: 32, height: 28, }}/></StyledTableCell>
              <StyledTableCell><InputBase inputProps={{ style: {textAlign: "center", fontSize: 14, width: 32, height: 28,},}} sx={{ width: 32, height: 28,}}/></StyledTableCell>
              <StyledTableCell><InputBase inputProps={{ style: {textAlign: "center", fontSize: 14, width: 32, height: 28,},}} sx={{ width: 32, height: 28,}}/></StyledTableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    <br/>
    <TableContainer>
      <Table size="small">
        <TableBody>
          <TableRow>
            <StyledTableCell rowSpan={4}>게임<br/>순서</StyledTableCell>
            {Array.from({ length: gameOrder }).map((_, idx) => (
              <StyledTableCell key={ idx } sx={{ textAlign: "center" }}>{ idx + 1 }</StyledTableCell>
            ))}
          </TableRow>
          <TableRow>
            {Array.from({ length: gameOrder }).map((_, idx) => (
              <StyledTableCell key={ idx } sx={{ textAlign: "center" }}><InputBase inputProps={{ style: {textAlign: "center", fontSize: 14, width: 32, height: 28,},}} sx={{ width: 32, height: 28,}}/></StyledTableCell>
            ))}
          </TableRow>
          <TableRow>
            {Array.from({ length: gameOrder }).map((_, idx) => (
              <StyledTableCell key={ idx } sx={{ textAlign: "center" }}><InputBase inputProps={{ style: {textAlign: "center", fontSize: 14, width: 32, height: 28,},}} sx={{ width: 32, height: 28,}}/></StyledTableCell>
            ))}
          </TableRow>
          <TableRow>
            {Array.from({ length: gameOrder }).map((_, idx) => (
              <StyledTableCell key={ idx } sx={{ textAlign: "center" }}><InputBase inputProps={{ style: {textAlign: "center", fontSize: 14, width: 32, height: 28,},}} sx={{ width: 32, height: 28,}}/></StyledTableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
    </Box>
    </Box>
  </>
  );
}