'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';

export default function LocaleSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const switchLocale = (newLocale: string) => {
        startTransition(() => {
            const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
            router.replace(newPathname);
        });
    };

    return (
        <div className="flex gap-2">
            <button
                onClick={() => switchLocale('en')}
                disabled={isPending || locale === 'en'}
                className={`px-3 py-1 rounded text-sm font-medium shadow-sm border ${locale === 'en'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white/80 text-zinc-800 border-zinc-300 hover:bg-white'
                    } dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 disabled:opacity-50`}
            >
                English
            </button>
            <button
                onClick={() => switchLocale('he')}
                disabled={isPending || locale === 'he'}
                className={`px-3 py-1 rounded text-sm font-medium shadow-sm border ${locale === 'he'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white/80 text-zinc-800 border-zinc-300 hover:bg-white'
                    } dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 disabled:opacity-50`}
            >
                עברית
            </button>
        </div>
    );
}
