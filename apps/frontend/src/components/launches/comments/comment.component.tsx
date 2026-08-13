import { FC, Fragment, useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Textarea } from '@gitroom/react/form/textarea';
import { Button } from '@gitroom/react/form/button';
import clsx from 'clsx';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Input } from '@gitroom/react/form/input';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { ModalCloseButton } from '@gitroom/frontend/components/cuesoft/modal/modal-close-button';
export const CommentBox: FC<{
  value?: string;
  type: 'textarea' | 'input';
  onChange: (comment: string) => void;
}> = (props) => {
  const { value, onChange, type } = props;
  const Component = type === 'textarea' ? Textarea : Input;
  const [newComment, setNewComment] = useState(value || '');
  const newCommentFunc = useCallback(
    (event: {
      target: {
        value: string;
      };
    }) => {
      setNewComment(event.target.value);
    },
    [newComment]
  );
  const changeIt = useCallback(() => {
    onChange(newComment);
    setNewComment('');
  }, [newComment]);
  return (
    <div
      className={clsx(
        'flex',
        type === 'textarea' ? 'flex-col' : 'flex-row flex items-end gap-[10px]'
      )}
    >
      <div className={clsx(type === 'input' && 'flex-1')}>
        <Component
          label={type === 'textarea' ? 'Add comment' : ''}
          placeholder={type === 'input' ? 'Add comment' : ''}
          name="comment"
          disableForm={true}
          value={newComment}
          onChange={newCommentFunc}
        />
      </div>
      <Button
        disabled={newComment.length < 2}
        onClick={changeIt}
        className={clsx(type === 'input' && 'mb-[27px]')}
      >
        {value ? 'Update' : 'Add comment'}
      </Button>
    </div>
  );
};
interface Comments {
  id: string;
  content: string;
  user: {
    email: string;
    id: string;
  };
  childrenComment: Comments[];
}
export const EditableCommentComponent: FC<{
  comment: Comments;
  onEdit: (content: string) => void;
  onDelete: () => void;
}> = (props) => {
  const { comment, onEdit, onDelete } = props;
  const [commentContent, setCommentContent] = useState(comment.content);
  const [editMode, setEditMode] = useState(false);
  const user = useUser();
  const updateComment = useCallback((commentValue: string) => {
    if (commentValue !== comment.content) {
      setCommentContent(commentValue);
      onEdit(commentValue);
    }
    setEditMode(false);
  }, []);
  const deleteCommentFunction = useCallback(async () => {
    if (
      await deleteDialog(
        'Are you sure you want to delete this comment?',
        'Yes, Delete'
      )
    ) {
      onDelete();
    }
  }, []);
  if (editMode) {
    return (
      <CommentBox
        type="input"
        value={commentContent}
        onChange={updateComment}
      />
    );
  }
  return (
    <div className="flex gap-[5px]">
      <pre className="text-wrap">{commentContent}</pre>
      {user?.id === comment.user.id && (
        <>
          <svg
            onClick={() => setEditMode(!editMode)}
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
            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
          </svg>

          <svg
            onClick={deleteCommentFunction}
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
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </>
      )}
    </div>
  );
};
export const CommentComponent: FC<{
  postId: string;
  /**
   * Optional, because `Post.publishDate` is nullable now: an undated draft is a
   * captured idea with no slot committed yet, and comments on it are exactly as
   * useful as comments on a scheduled post.
   *
   * While this was required, the calendar had to SUPPRESS the comments trigger
   * for a dateless post rather than fabricate a date for the heading (see the
   * `if (!post.publishDate) return;` guards in calendar.tsx). Undefined, null
   * and an Invalid Date all mean the same thing here and all take the plain
   * heading.
   */
  date?: dayjs.Dayjs | null;
}> = (props) => {
  const { postId, date } = props;
  const { closeAll } = useModals();
  const [commentsList, setCommentsList] = useState<Comments[]>([]);
  const user = useUser();
  const fetch = useFetch();
  const load = useCallback(async () => {
    const data = await (await fetch(`/posts/${postId}/comments`)).json();
    // defensive: an error payload is an object, not an array
    const list = Array.isArray(data?.comments)
      ? data.comments
      : Array.isArray(data)
      ? data
      : [];
    setCommentsList(list);
  }, [postId]);
  useEffect(() => {
    load();
  }, []);
  const addComment = useCallback(
    async (content: string) => {
      const added = await (
        await fetch(`/posts/${postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ comment: content }),
        })
      ).json();
      setCommentsList((list) => [
        ...list,
        {
          id: added?.id || `local-${list.length}`,
          user: {
            email: user?.email!,
            id: user?.id!,
          },
          content,
          childrenComment: [],
        },
      ]);
    },
    [postId, user]
  );
  const extractNameFromEmailAndCapitalize = useCallback((email: string) => {
    return (email.split('@')[0] || '')
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, []);
  return (
    <div className="relative flex gap-[20px] flex-col flex-1 rounded-[8px] border border-newTableBorder bg-newBgColorInner p-[16px] pt-0">
      {/* The date is a SUFFIX, so it simply falls away when there is none —
          the heading still names what the sheet is. `isValid()` is part of the
          test because dayjs.utc(null) is an Invalid Date object, which is truthy
          and would format as the literal 'Invalid Date'. */}
      <TopTitle
        title={
          date?.isValid()
            ? `Comments · ${date.format('MMM D, h:mm A')}`
            : 'Comments'
        }
      />
      <ModalCloseButton onClick={closeAll} offset={{ top: 15 }} />

      <div className="flex flex-col gap-[16px]">
        {commentsList.map((comment, index) => (
          <div
            key={`comment_${index}_${comment.id}`}
            className="flex gap-[10px]"
          >
            <div className="w-[32px] shrink-0">
              <div className="rounded-full text-newTextColor text-[14px] font-[550] flex justify-center items-center w-[32px] h-[32px] bg-newTableHeader border border-newTableBorder">
                {comment.user?.email?.[0]?.toUpperCase()}
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-[2px] min-w-0">
              <div className="text-[14px] font-[550] text-newTextColor">
                {(comment.user as any)?.name ||
                  extractNameFromEmailAndCapitalize(comment.user?.email || '')}
              </div>
              <pre className="text-wrap font-sans text-[14px] text-newTextColor/80">
                {comment.content}
              </pre>
            </div>
          </div>
        ))}
        <CommentBox type="textarea" onChange={addComment} />
      </div>
    </div>
  );
};
