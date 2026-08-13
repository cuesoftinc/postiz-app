import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import { sanitizePostContent } from '@gitroom/helpers/utils/sanitize.post.content';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import Link from 'next/link';
import { CommentsComponents } from '@gitroom/frontend/components/preview/comments.components';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { CopyClient } from '@gitroom/frontend/components/preview/copy.client';
import { getT } from '@gitroom/react/translation/get.translation.service.backend';
import { RenderPreviewDateClient } from '@gitroom/frontend/components/preview/render.preview.date.client';
import { CreationMethodBadge } from '@gitroom/frontend/components/launches/creation.method.badge';

dayjs.extend(utc);
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Cuesoft' : 'Gitroom'} Preview`,
  description: '',
};
export default async function Auth(
  props: {
    params: Promise<{
      id: string;
    }>;
    searchParams?: Promise<{
      share?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const {
    id
  } = params;

  const post = await (await internalFetch(`/public/posts/${id}`)).json();
  const t = await getT();
  if (!post.length) {
    return (
      <div
        data-cs
        className="fixed start-0 top-0 flex h-full w-full items-center justify-center text-[20px] text-newTextColor"
      >
        {t('post_not_found', 'Post not found')}
      </div>
    );
  }
  return (
    <div>
      {/* page chrome: brand row (theme-aware mark + Fustat wordmark, the
          sidebar brand rule) + share action + muted publication date */}
      <div className="mx-auto w-full max-w-[1346px] px-[16px] py-[12px]">
        <div className="flex flex-wrap items-center justify-between gap-[12px]">
          <Link href="/" className="flex items-center">
            <img
              src="/cuesoft-mark-white.png"
              alt=""
              width={28}
              height={28}
              className="hidden dark:block object-contain"
            />
            <img
              src="/cuesoft-mark-primary.png"
              alt=""
              width={28}
              height={28}
              className="block dark:hidden object-contain"
            />
            <span className="ms-[8px] [font-family:var(--font-fustat)] text-[20px] font-[700] leading-none text-newTextColor">
              cuesoft
            </span>
          </Link>
          <div className="flex items-center gap-[16px]">
            {!!searchParams?.share && (
              <div>
                <CopyClient />
              </div>
            )}
            {/* `publishDate` is nullable now (undated drafts), and this page is
                a PUBLIC share link — the route sits outside the auth middleware
                on purpose, so whatever renders here is what an outsider sees.
                Formatting a null gave the literal 'Invalid Date', so the whole
                labelled row is dropped for a dateless post and replaced with a
                plain statement of the fact. Omitting the label too, rather than
                pairing it with a value, keeps it from reading as a formatting
                failure. */}
            <div className="text-[14px] text-textItemBlur">
              {post[0].publishDate ? (
                <>
                  {t('publication_date', 'Publication Date:')}{' '}
                  <RenderPreviewDateClient date={post[0].publishDate} />
                </>
              ) : (
                t('no_publication_date', 'No date set')
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1346px] gap-[16px] px-[16px] pb-[32px] phone:flex-col">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-[16px]">
            {post.map((p: any, index: number) => (
              <div
                key={String(p.id)}
                className="relative rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[16px]"
              >
                <div className="flex gap-[12px]">
                  <div>
                    {/* avatar + surface-ringed platform badge (kit pattern) */}
                    <div className="relative h-[40px] w-[40px] shrink-0">
                      <img
                        className="relative z-[2] h-full w-full rounded-full bg-newTableHeader object-cover"
                        alt={post[0].integration.name}
                        src={post[0].integration.picture}
                      />
                      <img
                        className="absolute -bottom-[5px] -end-[5px] z-[10] h-[20px] w-[20px] rounded-full border border-newBgColorInner bg-newBgColorInner"
                        alt={post[0].integration.providerIdentifier}
                        src={`/icons/platforms/${post[0].integration.providerIdentifier}.png`}
                      />
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
                    <div className="flex items-center gap-[8px]">
                      <h2 className="text-[14px] font-[550] text-newTextColor">
                        {post[0].integration.name}
                      </h2>
                      <span className="text-[14px] text-newTextColor/60">
                        @{post[0].integration.profile}
                      </span>
                      {index === 0 && (
                        <CreationMethodBadge
                          creationMethod={p.creationMethod}
                          size="md"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-[16px]">
                      <div
                        className="whitespace-pre-wrap text-[14px] text-newTextColor"
                        dangerouslySetInnerHTML={{
                          __html: sanitizePostContent(p.content),
                        }}
                      />
                      <div className="flex w-full gap-[10px]">
                        {JSON.parse(p?.image || '[]').map((p: any) => (
                          <div
                            key={p.name}
                            className="max-h-[500px] flex-1 overflow-hidden rounded-[8px]"
                          >
                            <VideoOrImage
                              isContain={true}
                              src={p.path}
                              autoplay={true}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-[360px] shrink-0 phone:w-full">
          <div className="rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[16px]">
            <CommentsComponents postId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
