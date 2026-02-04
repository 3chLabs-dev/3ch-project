import * as React from 'react';
import { useColorScheme, type PaletteMode } from '@mui/material/styles';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';

type ColorMode = PaletteMode | 'system';

interface ColorModeSelectProps {
  size?: 'small' | 'medium';
  sx?: object;
}

export default function ColorModeSelect(props: ColorModeSelectProps) {
  const { mode, setMode } = useColorScheme();
  if (!mode) {
    return null;
  }

  const handleChange = (event: SelectChangeEvent<ColorMode>) => {
    setMode(event.target.value as ColorMode);
  };

  return (
    <Select
      value={mode}
      onChange={handleChange}
      SelectDisplayProps={{
        'data-screenshot': 'toggle-mode',
      } as React.HTMLAttributes<HTMLDivElement>}
      {...props}
    >
      <MenuItem value="system">System</MenuItem>
      <MenuItem value="light">Light</MenuItem>
      <MenuItem value="dark">Dark</MenuItem>
    </Select>
  );
}
