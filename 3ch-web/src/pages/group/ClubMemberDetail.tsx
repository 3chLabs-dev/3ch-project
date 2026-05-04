import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useGetGroupMemberDetailQuery } from "../../features/group/groupApi";
import { getRoleLabel } from "../../utils/permissions";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  const local = at > 0 ? email.slice(0, at) : email;
  return `${local.slice(0, 3)}***`;
}

export default function ClubMemberDetail() {
  const { id: groupId, userId } = useParams<{ id: string; userId: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useGetGroupMemberDetailQuery(
    { groupId: groupId ?? "", userId: Number(userId) },
    { skip: !groupId || !userId },
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">회원 정보를 불러올 수 없습니다.</Typography>
      </Box>
    );
  }

  const { member, stats, clubs } = data;

  return (
    <Stack spacing={2.5} sx={{ pb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900} flex={1}>
          회원 상세
        </Typography>
      </Stack>

      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <CardContent sx={{ py: 2.5, px: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Stack direction="row" alignItems="center">
            <Box flex={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                {member.division && (
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 36,
                      minWidth: 36,
                      px: 0.8,
                      borderRadius: 999,
                      bgcolor: "#FAAA47",
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#000000",
                    }}
                  >
                    {member.division}
                  </Box>
                )}
                <Typography fontWeight={900} fontSize={20}>
                  {member.name}
                </Typography>
                <Typography fontSize={13} color="text.secondary">
                  ({maskEmail(member.email)})
                </Typography>
              </Stack>
            </Box>
            <Chip
              label={getRoleLabel(member.role)}
              size="small"
              sx={{
                bgcolor: member.role === "owner" ? "rgba(255,193,7,0.15)" : member.role === "admin" ? "rgba(33,150,243,0.12)" : "#F3F4F6",
                color: member.role === "owner" ? "#92400E" : member.role === "admin" ? "#1D4ED8" : "#374151",
                fontWeight: 700,
                fontSize: 11,
                flexShrink: 0,
              }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <CardContent sx={{ py: 2.5, px: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Typography fontWeight={900} fontSize={16} sx={{ mb: 1.6 }}>
            {stats.year}년 현황
          </Typography>
          <Stack direction="row" spacing={1}>
            <MetricCard label="리그참석" value={stats.league_attendance} />
            <MetricCard label="대회참석" value={stats.tournament_attendance} />
            <MetricCard label="우승" value={stats.championships} />
            <MetricCard label="승" value={stats.wins} />
            <MetricCard label="패" value={stats.losses} />
          </Stack>
        </CardContent>
      </Card>

      <Card
        elevation={2}
        sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer", "&:hover": { bgcolor: "#F9FAFB" } }}
        onClick={() => navigate(`/club/${groupId}/member/${userId}/leagues`)}
      >
        <CardContent sx={{ py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
          <Stack direction="row" alignItems="center">
            <Typography fontWeight={700} fontSize={15} flex={1}>
              리그·대회 참여내역
            </Typography>
            <ChevronRightIcon sx={{ color: "text.secondary" }} />
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <CardContent sx={{ py: 2.5, px: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ mb: 0.5 }}>
            가입일
          </Typography>
          <Typography fontWeight={700} fontSize={14}>
            {member.joined_at ? member.joined_at.slice(0, 10) : "-"}
          </Typography>
        </CardContent>
      </Card>

      <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <CardContent sx={{ py: 2.5, px: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Typography fontSize={12} color="text.secondary" fontWeight={600} sx={{ mb: 1.5 }}>
            가입한 클럽
          </Typography>
          <Stack divider={<Divider />}>
            {clubs.map((club) => (
              <Stack key={club.id} direction="row" alignItems="center" sx={{ py: 0.75 }}>
                <Typography fontWeight={700} fontSize={14} flex={1}>
                  {club.name}
                </Typography>
                {club.sport && (
                  <Typography fontSize={12} color="text.secondary">
                    {club.sport}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: "#F9FAFB",
        borderRadius: 1,
        px: 1.1,
        py: 1.25,
        textAlign: "center",
      }}
    >
      <Typography fontWeight={900} fontSize={20}>
        {value}
      </Typography>
      <Typography sx={{ mt: 0.25, fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
  );
}
