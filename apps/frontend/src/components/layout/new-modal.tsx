import { create } from 'zustand';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { useShallow } from 'zustand/react/shallow';
import React, {
  createContext,
  FC,
  memo,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { Button } from '@gitroom/react/form/button';
import { useHotkeys } from 'react-hotkeys-hook';
import clsx from 'clsx';
import { EventEmitter } from 'events';
import { ModalCloseButton } from '@gitroom/frontend/components/cuesoft/modal/modal-close-button';
import { ModalFooter } from '@gitroom/frontend/components/cuesoft/modal/modal-footer';

interface OpenModalInterface {
  title?: any;
  closeOnClickOutside?: boolean;
  removeLayout?: boolean;
  fullScreen?: boolean;
  top?: string | number;
  closeOnEscape?: boolean;
  withCloseButton?: boolean;
  askClose?: boolean;
  onClose?: () => void;
  children: ReactNode | ((close: () => void) => ReactNode);
  classNames?: {
    modal?: string;
  };
  size?: string | number;
  maxSize?: string | number;
  height?: string | number;
  id?: string;
}

interface ModalManagerStoreInterface {
  closeById(id: string): void;
  openModal(params: OpenModalInterface): void;
  closeAll(): void;
}

interface State extends ModalManagerStoreInterface {
  modalManager: Array<{ id: string } & OpenModalInterface>;
}

const useModalStore = create<State>((set) => ({
  modalManager: [],
  openModal: (params) => {
    // phone surfaces must not stack: any modal opening (composer included)
    // dismisses open bottom sheets / the nav drawer (see filters.tsx)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cs:surface-open', { detail: 'modal' })
      );
    }
    const newId = params.id || makeId(20);
    set((state) => ({
      modalManager: [
        ...state.modalManager,
        ...(!state.modalManager.some((p) => p.id === newId)
          ? [{ id: newId, ...params }]
          : []),
      ],
    }));
  },
  closeById: (id) =>
    set((state) => ({
      modalManager: state.modalManager.filter((modal) => modal.id !== id),
    })),
  closeAll: () => set({ modalManager: [] }),
}));

const CurrentModalContext = createContext({ id: '' });

// openModal({ size: 'xl' }) used to put the literal string 'xl' into inline
// `style.width` — invalid CSS the browser drops — while ALSO disabling the
// default `min-w-[600px]` class (skipped whenever `size` is set). Treat `size`
// as a width only when it is a number or a CSS length; 'xl' (the one named
// size in use — generator.tsx) resolves to undefined so the chrome's default
// 600px min-width (with its phone fallback) applies, which is what it
// evidently wanted.
const resolveModalWidth = (size?: string | number) => {
  if (typeof size === 'number') {
    return size;
  }
  if (!size) {
    return undefined;
  }
  // CSS lengths in use: '80%', '60%', '100%', '500px', 'calc(100% - 80px)'
  return /^[\d.]|^calc\(|^var\(/.test(size) ? size : undefined;
};

// `classNames.modal` was declared but never applied — a leftover of the
// Mantine modal API. It is honored on the shell div below with one temporary
// guard: the stale `bg-transparent` token is stripped. In the compiled
// cascade `bg-transparent` beats the shell's `bg-newBgColorInner`, and five
// old-theme call sites still pass it even though the new-theme migration
// removed their children's self-chrome cards (teams AddMember, billing
// Accept + Info, add.provider Web3Providers + CustomVariables) — honoring it
// there would leave those modals floating card-less over the 30%-alpha
// backdrop. Remove the guard once those call sites regain self-chrome or
// drop the stale token.
//
// SCOPE: there is no shell div on the `removeLayout` path, so this applies to
// LAYOUT modals only. Every composer-family caller passes `removeLayout: true`
// (new.post, calendar x2, generator, menu, agent.chat, sets), so the
// `max-w-[1400px]` those seven hand us has never taken effect; the composer's
// real cap is the 1100px on `#cs-composer` in manage.modal.tsx. Hence the
// computation lives inside the branch that consumes it, not above both.
const resolveShellClassNames = (classNames?: { modal?: string }) =>
  classNames?.modal
    ?.split(' ')
    .filter((token) => token && token !== 'bg-transparent')
    .join(' ');

interface ModalManagerInterface extends ModalManagerStoreInterface {
  closeCurrent(): void;
}

export const useModals = () => {
  const { closeAll, openModal, closeById } = useModalStore(
    useShallow((state) => ({
      openModal: state.openModal,
      closeById: state.closeById,
      closeAll: state.closeAll,
    }))
  );

  const modalContext = useContext(CurrentModalContext);

  return {
    openModal,
    closeAll,
    closeById,
    closeCurrent: () => {
      if (modalContext.id) {
        closeById(modalContext.id);
      }
    },
  } satisfies ModalManagerInterface;
};

export const Component: FC<{
  closeModal: (id: string) => void;
  zIndex: number;
  isLast: boolean;
  modal: { id: string } & OpenModalInterface;
}> = memo(({ isLast, modal, closeModal, zIndex }) => {
  const decision = useDecisionModal();
  const closeModalFunction = useCallback(async () => {
    if (modal.askClose) {
      const open = await decision.open();
      if (!open) {
        return;
      }
    }
    modal?.onClose?.();
    closeModal(modal.id);
  }, [modal.id, closeModal]);

  const RenderComponent = useMemo(() => {
    return typeof modal.children === 'function'
      ? modal.children(closeModalFunction)
      : modal.children;
  }, [modal, closeModalFunction]);

  useHotkeys(
    'Escape',
    () => {
      if (isLast) {
        closeModalFunction();
      }
    },
    [isLast, closeModalFunction]
  );

  const sizeWidth = resolveModalWidth(modal.size);

  if (modal.removeLayout) {
    return (
      <div
        style={{ zIndex }}
        className={clsx(
          !modal.fullScreen
            ? 'pb-[50px] min-w-full min-h-full'
            : 'w-full h-full',
          // Buffer overlays (measured): plain rgba(0,0,0,0.8), NO blur
          'fixed flex left-0 top-0 bg-black/80 transition-all animate-fadeIn overflow-y-auto text-newTextColor',
          // phone: an over-wide child must never widen the layout viewport
          // (that shifts every position:fixed surface off the visual
          // viewport — left gutter + clipped right edge on the composer)
          'phone:max-w-[100dvw] phone:overflow-x-hidden',
          !isLast && '!overflow-hidden'
        )}
      >
        <div className={clsx(modal.fullScreen && 'flex', 'relative flex-1')}>
          <div
            className={clsx(
              modal.fullScreen
                ? 'flex flex-1'
                : 'absolute top-0 left-0 min-w-full min-h-full'
            )}
          >
            <div
              className={clsx(
                modal.fullScreen ? 'w-full h-full flex-1' : 'mx-auto py-[48px]'
              )}
              {...(sizeWidth && { style: { width: sizeWidth } })}
            >
              {typeof modal.children === 'function'
                ? modal.children(closeModalFunction)
                : modal.children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // layout modals only (see resolveShellClassNames)
  const shellClassNames = resolveShellClassNames(modal.classNames);

  return (
    <CurrentModalContext.Provider value={{ id: modal.id }}>
      <div
        onClick={closeModalFunction}
        style={{ zIndex }}
        className={clsx(
          // Buffer overlays (measured): plain rgba(0,0,0,0.8), NO blur
          'fixed flex left-0 top-0 min-w-full min-h-full bg-black/80 transition-all animate-fadeIn overflow-y-auto text-newTextColor',
          !modal.fullScreen && 'pb-[50px]'
        )}
      >
        <div className="relative flex-1">
          <div
            style={
              modal.top
                ? { paddingTop: modal.top, paddingBottom: modal.top }
                : {}
            }
            className={clsx(
              'absolute min-w-full',
              !modal.fullScreen
                ? modal.top
                  ? ''
                  : 'min-h-full pt-[100px] pb-[100px]'
                : 'h-screen',
              sizeWidth && modal.height
                ? 'flex justify-center items-center'
                : 'top-0 left-0'
            )}
          >
            <div
              className={clsx(
                // `removeLayout` returned above, so it is always false here:
                // the guard it used to carry was dead
                'gap-[40px] p-[32px] phone:gap-[20px] phone:p-[16px]',
                'bg-newBgColorInner mx-auto flex flex-col w-fit max-w-[100vw] rounded-[24px] phone:rounded-[16px] relative',
                // min-w-[600px] is wider than a phone, so on mobile the modal
                // body overran the viewport and pushed its own close button
                // (and any second column) off-screen.
                sizeWidth ? '' : 'min-w-[600px] phone:min-w-0',
                modal.fullScreen && 'h-full',
                shellClassNames
              )}
              {...((!!sizeWidth || !!modal.height || !!modal.maxSize) && {
                style: {
                  ...(sizeWidth ? { width: sizeWidth } : {}),
                  ...(modal.height ? { height: modal.height } : {}),
                  // an explicit size must still never exceed the viewport
                  maxWidth: modal.maxSize ?? '100vw',
                },
              })}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center">
                {/* modal titles: 18px/500 Inter, the body face — the composer
                    pattern (data-cs keeps the ladder off text-[18px]) */}
                <div
                  data-cs
                  className="text-[18px] font-[500] text-newTextColor flex-1"
                >
                  {modal.title}
                </div>
                {typeof modal.withCloseButton === 'undefined' ||
                modal.withCloseButton ? (
                  <div className="cursor-pointer">
                    <ModalCloseButton onClick={closeModalFunction} />
                  </div>
                ) : null}
              </div>
              <div
                className={clsx(
                  'whitespace-pre-line',
                  !!modal.height && !!sizeWidth && 'flex flex-1 flex-col'
                )}
              >
                {RenderComponent}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CurrentModalContext.Provider>
  );
});

export const ModalManagerInner: FC = () => {
  const { closeModal, modalManager } = useModalStore(
    useShallow((state) => ({
      closeModal: state.closeById,
      modalManager: state.modalManager,
    }))
  );

  useEffect(() => {
    if (modalManager.length > 0) {
      document.querySelector('body')?.classList.add('overflow-hidden');
      // Buffer backdrops do NOT blur the page behind (measured: flat
      // rgba(0,0,0,0.8) overlay) — blur-xs dropped, the pointer guard stays
      Array.from(document.querySelectorAll('.blurMe') || []).map((p) =>
        p.classList.add('pointer-events-none')
      );
    } else {
      document.querySelector('body')?.classList.remove('overflow-hidden');
      // blur-xs also removed here: clears the class off sessions that still
      // carry it from a pre-change render
      Array.from(document.querySelectorAll('.blurMe') || []).map((p) =>
        p.classList.remove('blur-xs', 'pointer-events-none')
      );
    }
  }, [modalManager]);

  if (modalManager.length === 0) {
    return null;
  }

  return (
    <>
      <style>{`body, html { overflow: hidden !important; }`}</style>
      {/* 200+index is the canonical modal-band anchor (200-299 - see the z
          scale in global.scss). Each wrapper's inline zIndex makes it the
          stacking context that contains ALL in-modal popovers (300-599
          resolve locally inside it). */}
      {modalManager.map((modal, index) => (
        <Component
          isLast={modalManager.length - 1 === index}
          key={modal.id}
          modal={modal}
          zIndex={200 + index}
          closeModal={closeModal}
        />
      ))}
    </>
  );
};
export const ModalManager: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div>
      <ModalManagerEmitter />
      <ModalManagerInner />
      <div className="transition-all w-full">{children}</div>
    </div>
  );
};

const emitter = new EventEmitter();
export const showModalEmitter = (params: ModalManagerInterface) => {
  emitter.emit('show', params);
};

export const ModalManagerEmitter: FC = () => {
  const { showModal } = useModalStore(
    useShallow((state) => ({
      showModal: state.openModal,
    }))
  );

  useEffect(() => {
    emitter.on('show', (params: OpenModalInterface) => {
      showModal(params);
    });

    return () => {
      emitter.removeAllListeners('show');
    };
  }, []);
  return null;
};

export const DecisionModal: FC<{
  description: string;
  approveLabel: string;
  cancelLabel: string;
  onlyApprove: boolean;
  resolution: (value: boolean) => void;
}> = ({ description, cancelLabel, approveLabel, resolution, onlyApprove }) => {
  const { closeCurrent } = useModals();
  return (
    <div className="flex flex-col">
      <div className="max-w-[600px]">{description}</div>
      {/* gap 12 -> 10 is the ModalFooter kit's called-out normalization */}
      <ModalFooter align="start">
        <Button
          onClick={() => {
            resolution(true);
            closeCurrent();
          }}
        >
          {approveLabel}
        </Button>
        {!onlyApprove && (
          <Button
            secondary={true}
            onClick={() => {
              resolution(false);
              closeCurrent();
            }}
          >
            {cancelLabel}
          </Button>
        )}
      </ModalFooter>
    </div>
  );
};

export const decisionModalEmitter = new EventEmitter();

export const areYouSure = ({
  title = 'Are you sure?',
  description = 'Are you sure you want to close this modal?' as any,
  approveLabel = 'Yes',
  cancelLabel = 'No',
} = {}): Promise<boolean> => {
  return new Promise<boolean>((newRes) => {
    decisionModalEmitter.emit('open', {
      title,
      description,
      approveLabel,
      cancelLabel,
      newRes,
    });
  });
};

export const DecisionEverywhere: FC = () => {
  const decision = useDecisionModal();
  useEffect(() => {
    decisionModalEmitter.on('open', decision.open);
  }, []);
  return null;
};

export const useDecisionModal = () => {
  const modals = useModals();
  const open = useCallback(
    ({
      title = 'Are you sure?',
      description = 'Are you sure you want to close this modal?' as any,
      onlyApprove = false,
      approveLabel = 'Yes',
      cancelLabel = 'No',
      newRes = undefined as any,
    } = {}) => {
      return new Promise<boolean>((res) => {
        modals.openModal({
          title,
          askClose: false,
          onClose: () => res(false),
          children: (
            <DecisionModal
              onlyApprove={onlyApprove}
              resolution={(value) => (newRes ? newRes(value) : res(value))}
              description={description}
              approveLabel={approveLabel}
              cancelLabel={cancelLabel}
            />
          ),
        });
      });
    },
    [modals]
  );

  return { open };
};
