import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BLOG_POSTS } from '@/lib/blog-posts';

export default async function BlogPostPage({ params: { locale, slug } }: { params: { locale: string; slug: string } }) {
    const t = await getTranslations('Blog');
    const isHebrew = locale === 'he';
    const post = BLOG_POSTS.find((item) => item.slug === slug);

    if (!post) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <p className="text-zinc-500">Post not found.</p>
            </div>
        );
    }

    const title = post.title[isHebrew ? 'he' : 'en'];
    const content = post.content[isHebrew ? 'he' : 'en'];

    return (
        <div className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isHebrew ? 'text-right' : ''}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            <div className="max-w-3xl mx-auto px-6 py-12">
                <Link
                    href={`/${locale}/blog`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                >
                    ← {t('backToBlog')}
                </Link>
                <div className="rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-6 shadow-sm mt-4">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{post.date}</p>
                    <h1 className="text-3xl font-bold mb-4">{title}</h1>
                    <div className="space-y-4 text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {content.map((paragraph, idx) => (
                            <p key={idx}>{paragraph}</p>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
