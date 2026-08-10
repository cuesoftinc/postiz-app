'use client';

import React, { FC, useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import clsx from 'clsx';
import { VideoFrame } from '@gitroom/react/helpers/video.frame';
import { Pagination } from '@gitroom/frontend/components/media/media.component';
import { EmptyState } from '@gitroom/frontend/components/cuesoft/empty-state';
import { ChevronLeftIcon } from '@gitroom/frontend/components/ui/icons';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';

const ThirdPartyMediaLibraryBrowser: FC<{
  integration: any;
  onImported: () => void;
}> = ({ integration, onImported }) => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const modals = useModals();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  const loadMedia = useCallback(async () => {
    return (
      await fetch(
        `/third-party/function/${integration.id}/listMedia`,
        {
          body: JSON.stringify({ page: page + 1 }),
          method: 'POST',
        }
      )
    ).json();
  }, [integration.id, page]);

  const { data, isLoading } = useSWR(
    `media-library-${integration.id}-${page}`,
    loadMedia,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );

  const toggleSelect = useCallback(
    (item: any) => {
      const exists = selected.find((s) => s.id === item.id);
      if (exists) {
        setSelected(selected.filter((s) => s.id !== item.id));
      } else {
        setSelected([...selected, item]);
      }
    },
    [selected]
  );

  const importSelected = useCallback(async () => {
    if (!selected.length) return;
    setImporting(true);
    try {
      await fetch(`/third-party/${integration.id}/import`, {
        method: 'POST',
        body: JSON.stringify({
          items: selected.map((s) => ({ url: s.url, name: s.name })),
        }),
      });
      toaster.show(
        t('media_imported_successfully', 'Media imported successfully'),
        'success'
      );
      onImported();
      modals.closeCurrent();
    } catch {
      toaster.show(
        t('media_import_failed', 'Failed to import media'),
        'warning'
      );
    } finally {
      setImporting(false);
    }
  }, [selected, integration.id]);

  return (
    <div className="flex flex-col gap-[16px] h-full">
      <div className="text-[14px] font-[600]">
        {t('select_media_to_import', 'Select media to import from')}{' '}
        {integration.title}: {integration.name}
      </div>
      <div className="flex-1 relative">
        <div className="absolute left-0 top-0 w-full h-full overflow-x-hidden overflow-y-auto scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner">
          {isLoading && (
            <div className="grid grid-cols-4 gap-[8px]">
              {[...new Array(8)].map((_, i) => (
                <Skeleton key={i} className="aspect-square !rounded-[6px]" />
              ))}
            </div>
          )}
          {!isLoading && (!data?.results || !data.results.length) && (
            <EmptyState
              title={t('no_media_found', 'No media found')}
              className="h-full"
            />
          )}
          {!isLoading && !!data?.results?.length && (
            <div className="grid grid-cols-4 gap-[8px]">
              {data.results.map((item: any) => {
                const isSelected = !!selected.find((s) => s.id === item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item)}
                    className="cursor-pointer aspect-square rounded-[6px] overflow-hidden relative group"
                  >
                    <div
                      className={clsx(
                        'w-full h-full border-[4px] rounded-[6px]',
                        isSelected
                          ? 'border-forth'
                          : 'border-transparent'
                      )}
                    >
                      {item.type === 'video' ? (
                        <VideoFrame url={item.thumbnail || item.url} />
                      ) : (
                        <img
                          className="w-full h-full object-cover rounded-[4px]"
                          src={item.thumbnail || item.url}
                          alt={item.name || ''}
                        />
                      )}
                    </div>
                    {isSelected && (
                      <div className="text-white flex z-[10] justify-center items-center text-[14px] font-[500] w-[24px] h-[24px] rounded-full bg-forth absolute -bottom-[2px] -end-[2px]">
                        {selected.findIndex((s) => s.id === item.id) + 1}
                      </div>
                    )}
                    {item.name && (
                      <div className="absolute bottom-[4px] start-[4px] text-[10px] text-white bg-black/50 px-[4px] rounded truncate max-w-[90%]">
                        {item.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {(data?.pages || 0) > 1 && (
        <Pagination
          current={page}
          totalPages={data?.pages}
          setPage={setPage}
        />
      )}
      <div className="flex justify-end gap-[8px]">
        <button
          onClick={() => modals.closeCurrent()}
          className="cursor-pointer h-[40px] px-[16px] text-[14px] items-center justify-center border border-newTableBorder flex rounded-[8px] hover:bg-boxHover"
        >
          {t('cancel', 'Cancel')}
        </button>
        <button
          onClick={importSelected}
          disabled={!selected.length || importing}
          className="cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed h-[40px] px-[16px] text-[14px] font-[600] items-center justify-center bg-btnPrimary flex rounded-[8px] gap-[8px]"
        >
          {importing && (
            <div className="animate-spin h-[16px] w-[16px] border-2 border-black border-t-transparent rounded-full" />
          )}
          {t('import_selected', 'Import Selected')} ({selected.length})
        </button>
      </div>
    </div>
  );
};

const ThirdPartyMediaLibraryPicker: FC<{
  integrations: any[];
  onImported: () => void;
}> = ({ integrations, onImported }) => {
  const [selected, setSelected] = useState<any>(null);
  const t = useT();

  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <button
          type="button"
          className="cursor-pointer mb-[10px] self-start flex items-center gap-[4px] text-[14px] text-newTextColor/60 hover:text-newTextColor transition-colors"
          onClick={() => setSelected(null)}
        >
          <ChevronLeftIcon size={16} />
          {t('back', 'Back')}
        </button>
        <ThirdPartyMediaLibraryBrowser
          integration={selected}
          onImported={onImported}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-[10px] justify-items-center justify-center">
      {integrations.map((p: any) => (
        <div
          key={p.id}
          onClick={() => setSelected(p)}
          className="w-full h-full p-[20px] min-h-[100px] text-[14px] bg-newTableHeader hover:bg-newTableBorder rounded-[12px] transition-all text-textColor relative flex flex-col gap-[15px] cursor-pointer"
        >
          <div>
            <img
              className="w-[32px] h-[32px] rounded-full"
              src={`/icons/third-party/${p.identifier}.png`}
            />
          </div>
          <div className="whitespace-pre-wrap text-left text-[15px] font-[600]">
            {p.title}: {p.name}
          </div>
          <div className="whitespace-pre-wrap text-left text-[14px] text-newTextColor/60">
            {p.description}
          </div>
        </div>
      ))}
    </div>
  );
};

export const ThirdPartyMediaLibrary: FC<{
  onImported: () => void;
}> = ({ onImported }) => {
  const fetch = useFetch();
  const t = useT();
  const modals = useModals();

  const loadThirdParties = useCallback(async () => {
    return (await (await fetch('/third-party')).json()).filter(
      (f: any) => f.position === 'media-library'
    );
  }, []);

  const { data, isLoading } = useSWR(
    'third-party-media-library',
    loadThirdParties,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
    }
  );

  if (isLoading || !data?.length) {
    return null;
  }

  return (
    <button
      onClick={() => {
        modals.openModal({
          title: t('import_from', 'Import From'),
          fullScreen: true,
          size: 'calc(100% - 80px)',
          height: 'calc(100% - 80px)',
          children: () => (
            <ThirdPartyMediaLibraryPicker
              integrations={data}
              onImported={onImported}
            />
          ),
        });
      }}
      className="cursor-pointer bg-newBgColorInner border border-newTableBorder hover:bg-boxHover changeColor flex gap-[8px] h-[36px] px-[14px] justify-center items-center rounded-[8px]"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5" />
        <path d="M12 15V3" />
      </svg>
      <div>{t('import', 'Import')}</div>
    </button>
  );
};
