import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BLOG_POSTS } from '@/lib/blog-posts';

export default async function BlogPage({ params: { locale } }: { params: { locale: string } }) {
    const t = await getTranslations('Blog');
    const isHebrew = locale === 'he';

    return (
        <div className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isHebrew ? 'text-right' : ''}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            <div className="max-w-5xl mx-auto px-6 py-12">
                <div className="rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-6 shadow-sm mb-8">
                    <h1 className="text-3xl font-bold">{t('title')}</h1>
                    <p className="text-zinc-600 dark:text-zinc-300">{t('subtitle')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {BLOG_POSTS.map((post) => (
                        <Link
                            key={post.slug}
                            href={`/${locale}/blog/${post.slug}`}
                            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{post.date}</p>
                            <h2 className="text-lg font-semibold mb-2">{post.title[locale === 'he' ? 'he' : 'en']}</h2>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                {post.excerpt[locale === 'he' ? 'he' : 'en']}
                            </p>
                            <span className="mt-4 inline-flex text-sm text-blue-600">{t('readMore')}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
