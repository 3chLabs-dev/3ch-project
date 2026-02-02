import * as React from "react";
import PropTypes from "prop-types";
// v6 experimental 테마 확장기와 provider
import {
  experimental_extendTheme,
  Experimental_CssVarsProvider as CssVarsProvider,
} from "@mui/material/styles";

import { inputsCustomizations } from "./customizations/inputs";
import { dataDisplayCustomizations } from "./customizations/dataDisplay";
import { feedbackCustomizations } from "./customizations/feedback";
import { navigationCustomizations } from "./customizations/navigation";
import { surfacesCustomizations } from "./customizations/surfaces";
import { colorSchemes, typography, shadows, shape } from "./themePrimitives";

function AppTheme(props) {
  const { children, disableCustomTheme, themeComponents } = props;

  const theme = React.useMemo(() => {
    if (disableCustomTheme) {
      return {};
    }

    return experimental_extendTheme({
      // CSS 변수 설정
      cssVariables: {
        colorSchemeSelector: "data-mui-color-scheme",
        cssVarPrefix: "template",
      },

      // ✅ 다크모드 강제 무시: light만 남기고 dark 제거
      // (dark 스킴을 아예 없애면 data-mui-color-scheme="dark"가 붙을 수가 없음)
      colorSchemes: {
        light: colorSchemes.light,
      },

      typography,
      shadows,
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

  if (disableCustomTheme) {
    return <>{children}</>;
  }

  return (
    // ThemeProvider → CssVarsProvider
    // ✅ defaultColorScheme은 light로 고정 (전환 자체가 불가능해져서 사실상 의미만 남음)
    <CssVarsProvider theme={theme} defaultColorScheme="light">
      {children}
    </CssVarsProvider>
  );
}

AppTheme.propTypes = {
  children: PropTypes.node,
  /** docs 사이트용 옵션, 무시하셔도 됩니다 */
  disableCustomTheme: PropTypes.bool,
  themeComponents: PropTypes.object,
};

export default AppTheme;
