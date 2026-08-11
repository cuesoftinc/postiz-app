'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import copy from 'copy-to-clipboard';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Button } from '@gitroom/react/form/button';
import { SkeletonTable } from '@gitroom/frontend/components/layout/skeleton';
import { ModalBody } from '@gitroom/frontend/components/cuesoft/modal/modal-body';
import { DataTable } from '@gitroom/frontend/components/cuesoft/data-table';
import { TablePagination } from '@gitroom/frontend/components/cuesoft/table-pagination';
import {
  ToolbarField,
  ToolbarInput,
  ToolbarRow,
  ToolbarSelect,
} from '@gitroom/frontend/components/cuesoft/toolbar/toolbar';

interface ErrorRow {
  id: string;
  message: string;
  body: string;
  platform: string;
  postId: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    users: { user: { id: string; email: string; name: string | null } }[];
  };
  post: { id: string; content: string | null };
}

interface ErrorsResponse {
  items: ErrorRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const safeParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const ErrorDetailsModal: FC<{ row: ErrorRow }> = ({ row }) => {
  const modal = useModals();
  const toaster = useToaster();
  const parsedMessage = useMemo(() => safeParse(row.message), [row.message]);
  const parsedBody = useMemo(() => safeParse(row.body), [row.body]);

  const copyAll = useCallback(() => {
    copy(
      JSON.stringify(
        { message: parsedMessage, body: parsedBody, meta: row },
        null,
        2
      )
    );
    toaster.show('Debug code copied to clipboard', 'success');
  }, [parsedMessage, parsedBody, row, toaster]);

  return (
    <ModalBody
      width="100%"
      gap={0}
      className="rounded-[4px] border border-newTableBorder bg-newBgColorInner px-[16px] pb-[16px] relative w-full max-h-[80vh] overflow-auto"
    >
      <div className="sticky top-0 bg-newBgColorInner py-[16px] flex items-center justify-between gap-[12px] z-[50] border-b border-newTableBorder mb-[12px]">
        <div className="text-[16px] font-[550]">Error Details</div>
        <div className="flex gap-[8px] items-center">
          <Button onClick={copyAll}>Copy Debug Code</Button>
          <button
            className="outline-none w-[28px] h-[28px] flex items-center justify-center hover:bg-tableBorder cursor-pointer rounded"
            type="button"
            onClick={() => modal.closeAll()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[12px] text-[13px] mb-[12px]">
        <div>
          <div className="text-newTextColor/60">Platform</div>
          <div>{row.platform}</div>
        </div>
        <div>
          <div className="text-newTextColor/60">Created</div>
          <div>{new Date(row.createdAt).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-newTextColor/60">Organization</div>
          <div>
            {row.organization?.name}{' '}
            <span className="text-newTextColor/60">({row.organization?.id})</span>
          </div>
        </div>
        <div>
          <div className="text-newTextColor/60">Users</div>
          <div className="break-all">
            {row.organization?.users
              ?.map((u) => u.user?.email)
              .filter(Boolean)
              .join(', ') || '-'}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-newTextColor/60">Post ID</div>
          <div>{row.postId}</div>
        </div>
      </div>

      <div className="text-[13px] font-[550] mb-[6px]">message</div>
      <pre className="text-[12px] bg-sixth p-[12px] rounded overflow-auto max-h-[40vh] whitespace-pre-wrap break-all">
        {typeof parsedMessage === 'string'
          ? parsedMessage
          : JSON.stringify(parsedMessage, null, 2)}
      </pre>

      <div className="text-[13px] font-[550] mb-[6px] mt-[12px]">body</div>
      <pre className="text-[12px] bg-sixth p-[12px] rounded overflow-auto max-h-[40vh] whitespace-pre-wrap break-all">
        {typeof parsedBody === 'string'
          ? parsedBody
          : JSON.stringify(parsedBody, null, 2)}
      </pre>
    </ModalBody>
  );
};

const usePlatformsList = () => {
  const fetch = useFetch();
  return useSWR<string[]>('/admin/errors/platforms', async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  });
};

const useErrorsList = (params: {
  page: number;
  limit: number;
  platform: string;
  email: string;
  unknownFirst: boolean;
}) => {
  const fetch = useFetch();
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
    ...(params.platform ? { platform: params.platform } : {}),
    ...(params.email ? { email: params.email } : {}),
    unknownFirst: params.unknownFirst ? 'true' : 'false',
  });
  const key = `/admin/errors?${query.toString()}`;
  return useSWR<ErrorsResponse>(key, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Failed to load errors');
    }
    return res.json();
  });
};

export const AdminErrorsComponent: FC = () => {
  const user = useUser();
  const modal = useModals();
  const toaster = useToaster();

  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [platform, setPlatform] = useState('');
  const [email, setEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [unknownFirst, setUnknownFirst] = useState(true);

  const { data: platforms } = usePlatformsList();
  const { data, isLoading, error } = useErrorsList({
    page,
    limit,
    platform,
    email,
    unknownFirst,
  });

  const onApplyEmail = useCallback(() => {
    setPage(0);
    setEmail(emailInput.trim());
  }, [emailInput]);

  const onClear = useCallback(() => {
    setPage(0);
    setEmail('');
    setEmailInput('');
    setPlatform('');
  }, []);

  const openDetails = useCallback(
    (row: ErrorRow) => {
      modal.openModal({
        closeOnClickOutside: true,
        withCloseButton: false,
        classNames: {
          modal: 'w-[100%] max-w-[1100px] text-newTextColor',
        },
        children: <ErrorDetailsModal row={row} />,
      });
    },
    [modal]
  );

  const copyRow = useCallback(
    (row: ErrorRow) => {
      copy(
        JSON.stringify(
          { message: safeParse(row.message), body: safeParse(row.body), meta: row },
          null,
          2
        )
      );
      toaster.show('Debug code copied to clipboard', 'success');
    },
    [toaster]
  );

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-newTextColor p-[20px]">
        You do not have access to this page.
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="flex flex-col gap-[16px] text-newTextColor">
      <div className="flex items-center justify-between">
        <div data-cs className="font-display text-[20px] font-[400] text-newTextColor">
          Errors
        </div>
        <div className="text-[13px] text-newTextColor/60">
          {data ? `${data.total} total` : ''}
        </div>
      </div>

      <ToolbarRow card>
        <ToolbarField label="Platform">
          <ToolbarSelect
            value={platform}
            onChange={(e) => {
              setPage(0);
              setPlatform(e.target.value);
            }}
            className="min-w-[180px]"
          >
            <option value="">All platforms</option>
            {(platforms || []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </ToolbarSelect>
        </ToolbarField>

        <ToolbarField label="Email contains">
          <div className="flex gap-[8px]">
            <ToolbarInput
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onApplyEmail();
              }}
              placeholder="user@example.com"
              className="min-w-[240px]"
            />
            <Button onClick={onApplyEmail}>Apply</Button>
          </div>
        </ToolbarField>

        <label className="flex items-center gap-[6px] text-[13px] cursor-pointer h-[38px]">
          <input
            type="checkbox"
            checked={unknownFirst}
            onChange={(e) => {
              setPage(0);
              setUnknownFirst(e.target.checked);
            }}
          />
          Unknown Error first
        </label>

        <ToolbarField label="Per page">
          <ToolbarSelect
            value={limit}
            onChange={(e) => {
              setPage(0);
              setLimit(parseInt(e.target.value, 10));
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </ToolbarSelect>
        </ToolbarField>

        <Button secondary onClick={onClear}>
          Clear filters
        </Button>
      </ToolbarRow>

      {isLoading ? (
        // table-shaped skeleton (header wash + row bars), never a spinner
        <SkeletonTable rows={8} />
      ) : error ? (
        <div className="text-[#FF3F3F]">Failed to load errors.</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-newTextColor/60">No errors found.</div>
      ) : (
        <DataTable<ErrorRow>
          columns={[
            {
              key: 'created',
              header: 'Created',
              width: '170px',
              render: (row) => new Date(row.createdAt).toLocaleString(),
            },
            {
              key: 'platform',
              header: 'Platform',
              width: '120px',
              render: (row) => (
                <span
                  className={
                    (row.message || '').includes('Unknown Error')
                      ? 'text-[#FF3F3F] font-[550]'
                      : ''
                  }
                >
                  {row.platform}
                </span>
              ),
            },
            {
              key: 'userOrg',
              header: 'User / Org',
              width: '220px',
              cellClassName: 'break-all',
              render: (row) => (
                <>
                  <div>
                    {row.organization?.users
                      ?.map((u) => u.user?.email)
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </div>
                  <div className="text-[12px] text-newTextColor/60">
                    {row.organization?.name}
                  </div>
                </>
              ),
            },
            {
              key: 'message',
              header: 'Message',
              cellClassName:
                'break-all whitespace-pre-wrap font-mono text-[12px]',
              render: (row) =>
                (row.message || '').length > 280
                  ? row.message.slice(0, 280) + '…'
                  : row.message,
            },
            {
              key: 'actions',
              header: 'Actions',
              width: '220px',
              align: 'right',
              cellClassName: 'flex gap-[8px] justify-end phone:justify-start',
              render: (row) => (
                <>
                  <Button secondary onClick={() => openDetails(row)}>
                    View
                  </Button>
                  <Button onClick={() => copyRow(row)}>Copy</Button>
                </>
              ),
            },
          ]}
          rows={data.items}
          rowKey={(row) => row.id}
        />
      )}

      <TablePagination
        page={page}
        totalPages={totalPages}
        hasMore={!!data?.hasMore}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
};
