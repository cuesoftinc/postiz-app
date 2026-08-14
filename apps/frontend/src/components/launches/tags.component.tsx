'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import { ReactTags } from 'react-tag-autocomplete';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Input } from '@gitroom/react/form/input';
import { ColorPicker } from '@gitroom/react/form/color.picker';
import { Button } from '@gitroom/react/form/button';
import { uniqBy } from 'lodash';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useClickOutside } from '@mantine/hooks';
import clsx from 'clsx';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  TagIcon,
  DropdownArrowIcon,
  PlusIcon,
  CheckmarkIcon,
} from '@gitroom/frontend/components/ui/icons';

export const TagsComponent: FC<{
  name: string;
  label: string;
  initial: any[];
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = (props) => {
  const fetch = useFetch();

  const loadTags = useCallback(async () => {
    return (await fetch('/posts/tags')).json();
  }, []);

  const { data, isLoading, mutate } = useSWR('load-tags', loadTags);

  if (isLoading) {
    return null;
  }

  return <TagsComponentInner {...props} allTags={data} mutate={mutate} />;
};

export const TagsComponentInner: FC<{
  name: string;
  label: string;
  initial: any[];
  allTags: any;
  mutate: () => Promise<any>;
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = ({ initial, onChange, name, mutate, allTags: data }) => {
  const t = useT();
  const fetch = useFetch();
  const [isOpen, setIsOpen] = useState(false);
  const [allowClose, setAllowClose] = useState(true);
  const [tagValue, setTagValue] = useState<any[]>(
    (initial?.slice(0) || []).map((p: any) => {
      return data?.tags.find((a: any) => a.name === p.value) || p;
    })
  );
  const modals = useModals();

  const ref = useClickOutside(() => {
    if (!isOpen || !allowClose) {
      return;
    }
    setIsOpen(false);
  });

  const addTag = useCallback(async () => {
    const val: string | undefined = await new Promise((resolve) => {
      modals.openModal({
        title: t('add_new_tag', 'Add New Tag'),
        children: (close) => (
          <ShowModal tag="" close={close} resolve={resolve} />
        ),
      });
    });

    const newValues = await mutate();

    if (!val) {
      return;
    }

    const newTag = newValues.tags.find((p: any) => p.name === val);
    if (newTag) {
      const modify = [...tagValue, newTag];
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    }
  }, []);

  const deleteTag = useCallback(
    async (tag: any, e: React.MouseEvent) => {
      setAllowClose(false);
      e.stopPropagation();
      const confirmed: boolean = await new Promise((resolve) => {
        modals.openModal({
          title: t('delete_tag', 'Delete Tag'),
          children: (close) => (
            <ConfirmDeleteModal
              tagName={tag.name}
              close={close}
              resolve={resolve}
            />
          ),
        });
      });

      if (!confirmed) {
        setTimeout(() => {
          setAllowClose(true);
        }, 500);
        return;
      }

      await fetch(`/posts/tags/${tag.id}`, {
        method: 'DELETE',
      });

      // Remove the tag from current selection if it was selected
      const modify = tagValue.filter((a) => a.id !== tag.id);
      if (modify.length !== tagValue.length) {
        setTagValue(modify);
        onChange({
          target: {
            value: modify.map((p: any) => ({
              label: p.name,
              value: p.name,
            })),
            name,
          },
        });
      }

      await mutate();

      setTimeout(() => {
        setAllowClose(true);
      }, 500);
    },
    [tagValue, name, onChange, mutate, fetch, modals, t]
  );

  return (
    <div
      ref={ref}
      className={clsx(
        // min-w-0 down the chain: the composer header caps this chip on
        // phone (phone:max-w on #cs-tags-chip), and without it flex
        // min-width:auto let the selected-tag pill push the chip - and the
        // whole header row - wider than the viewport. The pill's truncate
        // span is the only node that gives way; icon, +N and chevron keep
        // their natural width.
        'border rounded-[8px] justify-center flex items-center relative h-[44px] text-[15px] font-[550] select-none min-w-0',
        isOpen ? 'border-forth' : 'border-newTextColor/10'
      )}
    >
      {/* justify-start + overflow-hidden, not justify-center: the composer
          header squeezes this chip (it is the only shrinkable item in that
          row), and once the row runs out of width the icon + chevron + padding
          are an irreducible ~62px floor. Under `justify-center` a flex line
          that overflows its box spills EQUALLY on both sides, so the tag glyph
          painted to the LEFT of the chip's border and landed on top of the
          "Create Post" title. Starting the line means any residual overflow
          goes one way only, and overflow-hidden clips it instead of painting
          it over a neighbour. Nothing moves when the chip is at its natural
          width: the row is `flex-1` inside a content-sized chip, so start and
          center resolve to the same place. The dropdown is a SIBLING of this
          div, not a child, so the clip cannot reach it. */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-[16px] justify-start flex gap-[8px] items-center h-full select-none flex-1 min-w-0 overflow-hidden"
      >
        <div className="cursor-pointer">
          <TagIcon />
        </div>
        <div className="cursor-pointer flex gap-[4px] whitespace-nowrap min-w-0">
          {tagValue.length === 0 ? (
            <>
              {/* phone: Buffer's short "Tags" — the full label wrapped to
                  two lines and inflated the composer header */}
              <span className="phone:hidden">
                {t('add_new_tag', 'Add New Tag')}
              </span>
              <span className="hidden phone:inline">{t('tags', 'Tags')}</span>
            </>
          ) : (
            <>
              <div
                className="h-full flex justify-center items-center px-[8px] rounded-[4px] min-w-0"
                style={{ backgroundColor: tagValue[0].color }}
              >
                {/* one line, ellipsized past ~140px; ink via
                    mix-blend-difference (the calendar pills' treatment) -
                    the old 4-way black text-shadow read as a strike-through
                    on light tag colors like #EDE9FE */}
                <span className="text-white mix-blend-difference whitespace-nowrap max-w-[140px] truncate">
                  {tagValue[0].name}
                </span>
              </div>
              {tagValue.length > 1 ? <span>+{tagValue.length - 1}</span> : null}
            </>
          )}
        </div>
        <div className="cursor-pointer">
          <DropdownArrowIcon rotated={isOpen} />
        </div>
      </div>
      {isOpen && (
        <div className="z-[300] absolute start-0 bottom-[100%] w-[240px] bg-newBgColorInner p-[12px] menu-shadow -translate-y-[10px] flex flex-col">
          {(data?.tags || []).map((p: any) => (
            <div
              onClick={() => {
                const exists = !!tagValue.find((a) => a.id === p.id);
                let modify = [];
                if (exists) {
                  modify = tagValue.filter((a) => a.id !== p.id);
                } else {
                  modify = [...tagValue, p];
                }
                setTagValue(modify);
                onChange({
                  target: {
                    value: modify.map((p: any) => ({
                      label: p.name,
                      value: p.name,
                    })),
                    name,
                  },
                });
              }}
              key={p.name}
              className="min-h-[40px] py-[8px] px-[20px] -mx-[12px] flex gap-[8px] items-center group"
            >
              <Check
                onChange={() => {}}
                value={!!tagValue.find((a) => a.id === p.id)}
              />
              {/* min-w-0 (not break-all) so the chip can shrink and ellipsize:
                  break-all wrapped 'needs-approval' mid-word in the 195px
                  popover ('needs-approva' + a lone 'l'). The pill background
                  sits on the outer div and the blend on an inner span, so
                  mix-blend-difference inverts only the label ink - the old
                  4-way black text-shadow outline read as struck-through on
                  light tag colors. Cap at 200px (was 140): 140 ellipsized
                  typical names like 'needs-approval'; the min-w-0 chain
                  still shrinks the pill when the row is narrower. */}
              <div className="h-full flex items-center flex-1 min-w-0">
                <div
                  className="px-[8px] rounded-[8px] max-w-[200px] overflow-hidden"
                  style={{ backgroundColor: p.color }}
                >
                  <div className="text-white mix-blend-difference whitespace-nowrap truncate">
                    {p.name}
                  </div>
                </div>
              </div>
              {!tagValue.find((a) => a.id === p.id) && (
                <div
                  onClick={(e) => deleteTag(p, e)}
                  className="ms-auto transition-opacity cursor-pointer text-red-500 text-[14px] font-[550]"
                >
                  ×
                </div>
              )}
            </div>
          ))}
          <div
            onClick={addTag}
            className="cursor-pointer gap-[8px] flex w-full h-[34px] rounded-[8px] mt-[12px] px-[16px] justify-center items-center bg-btnPrimary text-white"
          >
            <div>
              <PlusIcon />
            </div>
            <div className="text-[13px] font-[550]">
              {t('add_new_tag', 'Add New Tag')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Check: FC<{ value: boolean; onChange: (value: boolean) => void }> = ({
  value,
  onChange,
}) => {
  return (
    <div
      onClick={() => onChange(!value)}
      className={clsx(
        'text-center flex border border-btnSimple rounded-[6px] min-w-[20px] min-h-[20px] w-[20px] h-[20px] justify-center items-center',
        value && 'bg-forth'
      )}
    >
      {value ? <CheckmarkIcon className="text-white" /> : ''}
    </div>
  );
};
export const TagsComponentA: FC<{
  name: string;
  label: string;
  initial: any[];
  onChange: (event: {
    target: {
      value: any[];
      name: string;
    };
  }) => void;
}> = (props) => {
  const { onChange, name, initial } = props;
  const fetch = useFetch();
  const [tagValue, setTagValue] = useState<any[]>(initial?.slice(0) || []);
  const [suggestions, setSuggestions] = useState<string>('');
  const [showModal, setShowModal] = useState<any>(false);
  const loadTags = useCallback(async () => {
    return (await fetch('/posts/tags')).json();
  }, []);
  const { isLoading, data, mutate } = useSWR<{
    tags: {
      name: string;
      color: string;
    }[];
  }>('tags', loadTags, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
  const onDelete = useCallback(
    (tagIndex: number) => {
      const modify = tagValue.filter((_, i) => i !== tagIndex);
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    },
    [tagValue]
  );
  const createNewTag = useCallback(
    async (newTag: any) => {
      const val = await new Promise((resolve) => {
        setShowModal({
          tag: newTag.value,
          resolve,
          close: () => setShowModal(false),
        });
      });
      setShowModal(false);
      mutate();
      return val;
    },
    [mutate]
  );
  const edit = useCallback(
    (tag: any) => async (e: any) => {
      e.stopPropagation();
      e.preventDefault();
      const val = await new Promise((resolve) => {
        setShowModal({
          tag: tag.name,
          color: tag.color,
          id: tag.id,
          resolve,
          close: () => setShowModal(false),
        });
      });
      setShowModal(false);
      mutate();
      const modify = tagValue.map((t) => {
        if (t.label === tag.name) {
          return {
            value: val,
            label: val,
          };
        }
        return t;
      });
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    },
    [tagValue, data]
  );
  const onAddition = useCallback(
    async (newTag: any) => {
      if (tagValue.length >= 3) {
        return;
      }
      const getTag = data?.tags?.find((f) => f.name === newTag.label)
        ? newTag.label
        : await createNewTag(newTag);
      const modify = [
        ...tagValue,
        {
          value: getTag,
          label: getTag,
        },
      ];
      setTagValue(modify);
      onChange({
        target: {
          value: modify,
          name,
        },
      });
    },
    [tagValue, data]
  );

  // useEffect(() => {
  //   const settings = getValues()[props.name];
  //   if (settings) {
  //     setTagValue(settings);
  //   }
  // }, []);

  const suggestionsArray = useMemo(() => {
    return uniqBy<{
      label: string;
      value: string;
    }>(
      [
        ...(data?.tags.map((p) => ({
          label: p.name,
          value: p.name,
        })) || []),
        ...tagValue,
        {
          label: suggestions,
          value: suggestions,
        },
      ].filter((f) => f.label),
      (o) => o.label
    );
  }, [suggestions, tagValue]);

  const t = useT();

  if (isLoading) {
    return null;
  }
  return (
    <>
      {showModal && <ShowModal {...showModal} />}
      <div className="flex-1 flex tags-top">
        <ReactTags
          placeholderText={t('add_a_tag', 'Add a tag')}
          suggestions={suggestionsArray}
          selected={tagValue}
          onAdd={onAddition}
          onInput={setSuggestions}
          onDelete={onDelete}
          renderTag={(tag) => {
            const findTag = data?.tags?.find((f) => f.name === tag.tag.label);
            const findIndex = tagValue.findIndex(
              (f) => f.label === tag.tag.label
            );
            return (
              <div
                className={`min-w-[50px] float-left ms-[4px] p-[3px] rounded-xs relative`}
                style={{
                  backgroundColor: findTag?.color,
                }}
              >
                <div
                  className="absolute -top-[5px] start-[10px] text-[12px] text-red-600 bg-white px-[3px] rounded-full"
                  onClick={edit(findTag)}
                >
                  {t('edit', 'Edit')}
                </div>
                <div
                  className="absolute -top-[5px] -start-[5px] text-[12px] text-red-600 bg-white px-[3px] rounded-full"
                  onClick={() => onDelete(findIndex)}
                >
                  X
                </div>
                <div className="text-white mix-blend-difference">
                  {tag.tag.label}
                </div>
              </div>
            );
          }}
        />
      </div>
    </>
  );
};
const ConfirmDeleteModal: FC<{
  tagName: string;
  close: () => void;
  resolve: (value: boolean) => void;
}> = ({ tagName, close, resolve }) => {
  const t = useT();

  return (
    <div className="flex flex-col gap-[16px]">
      <p className="text-[14px]">
        {t(
          'confirm_delete_tag',
          'Are you sure you want to delete the tag "{{tagName}}"?',
          { tagName }
        )}
      </p>
      <div className="flex gap-[8px] justify-end">
        <Button
          onClick={() => {
            resolve(false);
            close();
          }}
        >
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          onClick={() => {
            resolve(true);
            close();
          }}
          className="bg-red-500 hover:bg-red-600"
        >
          {t('delete', 'Delete')}
        </Button>
      </div>
    </div>
  );
};

const ShowModal: FC<{
  tag: string;
  color?: string;
  id?: string;
  close: () => void;
  resolve: (value: string) => void;
}> = (props) => {
  const t = useT();

  const { close, tag, resolve, color: theColor, id } = props;
  const fetch = useFetch();
  const [color, setColor] = useState<string>(theColor || '#942828');
  const [tagName, setTagName] = useState<string>(tag);
  const save = useCallback(async () => {
    await fetch(id ? `/posts/tags/${id}` : '/posts/tags', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({
        name: tagName,
        color,
      }),
    });
    resolve(tagName);
    close();
  }, [tagName, color, id]);
  return (
    <div>
      <Input
        name="name"
        disableForm={true}
        label={t('tag_name', 'Name')}
        value={tagName}
        onChange={(e) => setTagName(e.target.value)}
      />
      <ColorPicker
        onChange={(e) => setColor(e.target.value)}
        label={t('label_tag_color', 'Tag Color')}
        name="color"
        value={color}
        enabled={true}
        canBeCancelled={false}
      />
      <Button onClick={save} className="mt-[16px]">
        {t('save', 'Save')}
      </Button>
    </div>
  );
};
