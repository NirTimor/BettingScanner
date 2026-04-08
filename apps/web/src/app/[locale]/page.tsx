import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function LocaleIndex({ params: { locale } }: { params: { locale: string } }) {
    const t = await getTranslations('Home');
    const isHebrew = locale === 'he';

    return (
        <div className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isHebrew ? 'text-right' : ''}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            <div className="max-w-5xl mx-auto px-6 py-16">
                <div className="rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-10 shadow-sm">
                    <p className="text-sm uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">
                        {t('eyebrow')}
                    </p>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        {t('title')}
                    </h1>
                    <p className="text-lg text-zinc-600 dark:text-zinc-300 mb-8">
                        {t('subtitle')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                            href={`/${locale}/signup`}
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
                        >
                            {t('ctaPrimary')}
                        </Link>
                        <Link
                            href={`/${locale}/login`}
                            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 px-6 py-3 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            {t('ctaSecondary')}
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                    {[0, 1, 2].map((idx) => (
                        <div key={idx} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                            <h3 className="text-lg font-semibold mb-2">{t(`feature${idx + 1}Title`)}</h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">{t(`feature${idx + 1}Text`)}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-12 rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-8 shadow-sm">
                    <h2 className="text-2xl font-bold mb-6">{t('sectionHowTitle')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((step) => (
                            <div key={step} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">{`0${step}`}</p>
                                <h3 className="text-lg font-semibold mb-2">{t(`step${step}Title`)}</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">{t(`step${step}Text`)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-12 rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-8 shadow-sm">
                    <h2 className="text-2xl font-bold mb-6">{t('sectionTrustTitle')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                                <h3 className="text-lg font-semibold mb-2">{t(`trust${item}Title`)}</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">{t(`trust${item}Text`)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-12 rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">{t('sectionBlogTitle')}</h2>
                        <Link
                            href={`/${locale}/blog`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                            {t('sectionBlogCta')}
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                                <h3 className="text-lg font-semibold mb-2">{t(`feature${item}Title`)}</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">{t(`feature${item}Text`)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-12 rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-8 shadow-sm">
                    <h2 className="text-2xl font-bold mb-6">{t('sectionFaqTitle')}</h2>
                    <div className="space-y-4">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                                <h3 className="text-lg font-semibold mb-2">{t(`faq${item}Q`)}</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">{t(`faq${item}A`)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
