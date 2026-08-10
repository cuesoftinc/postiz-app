'use client';

import { Button } from '@gitroom/react/form/button';
import React, { FC } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { PostComment } from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
export const AddPostButton: FC<{
  onClick: () => void;
  num: number;
  postComment: PostComment;
}> = (props) => {
  const { onClick, num } = props;
  const t = useT();

  return (
    <div className="flex">
      <div
        onClick={onClick}
        className="select-none cursor-pointer h-[36px] rounded-[6px] flex border border-newTableBorder hover:bg-boxHover text-newTextColor gap-[8px] justify-center items-center ps-[16px] pe-[16px] text-[13px] font-[600] mt-[12px]"
      >
        <div>
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
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </div>
        <div>
          {t(
            ...(props.postComment === PostComment.ALL
              ? ['add_comment_or_post', 'Add comment or post']
              : props.postComment === PostComment.POST
              ? ['add_post', 'Add post']
              : ['add_comment', 'Add comment'])
          )}
        </div>
      </div>
    </div>
  );
};
