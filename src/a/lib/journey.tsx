/**
 * Journey state for Concept A. Answers live in the URL so reload and Back
 * keep the user where he was; captured images live in session storage.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useResolvedPath, useSearchParams } from "react-router-dom";
import { useReducedMotion } from "motion/react";
import { useLabStore } from "../../shared/store";
import { useMode } from "./mode";
import { stepsFor, useUser, type GateKind } from "./user";
import { FACE_KEY, GATES, ITEM_KEY, JourneyContext, parseAnswers, readSession, withPatch, writeSession, type JourneyContextValue, type OwnedItem, type Patch } from "./journeyContext";

export function JourneyProvider({ children }: { children: ReactNode }) {
  const base = useResolvedPath("").pathname.replace(/\/$/, "");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const store = useLabStore("a");
  const reduced = useReducedMotion() ?? false;
  const { mode, setMode } = useMode();
  const { user, signIn, signOut, grantPlus } = useUser();
  const { pathname } = useLocation();
  const gateActions = useRef<Partial<Record<GateKind, () => void>>>({});

  const [faceImage, setFace] = useState<string | null>(() => readSession<string>(FACE_KEY));
  const [ownedItem, setItem] = useState<OwnedItem | null>(() => readSession<OwnedItem>(ITEM_KEY));

  useEffect(() => writeSession(FACE_KEY, faceImage), [faceImage]);
  useEffect(() => writeSession(ITEM_KEY, ownedItem), [ownedItem]);

  const answers = useMemo(() => parseAnswers(params), [params]);

  const href = useCallback(
    (path: string, patch: Patch = {}) => {
      const search = withPatch(params, patch).toString();
      const pathname = path === "" ? base || "/" : `${base}/${path.replace(/^\//, "")}`;
      return search ? `${pathname}?${search}` : pathname;
    },
    [base, params],
  );

  const go = useCallback(
    (path: string, patch: Patch = {}, options: { replace?: boolean } = {}) => {
      navigate(href(path, patch), { replace: options.replace });
    },
    [navigate, href],
  );

  const begun = Boolean(answers.occasion || answers.done || params.get("fit") || params.get("life"));

  const gateParam = params.get("gate");
  const gate = GATES.find((g) => g === gateParam) ?? null;
  const needsGate = useCallback((kind: GateKind) => stepsFor(kind, user).length > 0, [user]);
  const openGate = useCallback(
    (kind: GateKind) => {
      const next = new URLSearchParams(params);
      next.set("gate", kind);
      navigate(`${pathname}?${next.toString()}`, { replace: true });
    },
    [navigate, params, pathname],
  );
  const closeGate = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("gate");
    const search = next.toString();
    navigate(search ? `${pathname}?${search}` : pathname, { replace: true });
  }, [navigate, params, pathname]);

  const value = useMemo<JourneyContextValue>(
    () => ({
      base,
      answers,
      params,
      href,
      go,
      begun,
      faceImage,
      setFaceImage: setFace,
      ownedItem,
      setOwnedItem: setItem,
      store,
      reduced,
      mode,
      setMode,
      user,
      signIn,
      signOut,
      grantPlus,
      gate,
      needsGate,
      openGate,
      closeGate,
      gateActions,
    }),
    [base, answers, params, href, go, begun, faceImage, ownedItem, store, reduced, mode, setMode, user, signIn, signOut, grantPlus, gate, needsGate, openGate, closeGate],
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

