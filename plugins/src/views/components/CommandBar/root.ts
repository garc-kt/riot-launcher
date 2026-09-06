import { createMemo, createRoot, createSignal, on } from 'solid-js';
import { DEFAULT_ACTIONS } from './data';

const ACTION_LIST = [...DEFAULT_ACTIONS];

export enum VisualState {
  Hidden = 0,
  AnimatingIn,
  Showing,
  AnimatingOut,
}

const root = createRoot(() => {
  const [updated, triggerUpdate] = createSignal(undefined, { equals: false });
  const actions = createMemo(on(updated, () => ACTION_LIST), ACTION_LIST, { equals: false });

  const [search, setSearch] = createSignal('');
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [visualState, setVisualState] = createSignal(VisualState.Hidden);
  const hidden = createMemo(() => visualState() === VisualState.Hidden);

  function addAction(item: Action) {
    if (typeof item !== 'object' || !item.name) {
      console.warn('[CommandBar] Action item should be an object with `name` and `perform` props.')
      return;
    }

    const action = { ...item };

    if (!action.group || typeof action.group !== 'string') {
      action.group = 'uncategorized';
    }

    // Dedupe by id so re-registering (e.g. a plugin reload) replaces the
    // existing entry in place instead of piling up duplicates in the list.
    if (action.id) {
      const existingIndex = ACTION_LIST.findIndex(a => a.id === action.id);
      if (existingIndex >= 0) {
        ACTION_LIST[existingIndex] = action;
        triggerUpdate();
        return;
      }
    }

    ACTION_LIST.push(action);
    triggerUpdate();
  }

  function removeAction(id: string) {
    const index = ACTION_LIST.findIndex(a => a.id === id);
    if (index < 0) return;
    ACTION_LIST.splice(index, 1);
    triggerUpdate();
  }

  function show() {
    setVisualState(VisualState.AnimatingIn);
  }

  function hide() {
    setVisualState((state) =>
      state === VisualState.Hidden ? state : VisualState.AnimatingOut
    );
  }

  function toggle() {
    hidden() ? show() : hide();
  }

  window.CommandBar = {
    addAction,
    removeAction,
    show,
    hide,
    toggle,
    update: () => triggerUpdate(),
  }

  return {
    actions,
    search, setSearch,
    activeIndex, setActiveIndex,
    visualState, setVisualState, hidden,
  }
});

export const useRoot = () => root;
