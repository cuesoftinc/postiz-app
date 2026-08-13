'use client';
import 'reflect-metadata';

import React, { FC, Fragment, useCallback, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import clsx from 'clsx';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';

/**
 * NAMING. These rows are called TEMPLATES everywhere a user can see them — the
 * composer's header control, its picker and its save dialog all say Template
 * (editor.tsx), and this settings surface used to be the one place calling the
 * same rows Sets. The user-facing copy below is therefore Template.
 *
 * Nothing underneath is renamed: the API route stays `/sets`, the SWR cache key
 * stays `'sets'` (the composer picker shares it, so one save has to land in both
 * views), the Prisma model stays `Sets`, the settings tab id stays `sets`, and
 * the modal ids stay as they were. This is a label change, not a migration.
 */
const SaveTemplateModal: FC<{
  postData: any;
  initialValue?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}> = ({ postData, onSave, onCancel, initialValue }) => {
  const [name, setName] = useState(initialValue);
  const t = useT();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Input
          label="Template Name"
          translationKey="label_template_name"
          name="setName"
          value={name}
          disableForm={true}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a name for this template"
          autoFocus
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" secondary onClick={onCancel}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {t('save', 'Save')}
        </Button>
      </div>
    </form>
  );
};

export const Sets: FC = () => {
  const fetch = useFetch();
  const user = useUser();
  const modal = useModals();
  const toaster = useToaster();

  const load = useCallback(async (path: string) => {
    return (await (await fetch(path)).json()).integrations;
  }, []);

  const { isLoading, data: integrations } = useSWR('/integrations/list', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });

  const list = useCallback(async () => {
    return (await fetch('/sets')).json();
  }, []);

  const { data, mutate } = useSWR('sets', list, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });

  const addSet = useCallback(
    (params?: { id?: string; name?: string; content?: string }) => () => {
      modal.openModal({
        id: 'add-edit-modal',
        closeOnClickOutside: false,
        removeLayout: true,
        closeOnEscape: false,
        withCloseButton: false,
        askClose: true,
        fullScreen: true,
        classNames: {
          modal: 'w-[100%] max-w-[1400px] text-newTextColor',
        },
        children: (
          <AddEditModal
            allIntegrations={integrations.map((p: any) => ({
              ...p,
            }))}
            {...(params?.id ? { set: JSON.parse(params.content) } : {})}
            addEditSets={(data) => {
              modal.openModal({
                title: 'Save as template',
                children: (
                  <SaveTemplateModal
                    initialValue={params?.name || ''}
                    postData={data}
                    onSave={async (name: string) => {
                      try {
                        await fetch('/sets', {
                          method: 'POST',
                          body: JSON.stringify({
                            ...(params?.id ? { id: params.id } : {}),
                            name,
                            content: JSON.stringify(data),
                          }),
                        });
                        modal.closeAll();
                        mutate();
                        toaster.show('Template saved', 'success');
                      } catch (error) {
                        toaster.show('Failed to save template', 'warning');
                      }
                    }}
                    onCancel={() => modal.closeAll()}
                  />
                ),
              });
            }}
            reopenModal={() => {}}
            mutate={() => {}}
            integrations={integrations}
            date={newDayjs()}
          />
        ),
        title: ``,
      });
    },
    [integrations]
  );

  const deleteSet = useCallback(
    (data: any) => async () => {
      if (await deleteDialog(`Are you sure you want to delete ${data.name}?`)) {
        await fetch(`/sets/${data.id}`, {
          method: 'DELETE',
        });
        mutate();
        toaster.show('Template deleted', 'success');
      }
    },
    []
  );

  const t = useT();

  return (
    <div className="flex flex-col">
      {/* settings pattern (same as Signatures): display-face title, muted 14
          helper, hairline-separated field group. data-cs keeps the desktop
          ladder off the title size. */}
      {/* `templates` is an existing translation key resolving to 'Templates',
          the same one the composer header control uses. The old `sets` key is
          left in place rather than re-pointed: it still resolves to 'Sets' for
          the settings TAB label, which lives in a file this change does not
          own. */}
      <h3 data-cs className="text-[20px] font-[400] font-display">
        {t('templates', 'Templates')} ({data?.length || 0})
      </h3>
      <div className="text-[14px] text-textItemBlur mt-[4px]">
        {t(
          'manage_your_content_templates_for_easy_reuse_across_posts',
          'Manage your content templates for easy reuse across posts.'
        )}
      </div>
      <div className="my-[16px] pt-[16px] border-t border-newTableBorder items-center flex gap-[16px]">
        <div className="flex flex-col w-full">
          {!!data?.length && (
            <div className="grid grid-cols-[2fr,1fr,1fr] w-full gap-y-[10px]">
              <div className="text-[13px] font-[500] text-textItemBlur">{t('name', 'Name')}</div>
              <div className="text-[13px] font-[500] text-textItemBlur">{t('edit', 'Edit')}</div>
              <div className="text-[13px] font-[500] text-textItemBlur">{t('delete', 'Delete')}</div>
              {data?.map((p: any) => (
                <Fragment key={p.id}>
                  <div className="flex flex-col justify-center">{p.name}</div>
                  <div className="flex flex-col justify-center">
                    <div>
                      <Button secondary={true} onClick={addSet(p)}>
                        {t('edit', 'Edit')}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <div>
                      <Button secondary={true} onClick={deleteSet(p)}>
                        {t('delete', 'Delete')}
                      </Button>
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          )}
          <div>
            <Button
              secondary={true}
              onClick={addSet()}
              className={clsx((data?.length || 0) > 0 && 'my-[16px]')}
            >
              {t('add_a_template', 'Add a template')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
