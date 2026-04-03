import { useCallback, useEffect, useState } from "react";
import {
  useDeletePushSubscriptionMutation,
  useSavePushSubscriptionMutation,
} from "../features/user/userApi";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed";

export function usePushNotification() {

  const [state, setState] = useState<PushState>("unsubscribed");
  const [saveSub] = useSavePushSubscriptionMutation();
  const [deleteSub] = useDeletePushSubscriptionMutation();

  // 초기 상태 확인
  useEffect(() => {
    if (!("PushManager" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? "subscribed" : "unsubscribed");
      })
    );
  }, []);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState("denied");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await saveSub(sub.toJSON() as PushSubscriptionJSON).unwrap();
    setState("subscribed");
  }, [saveSub]);

  const unsubscribe = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await deleteSub({ endpoint: sub.endpoint }).unwrap();
    await sub.unsubscribe();
    setState("unsubscribed");
  }, [deleteSub]);

  return { state, subscribe, unsubscribe };
}
