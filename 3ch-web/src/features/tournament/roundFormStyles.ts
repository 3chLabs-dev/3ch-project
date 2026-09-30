export const roundStageGridSx = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "1px",
  bgcolor: "#D1D5DB",
  border: "1px solid #D1D5DB",
  borderRadius: 1.5,
  overflow: "hidden",
  "&& .MuiToggleButtonGroup-grouped": {
    margin: 0,
    border: 0,
    borderRadius: 0,
    minWidth: 0,
    bgcolor: "#fff",
    "&.Mui-selected": { bgcolor: "#E5E5E5", "&:hover": { bgcolor: "#E5E5E5" } },
  },
};

export const advancementInputSx = {
  width: 72,
  "& input": { textAlign: "center", MozAppearance: "textfield" },
  "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
};
