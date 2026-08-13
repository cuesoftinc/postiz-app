'use client';

import { create } from 'zustand';
import dayjs from 'dayjs';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { createRef, RefObject } from 'react';
import { PostComment } from '@gitroom/frontend/components/new-launch/providers/post-comment.enum';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

interface Values {
  id: string;
  content: string;
  delay: number;
  media: { id: string; path: string; thumbnail?: string }[];
}

export interface Internal {
  integration: Integrations;
  integrationValue: Values[];
}

export interface SelectedIntegrations {
  settings: any;
  integration: Integrations;
  ref?: RefObject<any>;
}

interface StoreState {
  editor: undefined | 'none' | 'normal' | 'markdown' | 'html';
  loaded: boolean;
  date: dayjs.Dayjs;
  postComment: PostComment;
  dummy: boolean;
  repeater?: number;
  isCreateSet: boolean;
  totalChars: number;
  activateExitButton: boolean;
  tags: { label: string; value: string }[];
  tab: 0 | 1;
  current: string;
  comments: boolean | 'no-media';
  locked: boolean;
  hide: boolean;
  setLocked: (locked: boolean) => void;
  integrations: Integrations[];
  selectedIntegrations: SelectedIntegrations[];
  global: Values[];
  internal: Internal[];
  addGlobalValue: (index: number, value: Values[]) => void;
  setGlobalDelay: (index: number, minutes: number) => void;
  setInternalDelay: (
    integrationId: string,
    index: number,
    minutes: number
  ) => void;
  addInternalValue: (
    index: number,
    integrationId: string,
    value: Values[]
  ) => void;
  setGlobalValue: (value: Values[]) => void;
  setInternalValue: (integrationId: string, value: Values[]) => void;
  deleteGlobalValue: (index: number) => void;
  deleteInternalValue: (integrationId: string, index: number) => void;
  addRemoveInternal: (integrationId: string) => void;
  changeOrderGlobal: (index: number, direction: 'up' | 'down') => void;
  changeOrderInternal: (
    integrationId: string,
    index: number,
    direction: 'up' | 'down'
  ) => void;
  setGlobalValueText: (index: number, content: string) => void;
  setGlobalValueMedia: (
    index: number,
    media: { id: string; path: string }[]
  ) => void;
  setInternalValueMedia: (
    integrationId: string,
    index: number,
    media: { id: string; path: string }[]
  ) => void;
  addGlobalValueMedia: (
    index: number,
    media: { id: string; path: string }[]
  ) => void;
  removeGlobalValueMedia: (index: number, mediaIndex: number) => void;
  setInternalValueText: (
    integrationId: string,
    index: number,
    content: string
  ) => void;
  addInternalValueMedia: (
    integrationId: string,
    index: number,
    media: { id: string; path: string }[]
  ) => void;
  removeInternalValueMedia: (
    integrationId: string,
    index: number,
    mediaIndex: number
  ) => void;
  setAllIntegrations: (integrations: Integrations[]) => void;
  setCurrent: (current: string) => void;
  addOrRemoveSelectedIntegration: (
    integration: Integrations,
    settings: any
  ) => void;
  reset: () => void;
  setSelectedIntegrations: (
    params: { selectedIntegrations: Integrations; settings: any }[]
  ) => void;
  setTab: (tab: 0 | 1) => void;
  setHide: (hide: boolean) => void;
  setDate: (date: dayjs.Dayjs) => void;
  setRepeater: (repeater: number) => void;
  setTags: (tags: { label: string; value: string }[]) => void;
  setIsCreateSet: (isCreateSet: boolean) => void;
  setTotalChars?: (totalChars: number) => void;
  appendInternalValueMedia: (
    integrationId: string,
    index: number,
    media: { id: string; path: string }[]
  ) => void;
  appendGlobalValueMedia: (
    index: number,
    media: { id: string; path: string }[]
  ) => void;
  setPostComment: (postComment: PostComment) => void;
  setActivateExitButton?: (activateExitButton: boolean) => void;
  setDummy: (dummy: boolean) => void;
  setEditor: (editor: 'none' | 'normal' | 'markdown' | 'html') => void;
  setLoaded?: (loaded: boolean) => void;
  setChars: (id: string, chars: number) => void;
  chars: Record<string, number>;
  setComments: (comments: boolean | 'no-media') => void;
  /** Buffer's footer "Create Another": keep the composer open after a submit
   *  and clear it for the next post. Deliberately NOT part of `initialState`,
   *  so `reset()` (which the composer runs on unmount) leaves it alone and a
   *  user batching posts does not re-tick it on every open. It lives as long as
   *  the page does, which is the "session" the requirement asks for. */
  createAnother: boolean;
  setCreateAnother: (createAnother: boolean) => void;
  /** Bumped by `resetForNextPost` and `applyTemplate`. The composer keys its
   *  editor stack, its provider stack and its tags chip on this, because all
   *  three seed local state ONCE and never re-read the store afterwards:
   *  TipTap takes `content` only at `useEditor` time, each provider's
   *  react-hook-form is uncontrolled while its settings are empty, and the
   *  tags chip copies `initial` into `useState`. Clearing the store alone
   *  would leave every one of them showing the previous post. */
  composerGeneration: number;
  /** The ShowAllProviders imperative handle. Both Templates entry points need
   *  it to save the post as a template, and only the provider handles hold the
   *  LIVE per-network settings (the store copy is just the seed). The header
   *  control could be handed the ref directly; the editor-placeholder
   *  affordance is too deep to thread it through, so it is parked here. */
  providersRef: RefObject<any> | null;
  setProvidersRef: (providersRef: RefObject<any> | null) => void;
  resetForNextPost: (nextDate?: dayjs.Dayjs) => void;
  applyTemplate: (template: any, mode: 'replace' | 'append') => void;
}

/** Turns a saved template's `value[]` into composer values.
 *
 *  Two things here are load-bearing, not cosmetic:
 *
 *  1. `id: makeId(10)` is REGENERATED. The composer sends `value.id` to the
 *     server and `posts.repository` upserts on it
 *     (`where: { id: value.id || uuidv4() }`), so a value id that already
 *     belongs to a Post row makes the next submit UPDATE that row instead of
 *     creating a new post. Carrying ids over from a template would silently
 *     overwrite whatever was published from it the first time.
 *  2. `p.image ?? p.media`: a template's media key depends on who wrote it.
 *     The submit payload names it `image`; the composer's own values name it
 *     `media`. Reading only one of them loses the attachments.
 *
 *  The `<p>`-wrap mirrors how existing posts are rehydrated in
 *  add.edit.modal, so plain-text templates keep their line breaks. */
const templateToValues = (value: any[]): Values[] =>
  (value || []).map((p: any) => ({
    id: makeId(10),
    delay: p?.delay || 0,
    content:
      (p?.content || '').indexOf('<p>') > -1
        ? p.content
        : (p?.content || '')
            .split('\n')
            .map((line: string) => `<p>${line}</p>`)
            .join(''),
    media: p?.image || p?.media || [],
  }));

const initialState = {
  editor: undefined as undefined,
  loaded: true,
  dummy: false,
  comments: true,
  activateExitButton: true,
  date: newDayjs(),
  postComment: PostComment.ALL,
  tags: [] as { label: string; value: string }[],
  totalChars: 0,
  tab: 0 as 0,
  isCreateSet: false,
  current: 'global',
  locked: false,
  hide: false,
  integrations: [] as Integrations[],
  selectedIntegrations: [] as SelectedIntegrations[],
  global: [] as Values[],
  internal: [] as Internal[],
  chars: {},
  composerGeneration: 0,
};

export const useLaunchStore = create<StoreState>()((set) => ({
  ...initialState,
  // outside initialState on purpose. See the interface notes: `reset()`
  // spreads initialState over the current state, so anything declared only
  // here survives a composer close
  createAnother: false,
  providersRef: null,
  setCurrent: (current: string) =>
    set((state) => ({
      current: current,
    })),
  addOrRemoveSelectedIntegration: (
    integration: Integrations,
    settings: any
  ) => {
    set((state) => {
      const existing = state.selectedIntegrations.find(
        (i) => i.integration.id === integration.id
      );

      if (existing) {
        const selectedList = state.selectedIntegrations.filter(
          (s, index) => s.integration.id !== existing.integration.id
        );

        return {
          ...(existing.integration.id === state.current
            ? { current: 'global' }
            : {}),
          loaded: false,
          selectedIntegrations: selectedList,
          ...(selectedList.length === 0
            ? {
                current: 'global',
                editor: 'normal',
              }
            : {}),
        };
      }

      return {
        selectedIntegrations: [
          ...state.selectedIntegrations,
          { integration, settings, ref: createRef() },
        ],
      };
    });
  },
  addGlobalValue: (index: number, value: Values[]) =>
    set((state) => {
      if (!state.global.length) {
        return { global: value };
      }

      return {
        global: state.global.reduce((acc, item, i) => {
          acc.push(item);
          if (i === index) {
            acc.push(...value);
          }
          return acc;
        }, []),
      };
    }),
  // Add value after index, similar to addGlobalValue, but for a speciic integration (index starts from 0)
  addInternalValue: (index: number, integrationId: string, value: Values[]) =>
    set((state) => {
      const integrationIndex = state.internal.findIndex(
        (i) => i.integration.id === integrationId
      );

      if (integrationIndex === -1) {
        return {
          internal: [
            ...state.internal,
            {
              integration: state.selectedIntegrations.find(
                (i) => i.integration.id === integrationId
              )!.integration,
              integrationValue: value,
            },
          ],
        };
      }

      const updatedIntegration = state.internal[integrationIndex];
      const newValues = updatedIntegration.integrationValue.reduce(
        (acc, item, i) => {
          acc.push(item);
          if (i === index) {
            acc.push(...value);
          }
          return acc;
        },
        [] as Values[]
      );

      return {
        internal: state.internal.map((i, idx) =>
          idx === integrationIndex ? { ...i, integrationValue: newValues } : i
        ),
      };
    }),
  deleteGlobalValue: (index: number) =>
    set((state) => {
      // Preserve the IDs at their current positions
      const ids = state.global.map((item) => item.id);

      // Get remaining data (content, delay, media) after filtering out deleted index
      const remainingData = state.global
        .filter((_, i) => i !== index)
        .map(({ id, ...rest }) => rest);

      // Reconstruct with preserved IDs
      return {
        global: remainingData.map((data, i) => ({
          id: ids[i],
          ...data,
        })),
      };
    }),
  deleteInternalValue: (integrationId: string, index: number) =>
    set((state) => {
      return {
        internal: state.internal.map((item) => {
          if (item.integration.id === integrationId) {
            // Preserve the IDs at their current positions
            const ids = item.integrationValue.map((v) => v.id);

            // Get remaining data after filtering out deleted index
            const remainingData = item.integrationValue
              .filter((_, idx) => idx !== index)
              .map(({ id, ...rest }) => rest);

            return {
              ...item,
              integrationValue: remainingData.map((data, i) => ({
                id: ids[i],
                ...data,
              })),
            };
          }
          return item;
        }),
      };
    }),
  addRemoveInternal: (integrationId: string) =>
    set((state) => {
      const integration = state.selectedIntegrations.find(
        (i) => i.integration.id === integrationId
      );
      const findIntegrationIndex = state.internal.findIndex(
        (i) => i.integration.id === integrationId
      );

      if (findIntegrationIndex > -1) {
        return {
          internal: state.internal.filter(
            (i) => i.integration.id !== integrationId
          ),
        };
      }

      return {
        internal: [
          ...state.internal,
          {
            integration: integration.integration,
            integrationValue: state.global.slice(0).map((p) => p),
          },
        ],
      };
    }),
  changeOrderGlobal: (index: number, direction: 'up' | 'down') =>
    set((state) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= state.global.length) {
        return { global: state.global };
      }

      const currentItem = state.global[index];
      const targetItem = state.global[targetIndex];

      return {
        global: state.global.map((item, i) => {
          if (i === index) {
            return {
              id: item.id,
              content: targetItem.content,
              delay: targetItem.delay,
              media: targetItem.media,
            };
          }
          if (i === targetIndex) {
            return {
              id: item.id,
              content: currentItem.content,
              delay: currentItem.delay,
              media: currentItem.media,
            };
          }
          return item;
        }),
      };
    }),
  changeOrderInternal: (
    integrationId: string,
    index: number,
    direction: 'up' | 'down'
  ) =>
    set((state) => {
      return {
        internal: state.internal.map((item) => {
          if (item.integration.id === integrationId) {
            const targetIndex = direction === 'up' ? index - 1 : index + 1;

            if (targetIndex < 0 || targetIndex >= item.integrationValue.length) {
              return item;
            }

            const currentValue = item.integrationValue[index];
            const targetValue = item.integrationValue[targetIndex];

            return {
              ...item,
              integrationValue: item.integrationValue.map((v, i) => {
                if (i === index) {
                  return {
                    id: v.id,
                    content: targetValue.content,
                    delay: targetValue.delay,
                    media: targetValue.media,
                  };
                }
                if (i === targetIndex) {
                  return {
                    id: v.id,
                    content: currentValue.content,
                    delay: currentValue.delay,
                    media: currentValue.media,
                  };
                }
                return v;
              }),
            };
          }

          return item;
        }),
      };
    }),
  setGlobalValueText: (index: number, content: string) =>
    set((state) => ({
      global: state.global.map((item, i) =>
        i === index ? { ...item, content } : item
      ),
    })),
  setInternalValueMedia: (
    integrationId: string,
    index: number,
    media: { id: string; path: string }[]
  ) => {
    return set((state) => ({
      internal: state.internal.map((item) =>
        item.integration.id === integrationId
          ? {
              ...item,
              integrationValue: item.integrationValue.map((v, i) =>
                i === index ? { ...v, media } : v
              ),
            }
          : item
      ),
    }));
  },
  setGlobalValueMedia: (index: number, media: { id: string; path: string }[]) =>
    set((state) => ({
      global: state.global.map((item, i) =>
        i === index ? { ...item, media } : item
      ),
    })),
  addGlobalValueMedia: (index: number, media: { id: string; path: string }[]) =>
    set((state) => ({
      global: state.global.map((item, i) =>
        i === index ? { ...item, media: [...item.media, ...media] } : item
      ),
    })),
  removeGlobalValueMedia: (index: number, mediaIndex: number) =>
    set((state) => ({
      global: state.global.map((item, i) =>
        i === index
          ? {
              ...item,
              media: item.media.filter((_, idx) => idx !== mediaIndex),
            }
          : item
      ),
    })),
  setInternalValueText: (
    integrationId: string,
    index: number,
    content: string
  ) => {
    set((state) => ({
      internal: state.internal.map((item) =>
        item.integration.id === integrationId
          ? {
              ...item,
              integrationValue: item.integrationValue.map((v, i) =>
                i === index ? { ...v, content } : v
              ),
            }
          : item
      ),
    }));
  },
  addInternalValueMedia: (
    integrationId: string,
    index: number,
    media: { id: string; path: string }[]
  ) =>
    set((state) => ({
      internal: state.internal.map((item) =>
        item.integration.id === integrationId
          ? {
              ...item,
              integrationValue: item.integrationValue.map((v, i) =>
                i === index ? { ...v, media: [...v.media, ...media] } : v
              ),
            }
          : item
      ),
    })),
  removeInternalValueMedia: (
    integrationId: string,
    index: number,
    mediaIndex: number
  ) =>
    set((state) => ({
      internal: state.internal.map((item) =>
        item.integration.id === integrationId
          ? {
              ...item,
              integrationValue: item.integrationValue.map((v, i) =>
                i === index
                  ? {
                      ...v,
                      media: v.media.filter((_, idx) => idx !== mediaIndex),
                    }
                  : v
              ),
            }
          : item
      ),
    })),
  reset: () =>
    set((state) => ({
      ...state,
      ...initialState,
    })),
  /** "Create Another": empty the composer for the next post while keeping the
   *  channel selection, because composing again to the same channels is the
   *  entire point of the checkbox.
   *
   *  Everything else is treated as belonging to the post that was just sent.
   *  In particular:
   *
   *  - `global` gets ONE fresh empty value with a NEW id. A reused id would
   *    make the second submit upsert over the first post's row (see
   *    `templateToValues`), which is invisible in the UI and unrecoverable.
   *  - `internal` is dropped: per-network overrides are overrides OF the text
   *    that just went out.
   *  - `settings` is cleared per channel but the channel and its `ref` object
   *    are kept. Keeping the ref matters: `schedule`'s closure holds this
   *    array, and a same-identity ref still resolves to the freshly mounted
   *    provider handle.
   *  - `locked` is cleared because it is set by uppy's `file-added` and only
   *    unset by that same uppy instance's `complete`/`error`. The editor
   *    remount that the generation bump triggers destroys that instance, so a
   *    lock left behind would disable submit for the rest of the session.
   *  - `tags` go: a tag is written onto the post, and silently carrying a
   *    campaign tag onto the next, unrelated post is the same class of leak as
   *    carrying its text.
   *
   *  `repeater` is deliberately untouched: a cadence describes the batch, not
   *  the one post that just left.
   *
   *  `date` MOVES, to `nextDate`. Post two has to leave post one's timestamp or
   *  the two land on the same instant, so the caller resolves Buffer's "Next
   *  Available" (`/posts/find-slot`) and hands the answer in. It is a parameter
   *  rather than something this store fetches because the store is synchronous
   *  by construction, and optional because the lookup is allowed to fail: with
   *  no argument the current date simply stands. Note what is NOT done here —
   *  falling back to `initialState.date`, which is a `newDayjs()` frozen at
   *  MODULE LOAD, i.e. the moment the page opened rather than any moment
   *  relevant to this post. */
  resetForNextPost: (nextDate?: dayjs.Dayjs) =>
    set((state) => ({
      global: [{ id: makeId(10), content: '', delay: 0, media: [] }],
      internal: [],
      selectedIntegrations: state.selectedIntegrations.map((p) =>
        Object.keys(p.settings || {}).length ? { ...p, settings: {} } : p
      ),
      current: 'global',
      tab: 0,
      hide: false,
      locked: false,
      chars: {},
      totalChars: 0,
      postComment: PostComment.ALL,
      comments: true,
      editor: 'normal' as const,
      tags: [],
      // the caller has already parsed and validated it; an absent slot leaves
      // the composer on the date it was submitting from
      ...(nextDate ? { date: nextDate } : {}),
      composerGeneration: state.composerGeneration + 1,
    })),
  /** Applies a saved template (a `Sets` row's parsed `content`) to the OPEN
   *  composer. `replace` swaps the post; `append` adds the template's items to
   *  the end of the current thread.
   *
   *  Content always lands on the global stack and the view switches to it: the
   *  template describes a whole post, so writing it into whichever channel tab
   *  happened to be open would hide most of it.
   *
   *  Channels named by the template are ADDED rather than toggled:
   *  `addOrRemoveSelectedIntegration` would remove an already-selected channel,
   *  which is the opposite of what applying a template means. Their per-network
   *  settings come along, since a template whose Reddit subreddit or YouTube
   *  title is dropped is only half applied.
   *
   *  Bumping the generation is part of the contract, not the caller's job: both
   *  entry points would otherwise have to remember it, and forgetting it looks
   *  exactly like "the picker does nothing". */
  applyTemplate: (template: any, mode: 'replace' | 'append') =>
    set((state) => {
      const posts: any[] = template?.posts || [];
      const values = templateToValues(posts?.[0]?.value || []);

      if (!values.length) {
        return {};
      }

      const selectedIntegrations = [...state.selectedIntegrations];

      for (const post of posts) {
        const integration = state.integrations.find(
          (i) => i.id === post?.integration?.id
        );

        // a channel the template names but this org no longer has connected
        if (!integration) {
          continue;
        }

        const settings = post?.settings || {};
        const existing = selectedIntegrations.findIndex(
          (s) => s.integration.id === integration.id
        );

        if (existing === -1) {
          selectedIntegrations.push({
            integration,
            settings,
            ref: createRef(),
          });
          continue;
        }

        if (Object.keys(settings).length) {
          selectedIntegrations[existing] = {
            ...selectedIntegrations[existing],
            settings,
          };
        }
      }

      return {
        global: mode === 'replace' ? values : [...state.global, ...values],
        // overrides of the replaced text no longer describe anything
        ...(mode === 'replace'
          ? { internal: [], tags: template?.tags || [] }
          : {}),
        selectedIntegrations,
        current: 'global',
        tab: 0,
        hide: false,
        editor: 'normal' as const,
        composerGeneration: state.composerGeneration + 1,
      };
    }),
  setCreateAnother: (createAnother: boolean) =>
    set(() => ({
      createAnother,
    })),
  setProvidersRef: (providersRef: RefObject<any> | null) =>
    set(() => ({
      providersRef,
    })),
  setAllIntegrations: (integrations: Integrations[]) =>
    set((state) => ({
      integrations: integrations,
    })),
  setTab: (tab: 0 | 1) =>
    set((state) => ({
      tab: tab,
    })),
  setLocked: (locked: boolean) =>
    set((state) => ({
      locked: locked,
    })),
  setHide: (hide: boolean) =>
    set((state) => ({
      hide: hide,
    })),
  setDate: (date: dayjs.Dayjs) =>
    set((state) => ({
      date,
    })),
  setRepeater: (repeater: number) =>
    set((state) => ({
      repeater,
    })),
  setTags: (tags: { label: string; value: string }[]) =>
    set((state) => ({
      tags,
    })),
  setIsCreateSet: (isCreateSet: boolean) =>
    set((state) => ({
      isCreateSet,
    })),
  setSelectedIntegrations: (
    params: { selectedIntegrations: Integrations; settings: any }[]
  ) =>
    set((state) => ({
      selectedIntegrations: params.map((p) => ({
        integration: p.selectedIntegrations,
        settings: p.settings,
        ref: createRef(),
      })),
    })),
  setGlobalValue: (value: Values[]) =>
    set((state) => ({
      global: value,
    })),
  setInternalValue: (integrationId: string, value: Values[]) =>
    set((state) => ({
      internal: state.internal.map((item) =>
        item.integration.id === integrationId
          ? { ...item, integrationValue: value }
          : item
      ),
    })),
  setTotalChars: (totalChars: number) =>
    set((state) => ({
      totalChars,
    })),
  appendInternalValueMedia: (
    integrationId: string,
    index: number,
    media: { id: string; path: string }[]
  ) =>
    set((state) => ({
      internal: state.internal.map((item) =>
        item.integration.id === integrationId
          ? {
              ...item,
              integrationValue: item.integrationValue.map((v, i) =>
                i === index
                  ? { ...v, media: [...(v?.media || []), ...media] }
                  : v
              ),
            }
          : item
      ),
    })),
  appendGlobalValueMedia: (
    index: number,
    media: { id: string; path: string }[]
  ) =>
    set((state) => ({
      global: state.global.map((item, i) =>
        i === index
          ? { ...item, media: [...(item?.media || []), ...media] }
          : item
      ),
    })),
  setPostComment: (postComment: PostComment) =>
    set((state) => ({
      postComment,
    })),
  setActivateExitButton: (activateExitButton: boolean) =>
    set((state) => ({
      activateExitButton,
    })),
  setDummy: (dummy: boolean) =>
    set((state) => ({
      dummy,
    })),
  setEditor: (editor: 'none' | 'normal' | 'markdown' | 'html') =>
    set((state) => ({
      editor,
    })),
  setLoaded: (loaded: boolean) =>
    set((state) => ({
      loaded,
    })),
  setChars: (id: string, chars: number) =>
    set((state) => ({
      chars: {
        ...state.chars,
        [id]: chars,
      },
    })),
  setComments: (comments: boolean | 'no-media') =>
    set((state) => ({
      comments,
    })),
  setGlobalDelay: (index: number, minutes: number) =>
    set((state) => ({
      global: state.global.map((item, i) =>
        i === index ? { ...item, delay: minutes } : item
      ),
    })),
  setInternalDelay: (integrationId: string, index: number, minutes: number) =>
    set((state) => ({
      internal: state.internal.map((item) =>
        item.integration.id === integrationId
          ? {
              ...item,
              integrationValue: item.integrationValue.map((v, i) =>
                i === index ? { ...v, delay: minutes } : v
              ),
            }
          : item
      ),
    })),
}));
