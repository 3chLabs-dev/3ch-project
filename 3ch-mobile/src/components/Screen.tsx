import type { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  maxWidth?: number;
}>;

export function Screen({ children, scroll = true, contentStyle, refreshing = false, onRefresh, maxWidth = 960 }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const layoutStyle = { maxWidth, paddingHorizontal: isTablet ? 24 : 16 } as ViewStyle;
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      <View style={[styles.content, layoutStyle, contentStyle]}>{children}</View>
    </ScrollView>
  ) : (
    <View style={styles.fill}><View style={[styles.content, styles.fill, layoutStyle, contentStyle]}>{children}</View></View>
  );

  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, alignItems: "center" },
  content: { width: "100%", alignSelf: "center", paddingVertical: 16, gap: 16 },
  fill: { flex: 1 },
});
