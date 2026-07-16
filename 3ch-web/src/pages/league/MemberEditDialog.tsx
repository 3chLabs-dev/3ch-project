import type { Dispatch, SetStateAction } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type Participant = {
  id: string;
  division?: string | null;
  name: string;
  member_id?: string | number | null;
  source_group_name?: string | null;
};

type EditingParticipants = Record<
  string,
  {
    division: string;
    name: string;
  }
>;

type DeleteParticipantTarget = {
  id: string;
  division: string;
  name: string;
};

type MemberEditDialogProps = {
  open: boolean;
  onClose: () => void;

  participants: Participant[];
  participantsLoading: boolean;

  editingParticipants: EditingParticipants;
  setEditingParticipants: Dispatch<SetStateAction<EditingParticipants>>;

  inputDivision: string;
  setInputDivision: Dispatch<SetStateAction<string>>;

  inputName: string;
  setInputName: Dispatch<SetStateAction<string>>;

  handleAddParticipant: () => void;

  handleParticipantFieldBlur: (
    participantId: string,
    field: "division" | "name",
    originalValue: string
  ) => void;

  setDeleteParticipantTarget: Dispatch<
    SetStateAction<DeleteParticipantTarget | null>
  >;

  onOpenLoadMembers: () => void;
  onReplaceParticipant: (participant: Participant) => void;
  showGroupName?: boolean;
};

export default function MemberEditDialog({
  open,
  onClose,
  participants,
  participantsLoading,
  editingParticipants,
  setEditingParticipants,
  inputDivision,
  setInputDivision,
  inputName,
  setInputName,
  handleAddParticipant,
  handleParticipantFieldBlur,
  setDeleteParticipantTarget,
  onOpenLoadMembers,
  onReplaceParticipant,
  showGroupName = false,
}: MemberEditDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            width: "calc(100%)",
            maxWidth: "calc(430px)",
            m: 1,
            borderRadius: 1,
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 900, fontSize: 17 }}>
        {/* 멤버 수정 */}
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Typography fontWeight={900} fontSize={16} sx={{ flex: 1 }}>
            참가자 수정
          </Typography>

          <Button
            variant="contained"
            disableElevation
            size="small"
            onClick={onOpenLoadMembers}
            sx={{
              borderRadius: 1,
              height: 28,
              px: 1.5,
              fontWeight: 900,
              fontSize: 12,
              bgcolor: "#2F80ED",
              "&:hover": { bgcolor: "#79AEFF" },
            }}
          >
            클럽회원 불러오기
          </Button>
        </Stack>

        <Box
          sx={{
            bgcolor: "#fff",
            borderRadius: 1,
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "58px minmax(0, 1fr) 36px 108px",
              px: 1.5,
              py: 0.8,
              bgcolor: "#F9FAFB",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>
              부수
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>
              이름
            </Typography>
            <Box />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>
              상태
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "58px minmax(0, 1fr) 36px 108px",
              gap: 0.8,
              px: 1.5,
              py: 0.8,
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <TextField
              placeholder="부수"
              value={inputDivision}
              onChange={(e) => setInputDivision(e.target.value)}
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 0.6,
                  height: 30,
                  bgcolor: "#fff",
                },
                "& input": {
                  fontSize: 12,
                  py: 0.3,
                  textAlign: "center",
                },
              }}
            />

            <TextField
              placeholder="이름"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddParticipant();
              }}
              size="small"
              sx={{
                mx: 0.5,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 0.6,
                  height: 30,
                  bgcolor: "#fff",
                },
                "& input": {
                  fontSize: 13,
                  py: 0.3,
                },
              }}
            />

            <Box />

            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
              <Button
                variant="contained"
                disableElevation
                onClick={handleAddParticipant}
                disabled={!inputName.trim()}
                sx={{
                  borderRadius: 0.6,
                  height: 30,
                  px: 1,
                  fontWeight: 900,
                  fontSize: 12,
                  minWidth: 0,
                  width: "100%",
                  bgcolor: "#BDBDBD",
                  "&:hover": { bgcolor: "#BDBDBD" },
                  "&.Mui-disabled": {
                    bgcolor: "#E5E7EB",
                    color: "#fff",
                  },
                }}
              >
                추가
              </Button>
            </Box>
          </Box>

          {participantsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : participants.length === 0 ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <Typography fontSize={13} fontWeight={700} color="text.secondary">
                참가자가 없습니다.
              </Typography>
            </Box>
          ) : (
            participants.map((p, idx) => {
              const isManual = p.member_id == null;
              const editDiv = editingParticipants[p.id]?.division ?? p.division ?? "";
              const editName = editingParticipants[p.id]?.name ?? p.name;

              return (
                <Box
                  key={p.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "58px minmax(0, 1fr) 36px 108px",
                    alignItems: "center",
                    px: 1.5,
                    py: 0.9,
                    borderTop: idx === 0 ? "none" : "1px solid #F3F4F6",
                  }}
                >
                  <TextField
                    value={editDiv}
                    onChange={(e) =>
                      setEditingParticipants((prev) => ({
                        ...prev,
                        [p.id]: {
                          ...(prev[p.id] ?? {
                            division: p.division ?? "",
                            name: p.name,
                          }),
                          division: e.target.value,
                        },
                      }))
                    }
                    onBlur={() =>
                      handleParticipantFieldBlur(p.id, "division", p.division ?? "")
                    }
                    size="small"
                    placeholder="부수"
                    disabled={!isManual}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 0.6,
                        height: 30,
                        bgcolor: "#fff",
                      },
                      "& input": {
                        fontSize: 12,
                        py: 0.3,
                        px: 0.8,
                        textAlign: "center",
                      },
                    }}
                  />

                  <Box sx={{ mx: 0.5, minWidth: 0 }}>
                    <TextField
                      value={editName}
                      onChange={(e) =>
                        setEditingParticipants((prev) => ({
                          ...prev,
                          [p.id]: {
                            ...(prev[p.id] ?? { division: p.division ?? "", name: p.name }),
                            name: e.target.value,
                          },
                        }))
                      }
                      onBlur={() => handleParticipantFieldBlur(p.id, "name", p.name)}
                      size="small"
                      disabled={!isManual}
                      fullWidth
                      sx={{
                        "& .MuiOutlinedInput-root": { borderRadius: 0.6, height: 30, bgcolor: "#fff" },
                        "& input": { fontSize: 13, py: 0.3 },
                      }}
                    />
                    {showGroupName && p.source_group_name && (
                      <Typography sx={{ mt: 0.35, px: 0.4, fontSize: 10, color: "#6B7280", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.source_group_name}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <Box
                      sx={{
                        px: 0.6,
                        py: 0.3,
                        borderRadius: 0.5,
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1,
                        userSelect: "none",
                        ...(isManual
                          ? {
                              bgcolor: "#F3F4F6",
                              color: "#6B7280",
                              border: "1px solid #D1D5DB",
                            }
                          : {
                              bgcolor: "#EFF6FF",
                              color: "#1D6FBF",
                              border: "1px solid #BFDBFE",
                            }),
                      }}
                    >
                      {isManual ? "수동" : "클럽"}
                    </Box>
                  </Box>

                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: "center" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onReplaceParticipant(p)}
                      sx={{ height: 28, minWidth: 0, px: 0.8, fontSize: 11, fontWeight: 700, borderRadius: 0.6 }}
                    >
                      교체
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() =>
                        setDeleteParticipantTarget({
                          id: p.id,
                          division: p.division ?? "",
                          name: p.name,
                        })
                      }
                      sx={{
                        height: 28,
                        minWidth: 0,
                        px: 0.8,
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 0.6,
                      }}
                    >
                      삭제
                    </Button>
                  </Stack>
                </Box>
              );
            })
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          variant="contained"
          disableElevation
          sx={{
            borderRadius: 1,
            px: 3,
            fontWeight: 700,
          }}
        >
          완료
        </Button>
      </DialogActions>
    </Dialog>
  );
}
