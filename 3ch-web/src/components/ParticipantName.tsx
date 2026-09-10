import { Box, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

export function DivisionBadge({ division, sx }: { division?: string | null; sx?: SxProps<Theme> }) {
  const value = String(division ?? "").trim();
  return <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, px: value.length > 1 ? 0.6 : 0.35, borderRadius: 0.8, bgcolor: "#FAAA47", color: "#111827", fontSize: 9, lineHeight: 1, fontWeight: 900, whiteSpace: "nowrap", flexShrink: 0, boxSizing: "border-box", ...sx }}>{value || "-"}</Box>;
}

export function ParticipantName({ name, division, showMissingDivision = false, nameSx, sx }: { name?: string | null; division?: string | null; showMissingDivision?: boolean; nameSx?: SxProps<Theme>; sx?: SxProps<Theme> }) {
  const hasDivision = Boolean(String(division ?? "").trim());
  return <Stack component="span" direction="row" alignItems="center" spacing={0.45} sx={{ minWidth: 0, ...sx }}>
    <Typography component="span" noWrap sx={{ fontWeight: 800, fontSize: 14, minWidth: 0, ...nameSx }}>{name || "?"}</Typography>
    {(hasDivision || showMissingDivision) && <DivisionBadge division={division} />}
  </Stack>;
}
