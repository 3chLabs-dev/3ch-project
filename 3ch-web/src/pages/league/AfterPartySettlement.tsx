import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import LanguageIcon from "@mui/icons-material/Language";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import QRCode from "react-qr-code";
import CurvedShareIcon from "../../components/CurvedShareIcon";
import { DivisionBadge } from "../../components/ParticipantName";
import { useAppSelector } from "../../app/hooks";
import { useGetLeagueParticipantsQuery, useGetLeagueQuery, useUpdateLeagueMutation } from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { createTossTransferLink, isSmartphoneBrowser, parseBankAccount } from "../../utils/paymentDeepLink";

type Person = { id: string; name: string; division?: string; guest?: boolean; attending: boolean; drinking: boolean; excluded: boolean };
type Item = { id: string; name: string; quantity?: number; amount: number; category: "common" | "alcohol" | "nonalcohol" | "specific"; personIds: string[] };
type Contribution = { id: string; name: string; amount: number; personId?: string };
type Calculation = { total: number; contributed: number; distributable: number; shares: Record<string, number> };
type Settlement = { id: string; round_no: number; title: string; status: "draft" | "final"; version: number; participants: Person[]; items: Item[]; contributions: Contribution[]; calculation: Calculation };
type CombinedPerson = { participantId: string; name: string; total: number; rounds: Record<string, number> };
type CombinedSummary = { total: number; people: CombinedPerson[] };
type ListResponse = { settlements: Settlement[]; summary: CombinedSummary; canManage: boolean; payments: Record<string, boolean> };
const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const categories = { common: "음식", alcohol: "술", nonalcohol: "음료" };
const samplePeople = ["참가자 1", "참가자 2", "참가자 3", "참가자 4"].map((name, index) => ({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, name, attending: index < 2, drinking: index < 2, excluded: false }));

function preview(people: Person[], items: Item[], contributions: Contribution[]): Calculation | null {
  const shares = Object.fromEntries(people.map((p) => [p.id, 0]));
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const contributed = contributions.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  if (contributed > total) return null;
  let credit = contributed;
  for (const item of [...items].sort((a, b) => Number(b.category === "common") - Number(a.category === "common"))) {
    const applied = Math.min(credit, Number(item.amount || 0));
    credit -= applied;
    const amount = Number(item.amount || 0) - applied;
    const targets = people.filter((p) => p.attending && !p.excluded && (
      item.category === "common" || (item.category === "alcohol" && p.drinking) ||
      (item.category === "nonalcohol" && !p.drinking) || (item.category === "specific" && item.personIds.includes(p.id))));
    if (amount > 0 && !targets.length) return null;
    targets.forEach((p, index) => { shares[p.id] += Math.floor(amount / targets.length) + (index < amount % targets.length ? 1 : 0); });
  }
  return { total, contributed, distributable: total - contributed, shares };
}

function summarizeRounds(settlements: Settlement[]): CombinedSummary {
  const people = new Map<string, CombinedPerson>();
  for (const settlement of settlements) for (const participant of settlement.participants) {
    const amount = Number(settlement.calculation?.shares?.[participant.id] ?? 0);
    if (!participant.attending && amount === 0) continue;
    const person = people.get(participant.id) ?? { participantId: participant.id, name: participant.name, total: 0, rounds: {} };
    person.name = participant.name;
    person.total += amount;
    person.rounds[String(settlement.round_no)] = amount;
    people.set(participant.id, person);
  }
  const billable = [...people.values()].filter((person) => person.total > 0).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return { total: billable.reduce((sum, person) => sum + person.total, 0), people: billable };
}

function localPreviewRequest(leagueId: string, url: string, method: string, body: unknown) {
  const key = `after-party-preview:${leagueId}`;
  const settlements: Settlement[] = JSON.parse(localStorage.getItem(key) || "[]").map((entry: Settlement, index: number) => ({ ...entry, round_no: entry.round_no ?? index + 1 }));
  const visible = settlements.filter((entry) => !(entry as Settlement & { archived_at?: string }).archived_at);
  const paymentKey = `after-party-preview-payments:${leagueId}`;
  const paymentAmounts: Record<string, number | null> = JSON.parse(localStorage.getItem(paymentKey) || "{}");
  const summary = summarizeRounds(visible);
  const payments = Object.fromEntries(summary.people.map((person) => [person.participantId, paymentAmounts[person.participantId] === person.total]));
  const parts = new URL(url, window.location.origin).pathname.split("/");
  const id = parts[parts.indexOf("after-party") + 1];
  const action = parts[parts.indexOf("after-party") + 2];
  const current = visible.find((entry) => entry.id === id);
  const save = (entry: Settlement) => { localStorage.setItem(key, JSON.stringify(settlements.map((old) => old.id === entry.id ? entry : old))); return { settlement: entry }; };
  if (method === "GET" && !id) return { settlements: visible, summary, canManage: true, payments };
  if (method === "GET" && current) return { settlement: current, canManage: true };
  if (method === "POST" && id === "share") {
    const shareKey = `after-party-preview-share:${leagueId}`;
    const token = localStorage.getItem(shareKey) || crypto.randomUUID();
    localStorage.setItem(shareKey, token);
    return { token, visibility: localStorage.getItem(`after-party-preview-visibility:${leagueId}`) || "public" };
  }
  if (method === "PATCH" && id === "share") {
    const visibility = (body as { visibility: string }).visibility;
    if (visibility !== "public" && visibility !== "club_only") throw new Error("열람 권한을 확인해 주세요.");
    localStorage.setItem(`after-party-preview-visibility:${leagueId}`, visibility);
    return { visibility };
  }
  if (method === "PUT" && id === "payments") {
    const personId = action;
    const person = summary.people.find((entry) => entry.participantId === personId);
    if (!person) throw new Error("청구 대상자를 찾을 수 없습니다.");
    const paid = (body as { paid: boolean }).paid;
    paymentAmounts[personId] = paid ? person.total : null;
    localStorage.setItem(paymentKey, JSON.stringify(paymentAmounts));
    return { participantId: personId, paid, amount: person.total };
  }
  if (method === "POST" && !id) {
    const input = body as Pick<Settlement, "participants" | "items" | "contributions">;
    if (!input.items.length) throw new Error("메뉴를 확인해 주세요.");
    const calculation = preview(input.participants, input.items, input.contributions);
    if (!calculation) throw new Error("정산 금액과 부담 대상을 확인해 주세요.");
    const roundNo = Math.max(0, ...settlements.map((entry) => entry.round_no)) + 1;
    const entry: Settlement = { id: crypto.randomUUID(), round_no: roundNo, title: `${roundNo}차`, status: "draft", version: 2, participants: input.participants, items: input.items, contributions: input.contributions, calculation };
    localStorage.setItem(key, JSON.stringify([...settlements, entry]));
    return { settlement: entry };
  }
  if (!current) throw new Error("미리보기 정산을 찾을 수 없습니다.");
  if (method === "POST" && action === "archive") {
    const confirmation = body as { version: number; confirmationIntent: string };
    if (confirmation.version !== current.version || confirmation.confirmationIntent !== "ARCHIVE_AFTER_PARTY_ROUND") throw new Error("삭제 요청을 확인해 주세요.");
    save({ ...current, archived_at: new Date().toISOString() } as Settlement);
    return { archived: true, round_no: current.round_no };
  }
  if (method === "PUT") {
    const next = body as Pick<Settlement, "title" | "participants" | "items" | "contributions" | "version">;
    if (next.version !== current.version) throw new Error("정산을 새로고침해 주세요.");
    for (const kind of ["participants", "items", "contributions"] as const) {
      if (current[kind].some((old) => !next[kind].some((entry) => entry.id === old.id))) throw new Error("저장된 항목은 삭제 버튼으로 삭제해 주세요.");
    }
    if (next.items.some((entry) => entry.category === "specific" && !current.items.some((old) => old.id === entry.id && old.category === "specific"))) throw new Error("메뉴는 음식·주류·비주류 중 하나로 구분해 주세요.");
    const calculation = preview(next.participants, next.items, next.contributions);
    if (!calculation) throw new Error("찬조금이나 항목의 부담 대상을 확인해 주세요.");
    return save({ ...current, ...next, calculation, version: current.version + 1 });
  }
  if (method === "POST" && action === "remove-entry") {
    const { kind, entryId, version, confirmationIntent } = body as { kind: "items" | "contributions"; entryId: string; version: number; confirmationIntent: string };
    if (version !== current.version || confirmationIntent !== "REMOVE_AFTER_PARTY_ENTRY") throw new Error("삭제 요청을 확인해 주세요.");
    const next = { ...current, [kind]: current[kind].filter((entry) => entry.id !== entryId) };
    const calculation = preview(next.participants, next.items, next.contributions);
    if (!calculation) throw new Error("남은 항목과 찬조금을 확인해 주세요.");
    return save({ ...next, calculation, version: current.version + 1 });
  }
  throw new Error("지원되지 않는 미리보기 요청입니다.");
}

export default function AfterPartySettlement() {
  const { id: leagueId, settlementId } = useParams<{ id: string; settlementId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const roundParam = searchParams.get("round");
  const roundNo = roundParam && /^\d+$/.test(roundParam) ? Number(roundParam) : 0;
  const shareToken = searchParams.get("share");
  const token = useAppSelector((state) => state.auth.token);
  const { data: participantData } = useGetLeagueParticipantsQuery(leagueId ?? "", { skip: !leagueId || !!shareToken });
  const { data: leagueData } = useGetLeagueQuery(leagueId ?? "", { skip: !leagueId || !!shareToken });
  const { data: groupData } = useGetGroupDetailQuery(leagueData?.league.group_id ?? "", { skip: !leagueData?.league.group_id || !!shareToken });
  const [updateLeague] = useUpdateLeagueMutation();
  const [list, setList] = useState<Settlement[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [summary, setSummary] = useState<CombinedSummary>({ total: 0, people: [] });
  const [payments, setPayments] = useState<Record<string, boolean>>({});
  const [canManage, setCanManage] = useState(false);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [guestName, setGuestName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [draftCategory, setDraftCategory] = useState<"common" | "alcohol" | "nonalcohol">("common");
  const [draftName, setDraftName] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [draftAmount, setDraftAmount] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const itemNameRef = useRef<HTMLInputElement>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributorId, setContributorId] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [localPreview, setLocalPreview] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareVisibility, setShareVisibility] = useState<"public" | "club_only">("public");
  const [downloading, setDownloading] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [bankAccount, setBankAccount] = useState("");
  const [savedBankAccount, setSavedBankAccount] = useState("");
  const [savingBankAccount, setSavingBankAccount] = useState(false);
  const [accountAutoSaveFailed, setAccountAutoSaveFailed] = useState(false);
  const [sharedLeagueName, setSharedLeagueName] = useState("");
  const [sharedLeagueDate, setSharedLeagueDate] = useState("");
  const [tossDialogOpen, setTossDialogOpen] = useState(false);
  const [tossPersonId, setTossPersonId] = useState("");
  const base = `${import.meta.env.VITE_API_BASE_URL ?? "/api"}/leagues/${leagueId}/after-party`;
  const listPath = `/league/${leagueId}/after-party`;
  const canEditAccount = canManage && (localPreview || groupData?.myRole === "owner" || (groupData?.myRole === "admin" && groupData.myPermissions?.league === true));

  const request = useCallback(async (url: string, method = "GET", body?: unknown) => {
    if (import.meta.env.DEV && (localPreview || !token)) { setLocalPreview(true); return localPreviewRequest(leagueId!, url, method, body); }
    try {
      const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
      if (import.meta.env.DEV && (response.status >= 500 || !response.headers.get("content-type")?.includes("application/json"))) throw new TypeError("로컬 API에 연결할 수 없습니다.");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "요청에 실패했습니다.");
      return result;
    } catch (cause) {
      if (import.meta.env.DEV && cause instanceof TypeError) {
        setLocalPreview(true);
        return localPreviewRequest(leagueId!, url, method, body);
      }
      throw cause;
    }
  }, [token, localPreview, leagueId]);
  const loadList = useCallback(async () => {
    if (!leagueId || (!shareToken && !token && !import.meta.env.DEV)) return;
    try {
      if (shareToken) {
        if (import.meta.env.DEV && localStorage.getItem(`after-party-preview-share:${leagueId}`) === shareToken) {
          const result = localPreviewRequest(leagueId, base, "GET", undefined) as ListResponse;
          setList(result.settlements); setSummary(result.summary); setPayments(result.payments); setCanManage(false); setLocalPreview(true); setListLoaded(true);
          setShareVisibility((localStorage.getItem(`after-party-preview-visibility:${leagueId}`) as "public" | "club_only") || "public");
          const account = localStorage.getItem(`after-party-preview-bank:${leagueId}`) ?? "";
          setBankAccount(account); setSavedBankAccount(account);
          return;
        }
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/after-party/shared/${shareToken}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const result = await response.json();
        const requestedCode = leagueId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const sharedCode = String(result.league?.league_code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (!response.ok || (result.league?.id !== leagueId && sharedCode !== requestedCode)) throw new Error(result.message || "공유 링크를 열 수 없습니다.");
        setList(result.settlements); setSummary(result.summary); setPayments(result.payments ?? {}); setCanManage(false); setSharedLeagueName(result.league.name); setSharedLeagueDate(result.league.start_date ?? ""); setShareVisibility(result.visibility); setListLoaded(true);
        setBankAccount(result.league.bank_account ?? ""); setSavedBankAccount(result.league.bank_account ?? "");
        return;
      }
      const result: ListResponse = await request(base); setList(result.settlements); setSummary(result.summary); setPayments(result.payments); setCanManage(result.canManage); setListLoaded(true);
    }
    catch (cause) { setError((cause as Error).message); }
  }, [base, leagueId, request, token, shareToken]);
  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => {
    if (!leagueData?.league || localPreview || bankAccount !== savedBankAccount) return;
    const value = leagueData.league.bank_account ?? "";
    setBankAccount(value); setSavedBankAccount(value);
  }, [leagueData?.league, localPreview, bankAccount, savedBankAccount]);
  useEffect(() => {
    if (!localPreview || bankAccount !== savedBankAccount || shareToken) return;
    const value = localStorage.getItem(`after-party-preview-bank:${leagueId}`);
    if (value === null) return;
    setBankAccount(value); setSavedBankAccount(value);
  }, [localPreview, leagueId, bankAccount, savedBankAccount, shareToken]);
  useEffect(() => {
    if (!selected || !participantData?.participants) return;
    setPeople((current) => {
      const known = new Set(current.map((person) => person.id));
      const added = participantData.participants.filter((person) => !person.is_bot && !known.has(person.id))
        .map((person) => ({ id: person.id, name: person.name, division: person.division ?? "", attending: selected.participants.length === 0 && !!person.after, drinking: selected.participants.length === 0 && !!person.after, excluded: false }));
      return added.length ? [...current, ...added] : current;
    });
  }, [selected, participantData?.participants]);

  const open = useCallback((settlement: Settlement) => {
    const existing = new Map(settlement.participants.map((p) => [p.id, p]));
    const roster = (participantData?.participants ?? []).filter((p) => !p.is_bot).map((p) => existing.get(p.id) ?? { id: p.id, name: p.name, division: p.division ?? "", attending: settlement.participants.length === 0 && !!p.after, drinking: settlement.participants.length === 0 && !!p.after, excluded: false });
    const gone = settlement.participants.filter((p) => !roster.some((current) => current.id === p.id));
    setSelected(settlement); setTitle(settlement.title); setPeople([...roster, ...gone]); setItems(settlement.items); setContributions(settlement.contributions); setDirty(false); setError("");
    setDraftCategory("common"); setDraftName(""); setDraftQuantity(1); setDraftAmount(""); setEditingItemId(null);
    setContributorId(""); setContributionAmount("");
    setGuestName("");
  }, [participantData?.participants]);
  const select = useCallback(async (id: string) => {
    try { const result = await request(`${base}/${id}`); open(result.settlement); }
    catch (cause) { setError((cause as Error).message); }
  }, [request, base, open]);
  useEffect(() => {
    if (settlementId) return;
    if (!roundNo) { setSelected(null); return; }
    const routeDraft = (location.state as { afterPartyDraft?: Settlement } | null)?.afterPartyDraft;
    if (routeDraft?.version === 0 && routeDraft.round_no === roundNo) {
      if (selected?.id !== routeDraft.id) open(routeDraft);
      return;
    }
    const entry = list.find((item) => item.round_no === roundNo);
    if (entry && selected?.id !== entry.id) void select(entry.id);
  }, [roundNo, settlementId, list, selected?.id, select, open, location.state]);
  useEffect(() => {
    if (!settlementId) return;
    const entry = list.find((item) => item.id === settlementId);
    if (entry) navigate(`${listPath}?round=${entry.round_no}`, { replace: true });
  }, [settlementId, list, listPath, navigate]);
  const create = () => {
    const nextRound = Math.max(0, ...list.map((entry) => entry.round_no)) + 1;
    const roster = (participantData?.participants ?? []).filter((person) => !person.is_bot).map((person) => ({ id: person.id, name: person.name, division: person.division ?? "", attending: !!person.after, drinking: !!person.after, excluded: false }));
    const guests = new Map<string, Person>();
    list.forEach((entry) => entry.participants.filter((person) => person.guest).forEach((person) => guests.set(person.id, { ...person, attending: false, drinking: false, excluded: false })));
    const draft: Settlement = { id: crypto.randomUUID(), round_no: nextRound, title: `${nextRound}차`, status: "draft", version: 0, participants: [...(roster.length ? roster : localPreview ? samplePeople : []), ...guests.values()], items: [], contributions: [], calculation: { total: 0, contributed: 0, distributable: 0, shares: {} } };
    navigate(`${listPath}?round=${nextRound}`, { state: { afterPartyDraft: draft } });
  };
  const changePerson = (id: string, patch: Partial<Person>) => { setPeople((old) => old.map((p) => p.id === id ? { ...p, ...(patch.attending && !p.attending && patch.drinking === undefined ? { drinking: true } : {}), ...patch } : p)); setDirty(true); };
  const addGuest = () => {
    if (!editable) return;
    const name = guestName.trim();
    if (!name) { setError("게스트 이름을 입력해 주세요."); return; }
    const existing = people.find((person) => person.guest && person.name === name);
    if (existing) changePerson(existing.id, { attending: true });
    else { setPeople((current) => [...current, { id: crypto.randomUUID(), name, guest: true, attending: true, drinking: true, excluded: false }]); setDirty(true); }
    setGuestName(""); setError("");
  };
  const editItem = (item: Item) => {
    if (!editable) return;
    setEditingItemId(item.id);
    setDraftCategory(item.category === "specific" ? "common" : item.category);
    setDraftName(item.name);
    setDraftQuantity(item.quantity ?? 1);
    setDraftAmount(String(item.amount));
    itemNameRef.current?.focus();
  };
  const addItem = () => {
    if (!editable) return;
    const name = draftName.trim();
    const amount = Number(draftAmount);
    if (!name || !Number.isInteger(draftQuantity) || draftQuantity < 1 || draftQuantity > 20 || !Number.isInteger(amount) || amount <= 0 || amount > 1_000_000_000) { setError("메뉴, 수량, 0원보다 큰 품목 합계금액을 입력해 주세요."); return; }
    if (editingItemId) setItems((old) => old.map((item) => item.id === editingItemId ? { ...item, name, quantity: draftQuantity, amount, category: draftCategory, personIds: [] } : item));
    else setItems((old) => [...old, { id: crypto.randomUUID(), name, quantity: draftQuantity, amount, category: draftCategory, personIds: [] }]);
    setDraftName(""); setDraftQuantity(1); setDraftAmount(""); setEditingItemId(null); setDirty(true); setError("");
    itemNameRef.current?.focus();
  };
  const addContribution = () => {
    if (!editable) return;
    const contributor = people.find((person) => person.id === contributorId);
    const amount = Number(contributionAmount);
    if (!contributor || !Number.isInteger(amount) || amount <= 0 || amount > 1_000_000_000) { setError("찬조자를 선택하고 0원보다 큰 금액을 입력해 주세요."); return; }
    setContributions((old) => [...old, { id: crypto.randomUUID(), personId: contributor.id, name: contributor.name, amount }]);
    setContributorId(""); setContributionAmount(""); setDirty(true); setError("");
  };
  const save = async () => {
    if (!selected) return;
    if (draftName.trim() || draftAmount.trim()) { setError("입력 중인 메뉴를 추가 버튼이나 Enter로 먼저 등록해 주세요."); return; }
    if (contributorId || contributionAmount.trim()) { setError("입력 중인 찬조금을 추가 버튼이나 Enter로 먼저 등록해 주세요."); return; }
    if (guestName.trim()) { setError("입력 중인 게스트를 추가 버튼이나 Enter로 먼저 등록해 주세요."); return; }
    if (!items.length) { setError("메뉴를 하나 이상 추가해 주세요."); return; }
    setBusy(true); setError("");
    try {
      const body = { title, participants: people, items, contributions };
      if (selected.version === 0) await request(base, "POST", body);
      else await request(`${base}/${selected.id}`, "PUT", { ...body, version: selected.version });
      await loadList(); navigate(listPath);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (kind: "items" | "contributions", entryId: string, label: string) => {
    if (!selected) return;
    if (kind === "items" && editingItemId === entryId) { setEditingItemId(null); setDraftName(""); setDraftQuantity(1); setDraftAmount(""); }
    const persisted = selected[kind].some((entry) => entry.id === entryId);
    if (!persisted) {
      if (kind === "items") setItems((old) => old.filter((entry) => entry.id !== entryId));
      else setContributions((old) => old.filter((entry) => entry.id !== entryId));
      setDirty(true); return;
    }
    if (dirty) { setError("변경 내용을 먼저 저장한 뒤 항목을 삭제해 주세요."); return; }
    if (!window.confirm(`'${label}' 항목을 삭제하시겠습니까? 저장된 금액과 분담금이 다시 계산됩니다.`)) return;
    setBusy(true);
    try { const result = await request(`${base}/${selected.id}/remove-entry`, "POST", { kind, entryId, version: selected.version, confirmationIntent: "REMOVE_AFTER_PARTY_ENTRY" }); open(result.settlement); await loadList(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const saveBankAccount = useCallback(async () => {
    if (!leagueId || !canEditAccount || shareToken || savingBankAccount || bankAccount === savedBankAccount) return;
    setSavingBankAccount(true);
    try {
      const value = bankAccount.trim();
      if (localPreview) localStorage.setItem(`after-party-preview-bank:${leagueId}`, value);
      else await updateLeague({ id: leagueId, updates: { bank_account: value } }).unwrap();
      setBankAccount(value); setSavedBankAccount(value); setAccountAutoSaveFailed(false);
    } catch { setAccountAutoSaveFailed(true); setError("입금 계좌 저장에 실패했습니다."); }
    finally { setSavingBankAccount(false); }
  }, [leagueId, canEditAccount, shareToken, savingBankAccount, bankAccount, savedBankAccount, localPreview, updateLeague]);
  useEffect(() => {
    if (!canEditAccount || shareToken || bankAccount === savedBankAccount || savingBankAccount || accountAutoSaveFailed) return;
    const timer = window.setTimeout(() => { void saveBankAccount(); }, 4000);
    return () => window.clearTimeout(timer);
  }, [canEditAccount, shareToken, bankAccount, savedBankAccount, savingBankAccount, accountAutoSaveFailed, saveBankAccount]);
  const downloadImage = async () => {
    if (!exportRef.current || downloading) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png"); link.download = `뒤풀이정산_${leagueData?.league.name || sharedLeagueName || "리그"}.png`; link.click();
    } catch { setError("정산 이미지 저장에 실패했습니다."); }
    finally { setDownloading(false); }
  };
  const openShareDialog = async () => {
    try {
      const result = await request(`${base}/share`, "POST");
      const appUrl = String(import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
      setShareLink(`${appUrl}${listPath}?share=${result.token}`); setShareVisibility(result.visibility === "club_only" ? "club_only" : "public"); setShareDialogOpen(true);
    } catch (cause) { setError((cause as Error).message); }
  };
  const copyShareLink = async () => {
    try { await navigator.clipboard.writeText(shareLink); setShareDialogOpen(false); }
    catch { setError("공유 링크 복사에 실패했습니다."); }
  };
  const changeShareVisibility = async (visibility: "public" | "club_only") => {
    try {
      const result = await request(`${base}/share`, "PATCH", { visibility });
      setShareVisibility(result.visibility);
    } catch (cause) { setError((cause as Error).message); }
  };
  const shareKakao = () => {
    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
    if (window.Kakao && kakaoKey && !window.Kakao.isInitialized()) window.Kakao.init(kakaoKey);
    if (window.Kakao?.Share) {
      const origin = new URL(shareLink).origin;
      window.Kakao.Share.sendDefault({ objectType: "feed", content: { title: `${sharedLeagueName || leagueData?.league.name || "리그"} 뒤풀이 정산`, description: "뒤풀이 정산 내역과 입금 계좌를 확인하세요.", imageUrl: `${origin}/og-image.png`, link: { mobileWebUrl: shareLink, webUrl: shareLink } }, buttons: [{ title: "정산 보기", link: { mobileWebUrl: shareLink, webUrl: shareLink } }] });
    } else void copyShareLink();
  };
  const archiveRound = async (entry: Settlement) => {
    if (!window.confirm(`${entry.round_no}차 정산을 목록에서 삭제하시겠습니까?\n메뉴, 참가자, 찬조금, 개인별 정산 결과가 목록과 합계에서 빠집니다. 기록은 복구할 수 있도록 서버에 보존됩니다.`)) return;
    setBusy(true); setError("");
    try {
      await request(`${base}/${entry.id}/archive`, "POST", { version: entry.version, confirmationIntent: "ARCHIVE_AFTER_PARTY_ROUND" });
      await loadList();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const togglePaid = async (person: CombinedPerson) => {
    setBusy(true); setError("");
    try {
      await request(`${base}/payments/${person.participantId}`, "PUT", { paid: !payments[person.participantId] });
      await loadList();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const leagueDate = String(leagueData?.league.start_date || sharedLeagueDate || "").slice(0, 10);
  const tossPerson = summary.people.find((person) => person.participantId === tossPersonId);
  const parsedAccount = parseBankAccount(bankAccount.trim());
  const tossLink = parsedAccount && tossPerson ? createTossTransferLink(parsedAccount.bankName, parsedAccount.accountNumber, tossPerson.total) : null;
  const startTossTransfer = () => {
    if (!tossLink) { setError("송금할 사람과 입금 계좌를 확인해 주세요."); return; }
    let appOpened = false;
    const handleVisibilityChange = () => { if (document.hidden) appOpened = true; };
    document.addEventListener("visibilitychange", handleVisibilityChange, { once: true });
    window.location.href = tossLink;
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (!appOpened && !document.hidden) setError("토스 앱을 실행할 수 없습니다. 계좌번호를 복사해 은행 앱에서 송금해 주세요.");
    }, 1800);
  };
  const calculation = useMemo(() => preview(people, items, contributions), [people, items, contributions]);
  const editable = !!selected && canManage;
  const leagueAfterIds = useMemo(() => {
    const ids = new Set((participantData?.participants ?? []).filter((person) => person.after).map((person) => person.id));
    if (localPreview && !participantData?.participants) samplePeople.slice(0, 2).forEach((person) => ids.add(person.id));
    return ids;
  }, [participantData?.participants, localPreview]);
  const leagueDivisions = useMemo(() => new Map((participantData?.participants ?? []).map((person) => [person.id, person.division])), [participantData?.participants]);
  const guestIds = useMemo(() => new Set(list.flatMap((entry) => entry.participants.filter((person) => person.guest).map((person) => person.id))), [list]);
  const accountCard = <Card sx={{ p: 2, mt: 2 }}>
    <Typography fontWeight={900} mb={1}>정산금 입금 계좌</Typography>
    {canEditAccount && !shareToken ? <TextField fullWidth placeholder="은행명과 계좌번호를 입력해 주세요" value={bankAccount} onChange={(event) => { setBankAccount(event.target.value); setAccountAutoSaveFailed(false); }} /> : <Typography sx={{ p: 1.5, border: "1px solid #E5E7EB", borderRadius: 1, overflowWrap: "anywhere" }}>{bankAccount || "등록된 입금 계좌가 없습니다."}</Typography>}
    <Stack direction="row" spacing={1} mt={1}>
      <Button fullWidth variant="outlined" disabled={!bankAccount.trim()} startIcon={<ContentCopyOutlinedIcon />} onClick={() => { void navigator.clipboard.writeText(bankAccount.trim()).catch(() => setError("계좌번호 복사에 실패했습니다.")); }}>계좌번호 복사</Button>
      <Button fullWidth variant="contained" disabled={!parsedAccount || !summary.people.length} onClick={() => { setTossPersonId(summary.people.length === 1 ? summary.people[0].participantId : ""); setTossDialogOpen(true); }} startIcon={<Box component="img" src="/images/payment/toss-symbol-mono-white.png" alt="" sx={{ width: 22, height: 22, objectFit: "contain" }} />} sx={{ bgcolor: "#0064FF", fontWeight: 800, whiteSpace: "nowrap", "&:hover": { bgcolor: "#0056DB" } }}>토스로 송금</Button>
    </Stack>
    {canEditAccount && !shareToken && bankAccount !== savedBankAccount && <Button fullWidth variant="contained" disabled={savingBankAccount} onClick={() => void saveBankAccount()} sx={{ mt: 1 }}>{savingBankAccount ? "저장 중" : "저장"}</Button>}
  </Card>;

  return <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 2, pb: 10 }}>
    <Stack direction="row" alignItems="center" spacing={1} mb={2}><IconButton onClick={() => navigate(roundNo || settlementId ? listPath : `/league/${leagueId}`)}><ArrowBackIcon /></IconButton><Typography variant="h6" fontWeight={900}>{leagueDate ? `${leagueDate} ` : ""}뒤풀이 정산</Typography></Stack>
    {localPreview && <Alert severity="info" sx={{ mb: 2 }}>로컬 미리보기입니다. 이 브라우저에만 저장되며 실제 리그 정산이나 서버 데이터에는 반영되지 않습니다.</Alert>}
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
    {!roundNo && !settlementId ? <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.5}>
        {canManage ? <Button variant="contained" size="small" disabled={busy} onClick={create} sx={{ borderRadius: 5, whiteSpace: "nowrap", fontWeight: 800 }}>+ 정산 추가</Button> : <Box />}
        <Stack direction="row" spacing={0.5}>
        <IconButton size="small" disabled={downloading || !list.length} onClick={() => void downloadImage()} aria-label="뒤풀이 정산 이미지 다운로드" sx={{ border: "1px solid #D1D5DB", borderRadius: 1 }}><DownloadOutlinedIcon sx={{ fontSize: 18 }} /></IconButton>
        {canManage && <IconButton size="small" disabled={!list.length} onClick={() => void openShareDialog()} aria-label="뒤풀이 정산 공유" sx={{ border: "1px solid #D1D5DB", borderRadius: 1 }}><CurvedShareIcon sx={{ fontSize: 19 }} /></IconButton>}
        </Stack>
      </Stack>
      <Box ref={exportRef} sx={{ bgcolor: "#FFFFFF", p: 1 }}>
      <Stack spacing={1}>{list.map((entry) => <Card key={entry.id} sx={{ p: 2, border: "1px solid #E5E7EB" }}><Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}><Box onClick={() => { if (!shareToken) navigate(`${listPath}?round=${entry.round_no}`); }} sx={{ flex: 1, cursor: shareToken ? "default" : "pointer" }}><Typography fontWeight={800}>{entry.round_no}차</Typography><Typography color="text.secondary" fontSize={13} mt={1}>정산 금액 {money(entry.calculation?.distributable ?? 0)}</Typography></Box>{canManage && <IconButton data-html2canvas-ignore aria-label={`${entry.round_no}차 정산 삭제`} size="small" disabled={busy} onClick={() => void archiveRound(entry)}><DeleteOutlineIcon fontSize="small" /></IconButton>}</Stack></Card>)}</Stack>
      {!list.length && <Typography color="text.secondary">아직 만든 정산이 없습니다.</Typography>}
      <Card sx={{ p: 2, mt: 2, border: "1px solid #BFDBFE", bgcolor: "#F8FAFF" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}><Typography fontWeight={900} fontSize={17}>전체 합산</Typography><Typography fontWeight={900} fontSize={18}>{money(summary.total)}</Typography></Stack>
        <Typography color="text.secondary" fontSize={12} mt={0.5} mb={1}>모든 정산을 합하여 계산된 개인별 정산금입니다.</Typography>
        {summary.people.length ? <Stack spacing={0.75}>{summary.people.map((person) => <Stack key={person.participantId} direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ borderTop: "1px solid #E5E7EB", pt: 1 }}><Box minWidth={0}><Stack direction="row" alignItems="center" spacing={0.5}><Typography fontWeight={800}>{person.name}</Typography>{guestIds.has(person.participantId) && <Chip label="게스트" size="small" sx={{ height: 20, bgcolor: "#E0F2FE", color: "#0369A1", fontWeight: 800 }} />}{canManage && <Button data-html2canvas-ignore size="small" variant={payments[person.participantId] ? "contained" : "outlined"} disabled={busy} onClick={() => void togglePaid(person)} sx={{ minWidth: 42, px: 0.5, py: 0, fontSize: 11 }}>입금</Button>}</Stack><Typography fontSize={12} color="text.secondary">{list.filter((entry) => person.rounds[String(entry.round_no)] != null).map((entry) => `${entry.round_no}차 ${money(person.rounds[String(entry.round_no)])}`).join(" + ")}</Typography></Box><Typography fontWeight={900} whiteSpace="nowrap">{money(person.total)}</Typography></Stack>)}</Stack> : <Typography color="text.secondary" fontSize={13}>청구할 금액이 아직 없습니다.</Typography>}
      </Card>
      {accountCard}
      </Box>
    </Stack> : selected?.round_no === roundNo ? <Stack spacing={2}>
      <Card sx={{ p: 2 }}><Typography fontWeight={900} fontSize={18}>{title}</Typography><Typography fontSize={13} color="text.secondary">뒤풀이 정산</Typography></Card>
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}><Typography fontWeight={900}>메뉴</Typography><Typography fontSize={13} fontWeight={800}>합계 {money(items.reduce((sum, item) => sum + item.amount, 0))}</Typography></Stack>
        {editable && <>
          <Stack direction="row" gap={0.75} mb={1}>{Object.entries(categories).map(([key, label]) => <Button key={key} variant={draftCategory === key ? "contained" : "outlined"} size="small" onClick={() => setDraftCategory(key as typeof draftCategory)} sx={{ minWidth: 64, minHeight: 36, fontWeight: 800 }}>{label}</Button>)}</Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 54px 92px 50px", gap: 0.5 }}>
            <TextField inputRef={itemNameRef} size="small" placeholder="메뉴" value={draftName} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addItem(); } }} inputProps={{ "aria-label": "메뉴" }} />
            <TextField select size="small" value={draftQuantity} onChange={(event) => setDraftQuantity(Number(event.target.value))} inputProps={{ "aria-label": "수량" }} sx={{ "& .MuiSelect-select": { pl: 0.75, pr: "20px !important" }, "& .MuiSelect-icon": { right: 1 } }}>{Array.from({ length: 20 }, (_, index) => <MenuItem key={index + 1} value={index + 1}>{index + 1}</MenuItem>)}</TextField>
            <TextField size="small" type="text" placeholder="금액" value={draftAmount} onChange={(event) => setDraftAmount(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addItem(); } }} inputProps={{ inputMode: "numeric", pattern: "[0-9]*", "aria-label": "품목 합계금액" }} sx={{ "& .MuiInputBase-input": { px: 1 } }} />
            <Button variant="contained" onClick={addItem} sx={{ minWidth: 0, px: 0, fontWeight: 800 }}>{editingItemId ? "수정" : "추가"}</Button>
          </Box>
          {editingItemId && <Button size="small" sx={{ mt: 0.5 }} onClick={() => { setEditingItemId(null); setDraftName(""); setDraftQuantity(1); setDraftAmount(""); setDraftCategory("common"); }}>수정 취소</Button>}
        </>}
        <Stack spacing={0.5} mt={items.length ? 1.5 : 0}>{items.map((item) => <Stack key={item.id} direction="row" alignItems="center" gap={0.75} onClick={() => editItem(item)} sx={{ py: 0.75, borderTop: "1px solid #E5E7EB", cursor: editable ? "pointer" : "default", bgcolor: editingItemId === item.id ? "#EFF6FF" : "transparent" }}>
          <Chip size="small" label={categories[item.category as keyof typeof categories] ?? "기존 항목"} sx={{ fontWeight: 800, minWidth: 54 }} />
          <Typography fontSize={14} fontWeight={700} sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</Typography>
          <Typography fontSize={12} color="text.secondary" whiteSpace="nowrap">{item.quantity ?? 1}개</Typography>
          <Typography fontSize={14} fontWeight={800} whiteSpace="nowrap">{money(item.amount)}</Typography>
          {editable && <Button size="small" color="error" onClick={(event) => { event.stopPropagation(); void remove("items", item.id, item.name); }} sx={{ minWidth: 38, px: 0 }}>삭제</Button>}
        </Stack>)}</Stack>
      </Card>
      <Card sx={{ p: 2 }}>
        <Typography fontWeight={900}>현금 찬조금</Typography>
        <Typography fontSize={12} color="text.secondary" mb={1}>공통 음식부터 차감하며, 남은 금액은 다른 항목에서 차감합니다.</Typography>
        {editable && <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(92px, 120px) 58px", gap: 0.75 }}>
          <TextField select size="small" value={contributorId} onChange={(event) => setContributorId(event.target.value)} inputProps={{ "aria-label": "찬조자" }} SelectProps={{ displayEmpty: true }} sx={{ "& .MuiSelect-select": { minWidth: 0 } }}>
            <MenuItem value="" disabled>찬조자 선택</MenuItem>
            {people.map((person) => <MenuItem key={person.id} value={person.id}>{person.name}{person.division ? ` · ${person.division}부` : ""}{person.guest ? " · 게스트" : ""}</MenuItem>)}
          </TextField>
          <TextField size="small" type="text" placeholder="금액" value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addContribution(); } }} inputProps={{ inputMode: "numeric", pattern: "[0-9]*", "aria-label": "찬조 금액" }} />
          <Button variant="contained" onClick={addContribution} sx={{ minWidth: 0, px: 0, fontWeight: 800 }}>추가</Button>
        </Box>}
        <Stack spacing={0.5} mt={contributions.length ? 1.5 : 0}>{contributions.map((entry) => <Box key={entry.id} sx={{ py: 0.75, borderTop: "1px solid #E5E7EB" }}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Typography fontSize={14} fontWeight={700} sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</Typography>
            <Typography fontSize={14} fontWeight={800} whiteSpace="nowrap">{money(entry.amount)}</Typography>
            {editable && <Button size="small" color="error" disabled={busy} onClick={() => void remove("contributions", entry.id, entry.name)} sx={{ minWidth: 38, px: 0 }}>삭제</Button>}
          </Stack>
          {!entry.personId && editable && <TextField select size="small" fullWidth value="" onChange={(event) => { const person = people.find((candidate) => candidate.id === event.target.value); if (!person) return; setContributions((current) => current.map((candidate) => candidate.id === entry.id ? { ...candidate, personId: person.id, name: person.name } : candidate)); setDirty(true); }} inputProps={{ "aria-label": `${entry.name} 참가자 연결` }} SelectProps={{ displayEmpty: true }} sx={{ mt: 0.5 }}><MenuItem value="" disabled>기존 찬조금의 참가자 연결</MenuItem>{people.map((person) => <MenuItem key={person.id} value={person.id}>{person.name}{person.division ? ` · ${person.division}부` : ""}{person.guest ? " · 게스트" : ""}</MenuItem>)}</TextField>}
          {entry.personId && people.some((person) => person.id === entry.personId) && <FormControlLabel control={<Checkbox size="small" checked={!!people.find((person) => person.id === entry.personId)?.excluded} disabled={!editable} onChange={(event) => changePerson(entry.personId!, { excluded: event.target.checked })} />} label="정산에서 제외" sx={{ mt: 0.25 }} />}
        </Box>)}</Stack>
      </Card>
      <Card sx={{ p: 2 }}>
        <Typography fontWeight={900} mb={0.5}>참가자 · 정산 대상 {people.filter((p) => p.attending).length}명</Typography>
        <Typography fontSize={12} color="text.secondary" mb={1}>참가자 명단에서 뒤풀이 표시를 했으면 자동 선택됩니다.</Typography>
        {editable && <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 58px", gap: 0.75, mb: 1.5 }}>
          <TextField size="small" placeholder="게스트 이름" value={guestName} onChange={(event) => setGuestName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addGuest(); } }} inputProps={{ "aria-label": "게스트 이름" }} />
          <Button variant="contained" onClick={addGuest} sx={{ minWidth: 0, px: 0, fontWeight: 800 }}>추가</Button>
        </Box>}
        <Stack spacing={0.5}>{people.map((person) => <Box key={person.id} sx={{ borderTop: "1px solid #E5E7EB", py: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Stack direction="row" alignItems="center" flexWrap="wrap"><FormControlLabel control={<Checkbox checked={person.attending} disabled={!editable} onChange={(event) => changePerson(person.id, { attending: event.target.checked })} />} label={<Stack direction="row" alignItems="center" spacing={0.75}><Typography fontSize={14} fontWeight={800}>{person.name}</Typography>{(leagueDivisions.has(person.id) || !!person.division) && <DivisionBadge division={leagueDivisions.get(person.id) ?? person.division} sx={{ borderRadius: "50%", width: 18, px: 0 }} />}</Stack>} sx={{ mr: 0.75 }} />{person.guest ? <Chip label="게스트" size="small" sx={{ bgcolor: "#E0F2FE", color: "#0369A1", fontWeight: 800 }} /> : leagueAfterIds.has(person.id) && <Chip label="뒤풀이" size="small" sx={{ bgcolor: "#F3E5F5", color: "#7B1FA2", fontWeight: 800 }} />}</Stack>
            <Typography fontSize={12} fontWeight={800} whiteSpace="nowrap">{money(calculation?.shares[person.id] ?? 0)}</Typography>
          </Stack>
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ pl: 1, mt: 0.5 }}>
            <Button size="small" variant={person.attending && person.drinking ? "contained" : "outlined"} disabled={!editable} onClick={() => changePerson(person.id, { attending: true, drinking: true })} sx={{ minWidth: 72, minHeight: 34, fontWeight: 800 }}>주류</Button>
            <Button size="small" variant={person.attending && !person.drinking ? "contained" : "outlined"} disabled={!editable} onClick={() => changePerson(person.id, { attending: true, drinking: false })} sx={{ minWidth: 72, minHeight: 34, fontWeight: 800 }}>비주류</Button>
            {person.attending && <FormControlLabel control={<Checkbox size="small" checked={person.excluded} disabled={!editable} onChange={(event) => changePerson(person.id, { excluded: event.target.checked })} />} label="정산에서 제외" />}
            {editable && person.guest && !selected?.participants.some((saved) => saved.id === person.id) && <Button size="small" color="error" onClick={() => { if (contributions.some((entry) => entry.personId === person.id) || items.some((item) => item.personIds.includes(person.id))) { setError("게스트와 연결된 찬조금이나 메뉴를 먼저 삭제해 주세요."); return; } setPeople((current) => current.filter((entry) => entry.id !== person.id)); setDirty(true); }}>삭제</Button>}
          </Stack>
        </Box>)}</Stack>
      </Card>
      <Card sx={{ p: 2, bgcolor: "#F8FAFF" }}><Typography fontWeight={900} mb={1}>정산 결과</Typography>{calculation ? <><Typography>결제 금액 {money(calculation.total)} - 찬조금 {money(calculation.contributed)}</Typography><Typography fontWeight={900} my={1}> = 정산 금액 {money(calculation.distributable)}</Typography>{people.filter((p) => p.attending).map((p) => <Stack key={p.id} direction="row" justifyContent="space-between"><Typography>{p.name}{p.excluded ? " (제외)" : ""}</Typography><Typography fontWeight={800}>{money(calculation.shares[p.id] ?? 0)}</Typography></Stack>)}</> : <Alert severity="warning">찬조금이 총비용보다 많거나 부담 대상이 없는 항목이 있습니다.</Alert>}</Card>
      {editable && <Button fullWidth variant="contained" disabled={busy || !calculation || !dirty} onClick={() => void save()}>저장</Button>}
    </Stack> : <Typography color="text.secondary">{error || (listLoaded ? "해당 차수의 정산을 찾을 수 없습니다." : "정산을 불러오는 중...")}</Typography>}
    <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={900}>뒤풀이 정산 공유</DialogTitle>
      <DialogContent>
        <Stack spacing={3} alignItems="center" sx={{ pt: 1 }}>
          <Box width="100%"><Typography fontSize={12} color="text.secondary" fontWeight={700} mb={0.75}>열람 권한</Typography><ToggleButtonGroup value={shareVisibility} exclusive size="small" fullWidth onChange={(_event, value: "public" | "club_only" | null) => { if (value) void changeShareVisibility(value); }} sx={{ "& .MuiToggleButton-root": { fontWeight: 700, fontSize: 13, py: 0.8 } }}><ToggleButton value="club_only" sx={{ gap: 0.5 }}><LockOutlinedIcon sx={{ fontSize: 16 }} />클럽에 가입한 회원만</ToggleButton><ToggleButton value="public" sx={{ gap: 0.5 }}><LanguageIcon sx={{ fontSize: 16 }} />링크가 있는 모든 사람</ToggleButton></ToggleButtonGroup></Box>
          {shareLink && <Box sx={{ p: 2, border: "1px solid #E0E0E0", borderRadius: 1 }}><QRCode value={shareLink} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} /></Box>}
          <Box width="100%"><Typography fontSize={12} color="text.secondary" fontWeight={700} mb={0.75}>공유 링크</Typography><TextField value={shareLink} fullWidth size="small" slotProps={{ input: { readOnly: true } }} /></Box>
          <Stack direction="row" justifyContent="space-around" width="100%">
            <Stack alignItems="center" spacing={0.7}><IconButton onClick={shareKakao} sx={{ width: 56, height: 56, bgcolor: "#FFEB3A", "&:hover": { bgcolor: "#FFEB3A" } }}><Box component="img" src="/kakao-logo.png" alt="카카오톡" sx={{ width: 38, height: 38 }} /></IconButton><Typography fontSize={11} fontWeight={700} color="text.secondary">카카오톡</Typography></Stack>
            <Stack alignItems="center" spacing={0.7}><IconButton onClick={() => { window.location.href = `sms:?body=${encodeURIComponent(`뒤풀이 정산 ${shareLink}`)}`; }} sx={{ width: 56, height: 56, bgcolor: "#4CAF50", color: "#fff", "&:hover": { bgcolor: "#4CAF50" } }}><SmsOutlinedIcon /></IconButton><Typography fontSize={11} fontWeight={700} color="text.secondary">문자</Typography></Stack>
            <Stack alignItems="center" spacing={0.7}><IconButton onClick={() => void copyShareLink()} sx={{ width: 56, height: 56, bgcolor: "#E5E7EB", color: "#374151", "&:hover": { bgcolor: "#E5E7EB" } }}><ContentCopyOutlinedIcon /></IconButton><Typography fontSize={11} fontWeight={700} color="text.secondary">링크 복사</Typography></Stack>
          </Stack>
          {localPreview && <Alert severity="info" sx={{ width: "100%" }}>로컬 미리보기 링크는 이 브라우저에서만 열 수 있습니다.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}><Button variant="contained" onClick={() => setShareDialogOpen(false)} sx={{ fontWeight: 800 }}>닫기</Button></DialogActions>
    </Dialog>
    <Dialog open={tossDialogOpen} onClose={() => setTossDialogOpen(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}>
      <DialogTitle sx={{ fontWeight: 900, textAlign: "center" }}>토스로 송금</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography fontSize={13} color="text.secondary">본인의 이름을 선택하면 합산 정산금으로 송금 화면이 열립니다.</Typography>
          <TextField select fullWidth label="송금할 사람" value={tossPersonId} onChange={(event) => setTossPersonId(event.target.value)}><MenuItem value="" disabled>이름 선택</MenuItem>{summary.people.map((person) => <MenuItem key={person.participantId} value={person.participantId}>{person.name} · {money(person.total)}</MenuItem>)}</TextField>
          {tossPerson && <Typography fontWeight={800} textAlign="center">송금액 {money(tossPerson.total)}</Typography>}
          {tossLink && !isSmartphoneBrowser() && <Box sx={{ display: "grid", placeItems: "center", p: 2, mx: "auto", border: "1px solid #E5E7EB", borderRadius: 2 }}><QRCode value={tossLink} size={196} level="M" /></Box>}
          {tossLink && !isSmartphoneBrowser() && <Typography fontSize={12} color="text.secondary" textAlign="center">휴대폰 카메라로 QR코드를 스캔하면 토스 송금 화면으로 이동합니다.</Typography>}
          {isSmartphoneBrowser() && <Button fullWidth variant="contained" disabled={!tossLink} onClick={startTossTransfer} sx={{ bgcolor: "#0064FF", fontWeight: 800, "&:hover": { bgcolor: "#0056DB" } }}>토스 앱 열기</Button>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setTossDialogOpen(false)}>닫기</Button></DialogActions>
    </Dialog>
  </Box>;
}
