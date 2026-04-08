'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { API_URL, TOKEN_KEY } from '@/lib/api-config';

export default function SignupPage() {
    const t = useTranslations('Auth');
    const locale = useLocale();
    const router = useRouter();
    const isHebrew = locale === 'he';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
            router.replace(`/${locale}/betting`);
        }
    }, [locale, router]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.message || t('signupFailed'));
                return;
            }
            localStorage.setItem(TOKEN_KEY, data.token);
            router.replace(`/${locale}/betting`);
        } catch (err) {
            setError(t('signupFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 ${isHebrew ? 'text-right' : ''}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('signupTitle')}</h1>
                    <LocaleSwitcher />
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">{t('signupSubtitle')}</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                            {t('email')}
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                            {t('password')}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {error ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    ) : null}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? t('creatingAccount') : t('signup')}
                    </button>
                </form>

                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                    {t('haveAccount')}{' '}
                    <button
                        onClick={() => router.push(`/${locale}/login`)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        {t('goToLogin')}
                    </button>
                </p>
            </div>
        </div>
    );
}
