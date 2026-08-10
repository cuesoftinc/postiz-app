'use client';

import { FC } from 'react';
import { StarsAndForksInterface } from '@gitroom/frontend/components/analytics/stars.and.forks.interface';
import { Chart } from '@gitroom/frontend/components/analytics/chart';
import { UtcToLocalDateRender } from '@gitroom/react/helpers/utc.date.render';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
export const StarsAndForks: FC<StarsAndForksInterface> = (props) => {
  const { list } = props;
  const t = useT();
  return (
    <>
      {list.map((item) => (
        <div className="flex gap-[24px] h-[272px]" key={item.login}>
          <div className="flex-1 bg-secondary py-[10px] px-[16px] flex flex-col">
            <div className="flex items-center gap-[14px]">
              <div className="bg-fifth p-[8px]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
                </svg>
              </div>
              <div className="text-[20px]">
                {item.login
                  .split('/')[1]
                  .split('')
                  .map((char, index) =>
                    index === 0 ? char.toUpperCase() : char
                  )
                  .join('')}
                {t('stars', 'Stars')}
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="absolute w-full h-full start-0 top-0">
                {item.stars.length ? (
                  <Chart list={item.stars} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    {t('processing_stars', 'Processing stars...')}
                  </div>
                )}
              </div>
            </div>
            <div className="text-[50px] leading-[60px]">
              {item?.stars[item.stars.length - 1]?.totalStars}
            </div>
          </div>

          <div className="flex-1 bg-secondary py-[10px] px-[16px] flex flex-col">
            <div className="flex items-center gap-[14px]">
              <div className="bg-fifth p-[8px]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
                  <path d="M12 12v3" />
                </svg>
              </div>
              <div className="text-[20px]">
                {item.login
                  .split('/')[1]
                  .split('')
                  .map((char, index) =>
                    index === 0 ? char.toUpperCase() : char
                  )
                  .join('')}
                {t('forks', 'Forks')}
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="absolute w-full h-full start-0 top-0">
                {item.forks.length ? (
                  <Chart list={item.forks} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    {t('processing_stars', 'Processing stars...')}
                  </div>
                )}
              </div>
            </div>
            <div className="text-[50px] leading-[60px]">
              {item?.forks[item.forks.length - 1]?.totalForks}
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-[24px]">
        {[0, 1].map((p) => (
          <div
            key={p}
            className="flex-1 bg-secondary py-[24px] px-[16px] gap-[16px] flex flex-col"
          >
            <div className="flex items-center gap-[14px]">
              <div className="p-[8px] bg-fifth">
                {p === 0 ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 7h6v6" />
                    <path d="m22 7-8.5 8.5-5-5L2 16" />
                  </svg>
                )}
              </div>
              <div className="text-[20px]">
                {p === 0
                  ? t('last_github_trending', 'Last Github Trending')
                  : t('next_predicted_github_trending', 'Next Predicted GitHub Trending')}
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-[2px] h-[30px] bg-customColor11 me-[16px]"></div>
              <div className="text-[24px] flex-1">
                <UtcToLocalDateRender
                  date={
                    p === 0 ? props.trending.last : props.trending.predictions
                  }
                  format="dddd"
                />
              </div>
              <div
                className={clsx(
                  'text-[24px]',
                  p === 0 ? 'text-customColor12' : 'text-customColor13'
                )}
              >
                <UtcToLocalDateRender
                  date={
                    p === 0 ? props.trending.last : props.trending.predictions
                  }
                  format="DD MMM YYYY"
                />
              </div>
              <div>
                <div className="rounded-full bg-customColor14 w-[5px] h-[5px] mx-[8px]" />
              </div>
              <div
                className={clsx(
                  'text-[24px]',
                  p === 0 ? 'text-customColor12' : 'text-customColor13'
                )}
              >
                <UtcToLocalDateRender
                  date={
                    p === 0 ? props.trending.last : props.trending.predictions
                  }
                  format="HH:mm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
