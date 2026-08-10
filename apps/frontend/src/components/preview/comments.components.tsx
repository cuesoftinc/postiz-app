'use client';

import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Button } from '@gitroom/react/form/button';
import { FC, useCallback, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
export const RenderComponents: FC<{
  postId: string;
}> = (props) => {
  const { postId } = props;
  const fetch = useFetch();
  const comments = useCallback(async () => {
    return (await fetch(`/public/posts/${postId}/comments`)).json();
  }, [postId]);
  const { data, mutate, isLoading } = useSWR('comments', comments);
  const mapUsers = useMemo(() => {
    return (data?.comments || []).reduce(
      (all: any, current: any) => {
        all.users[current.userId] = all.users[current.userId] || all.counter++;
        return all;
      },
      {
        users: {},
        counter: 1,
      }
    ).users;
  }, [data]);
  const { handleSubmit, register, setValue } = useForm();
  const submit: SubmitHandler<FieldValues> = useCallback(
    async (e) => {
      setValue('comment', '');
      await fetch(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify(e),
      });
      mutate();
    },
    [postId, mutate]
  );

  const t = useT();

  if (isLoading) {
    return <></>;
  }
  return (
    <>
      <div className="mb-[16px] flex">
        <form
          className="flex flex-1 flex-col gap-[8px]"
          onSubmit={handleSubmit(submit)}
        >
          <textarea
            {...register('comment', {
              required: true,
            })}
            className="flex h-[98px] min-h-[80px] w-full resize-none rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[12px] py-[8px] text-[14px] text-newTextColor outline-none placeholder:text-newTextColor/50 focus:border-forth disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Add a comment..."
            defaultValue={''}
          />
          <div className="flex justify-end">
            <Button type="submit">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={24}
                height={24}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-send me-2 h-4 w-4"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
              {t('post', 'Post')}
            </Button>
          </div>
        </form>
      </div>
      <div className="flex flex-col">
        {!!data.comments.length && (
          <h3 className="mb-[12px] text-[16px] font-[550] text-newTextColor">
            {t('comments', 'Comments')}
          </h3>
        )}
        {data.comments.map((comment: any) => (
          <div
            key={comment.id}
            className="flex border-t border-newTableBorder py-[12px]"
          >
            <div className="flex flex-1 flex-col gap-[4px]">
              <div className="flex items-center">
                <h3 className="text-[14px] font-[550] text-newTextColor">
                  {t('user', 'User')}
                  {mapUsers[comment.userId]}
                </h3>
              </div>
              <p className="whitespace-pre-wrap text-[14px] text-newTextColor">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
export const CommentsComponents: FC<{
  postId: string;
}> = (props) => {
  const user = useUser();
  const t = useT();

  const { postId } = props;
  const goToComments = useCallback(() => {
    window.location.href = `/auth?returnUrl=${window.location.href}`;
  }, []);
  if (!user?.id) {
    return (
      <Button onClick={goToComments}>
        {t(
          'login_register_to_add_comments',
          'Login / Register to add comments'
        )}
      </Button>
    );
  }
  return <RenderComponents postId={postId} />;
};
