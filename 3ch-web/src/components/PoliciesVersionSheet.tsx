import { Box, Drawer, Typography, IconButton, Divider, Stack, Chip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export type policiesMeta = {
    versionId: string;
    label: string;
    effectiveDate: string;
    isCurrent?: boolean;
};

type Props = {
    open: boolean;
    onClose: () => void;
    versions: policiesMeta[];
    selectedVersionId: string;
    onSelect: (versionId: string) => void;
    maxWidth?: number;
};

export default function PoliciesVersionSheet({
    open,
    onClose,
    versions,
    selectedVersionId,
    onSelect,
    maxWidth = 420,
}: Props) {
    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            hideBackdrop
            ModalProps={{
                keepMounted: true,
            }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 18,
                    borderTopRightRadius: 18,
                    px: 2,
                    pt: 1.5,
                    pb: 2,

                    width: "100%",
                    maxWidth,
                    mx: "auto",
                },
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 16, fontWeight: 900 }}>
                    약관 버전 선택
                </Typography>
                <IconButton onClick={onClose} sx={{ p: 0.5 }}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={1.2}>
                {versions.map((v) => {
                    const active = v.versionId === selectedVersionId;

                    return (
                        <Box
                            key={v.versionId}
                            onClick={() => {
                                onSelect(v.versionId);
                                onClose();
                            }}
                            sx={{
                                border: "1px solid",
                                borderColor: active ? "text.primary" : "divider",
                                borderRadius: 2,
                                px: 1.5,
                                py: 1.25,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1,
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 900 }}>
                                    {v.label}
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.2 }}>
                                    {v.effectiveDate}
                                </Typography>
                            </Box>

                            {active && (
                                <Chip label="선택" size="small" sx={{ fontWeight: 900, borderRadius: 2 }} />
                            )}
                        </Box>
                    );
                })}
            </Stack>
        </Drawer>
    );
}