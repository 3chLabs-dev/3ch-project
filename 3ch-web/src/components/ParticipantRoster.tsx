import { Box } from "@mui/material";
import type { ReactNode } from "react";

export function ParticipantRosterSurface({ children }: { children: ReactNode }) {
  return <Box sx={{ bgcolor: "#fff", borderRadius: 1, border: "1px solid #E5E7EB", overflow: "hidden" }}>{children}</Box>;
}
export function ParticipantRosterHeader({ columns, children }: { columns: string; children: ReactNode }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: columns, alignItems: "center", px: 1.5, py: 0.8, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>{children}</Box>;
}
export function ParticipantRosterRow({ columns, first, isMe = false, children }: { columns: string; first: boolean; isMe?: boolean; children: ReactNode }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: columns, alignItems: "center", px: 1.5, py: 0.9, borderTop: first ? "none" : "1px solid #F3F4F6", bgcolor: isMe ? "#EFF6FF" : "transparent" }}>{children}</Box>;
}
