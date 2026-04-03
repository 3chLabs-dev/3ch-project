import { useCallback, useEffect, useState } from "react";
import {
  useDeletePushSubscriptionMutation,
  useSavePushSubscriptionMutation,
} from "../features/user/userApi";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buf = new ArrayBuffer(rawData.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

export type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed";

export function usePushNotification() {

  const [state, setState] = useState<PushState>(() => {
    if (!("PushManager" in window) || !("serviceWorker" in navigator)) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    return "unsubscribed";
  });
  const [saveSub] = useSavePushSubscriptionMutation();
  const [deleteSub] = useDeletePushSubscriptionMutation();

  // 기존 구독 여부 확인 (비동기)
  useEffect(() => {
    if (state === "unsupported" || state === "denied") return;
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setState("subscribed");
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
