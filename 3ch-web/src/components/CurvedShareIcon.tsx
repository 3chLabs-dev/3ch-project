import { SvgIcon } from "@mui/material";
import type { SvgIconProps } from "@mui/material";

export default function CurvedShareIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        d="M9.5 5H5.8A2.8 2.8 0 0 0 3 7.8v10.4A2.8 2.8 0 0 0 5.8 21h10.4a2.8 2.8 0 0 0 2.8-2.8V15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 15c1.1-4.5 4.1-7.2 8.5-7.5V4L23 9l-5.5 5v-3.5c-3.3.1-5.9 1.5-8.5 4.5Z" />
    </SvgIcon>
  );
}
