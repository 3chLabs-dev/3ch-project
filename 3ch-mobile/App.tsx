import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Provider } from "react-redux";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { useAppDispatch, useAppSelector } from "./src/store/hooks";
import { hydrateAuth } from "./src/store/authSlice";
import { hydrateApp } from "./src/store/appSlice";
import { store } from "./src/store/store";
import { colors } from "./src/theme";

function Bootstrap() {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((state) => state.auth.hydrated);
  const appHydrated = useAppSelector((state) => state.app.hydrated);

  useEffect(() => {
    dispatch(hydrateAuth());
    dispatch(hydrateApp());
  }, [dispatch]);

  if (!hydrated || !appHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Bootstrap />
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
