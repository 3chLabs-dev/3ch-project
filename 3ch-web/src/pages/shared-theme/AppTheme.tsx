import * as React from "react";
import type { ReactNode } from "react";
import { extendTheme, CssVarsProvider } from "@mui/material/styles";

import { inputsCustomizations } from "./customizations/inputs.tsx";
import { dataDisplayCustomizations } from "./customizations/dataDisplay";
import { feedbackCustomizations } from "./customizations/feedback.tsx";
import { navigationCustomizations } from "./customizations/navigation.tsx";
import { surfacesCustomizations } from "./customizations/surfaces.tsx";
import { colorSchemes, typography, shape } from "./themePrimitives";

type AppThemeProps = {
  children: ReactNode;
  disableCustomTheme?: boolean;
  themeComponents?: Record<string, unknown>;
};

export default function AppTheme({
  children,
  disableCustomTheme = false,
  themeComponents = {},
}: AppThemeProps) {
  const theme = React.useMemo(() => {
    if (disableCustomTheme) return null;

    return extendTheme({
      // ❌ cssVariables 제거 (현재 타입 정의에 없음)

      // ✅ 다크모드 강제 무시: light만 남김
      colorSchemes: {
        light: colorSchemes.light,
      },

      typography,
      shape,
      components: {
        ...inputsCustomizations,
        ...dataDisplayCustomizations,
        ...feedbackCustomizations,
        ...navigationCustomizations,
        ...surfacesCustomizations,
        ...themeComponents,
      },
    });
  }, [disableCustomTheme, themeComponents]);

  if (disableCustomTheme || !theme) {
    return <>{children}</>;
  }

  return (
    <CssVarsProvider theme={theme} defaultColorScheme="light">
      {children}
    </CssVarsProvider>
  );
}


