'use client';

import { FC, useCallback, useState } from 'react';
import clsx from 'clsx';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
const useFaqList = () => {
  const { isGeneral } = useVariables();
  const user = useUser();
  const t = useT();
  return [
    ...(user?.allowTrial
      ? [
          {
            title: t(
              'faq_am_i_going_to_be_charged_by_postiz',
              'Am I going to be charged by Postiz?'
            ),
            description: t(
              'faq_to_confirm_credit_card_information_postiz_will_hold',
              'To confirm credit card information Postiz will hold $2 and release it immediately, you can cancel your subscription anytime from settings without talking to a person'
            ),
          },
        ]
      : []),
    {
      title: t(
        'faq_can_i_trust_postiz_gitroom',
        `Can I trust ${isGeneral ? 'Postiz' : 'Gitroom'}?`
      ),
      description: t(
        'faq_postiz_gitroom_is_proudly_open_source',
        `${
          isGeneral ? 'Postiz' : 'Gitroom'
        } is proudly open-source! We believe in an ethical and transparent culture, meaning that ${
          isGeneral ? 'Postiz' : 'Gitroom'
        } will live forever. You can check out the entire code or use it for personal projects. To view the open-source repository, <a href="https://github.com/gitroomhq/postiz-app" target="_blank" style="text-decoration: underline;">click here</a>.`
      ),
    },
    {
      title: t('faq_what_are_channels', 'What are channels?'),
      description: t(
        'faq_postiz_gitroom_allows_you_to_schedule_posts',
        `${
          isGeneral ? 'Postiz' : 'Gitroom'
        } allows you to schedule your posts between different channels.
A channel is a publishing platform where you can schedule your posts.
For example, you can schedule your posts on X, Facebook, Instagram, TikTok, YouTube, Reddit, Linkedin, Dribbble, Threads and Pinterest.`
      ),
    },
    {
      title: t('faq_what_are_team_members', 'What are team members?'),
      description: t(
        'faq_if_you_have_a_team_with_multiple_members',
        'If you have a team with multiple members, you can invite them to your workspace to collaborate on your posts and add their personal channels'
      ),
    },
  ];
};
export const FAQSection: FC<{
  title: string;
  description: string;
}> = (props) => {
  const { title, description } = props;
  const [show, setShow] = useState(false);
  const changeShow = useCallback(() => {
    setShow(!show);
  }, [show]);
  return (
    <div
      className="bg-sixth p-[24px] border border-tableBorder rounded-[8px] flex flex-col"
      onClick={changeShow}
    >
      <div className={`text-[20px] cursor-pointer flex justify-center`}>
        <div className="flex-1">{title}</div>
        <div className="flex items-center justify-center w-[32px]">
          {!show ? (
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
          ) : (
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
            </svg>
          )}
        </div>
      </div>
      <div
        className={clsx(
          'transition-all duration-500 overflow-hidden',
          !show ? 'max-h-[0]' : 'max-h-[500px]'
        )}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={`mt-[16px] w-full text-wrap font-[400] text-[16px] text-newTextColor/60 select-text max-w-[450px]`}
          dangerouslySetInnerHTML={{
            __html: description,
          }}
        />
      </div>
    </div>
  );
};
export const FAQComponent: FC = () => {
  const t = useT();
  const list = useFaqList();
  return (
    <div>
      <div className="gap-[24px] flex-col flex select-none  mt-[48px] mb-[40px] tablet:mt-[80px]">
        {list.map((item, index) => (
          <FAQSection key={index} {...item} />
        ))}
      </div>
    </div>
  );
};
