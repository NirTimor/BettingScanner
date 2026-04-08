'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { API_URL } from '@/lib/api-config';

export default function ForgotPasswordPage() {
    const t = useTranslations('Auth');
    const locale = useLocale();
    const router = useRouter();
    const isHebrew = locale === 'he';
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setToken('');
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/forgot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.message || t('forgotFailed'));
                return;
            }
            setMessage(t('forgotSuccess'));
            if (data?.token) {
                setToken(data.token);
            }
        } catch (err) {
            setError(t('forgotFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 ${isHebrew ? 'text-right' : ''}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('forgotTitle')}</h1>
                    <LocaleSwitcher />
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">{t('forgotSubtitle')}</p>

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

                    {error ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    ) : null}
                    {message ? (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
                    ) : null}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? t('sending') : t('sendReset')}
                    </button>
                </form>

                {token ? (
                    <div className="mt-4 rounded-lg border border-dashed border-blue-200 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-900/20 p-3">
                        <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">{t('resetTokenNote')}</p>
                        <code className="block text-xs break-all text-blue-800 dark:text-blue-200">{token}</code>
                        <button
                            onClick={() => router.push(`/${locale}/reset-password?token=${token}`)}
                            className="mt-3 text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
                        >
                            {t('goToReset')}
                        </button>
                    </div>
                ) : null}

                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                    {t('backToLogin')}{' '}
                    <button
                        onClick={() => router.push(`/${locale}/login`)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        {t('login')}
                    </button>
                </p>
            </div>
        </div>
    );
}
