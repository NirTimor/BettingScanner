'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { API_URL, TOKEN_KEY } from '@/lib/api-config';
import { getInitials } from '@/lib/profile-utils';

interface TopBarProps {
    active?: 'betting' | 'stats' | 'profile' | 'settings';
}

export default function TopBar({ active = 'betting' }: TopBarProps) {
    const t = useTranslations('Nav');
    const locale = useLocale();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [profileName, setProfileName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem(TOKEN_KEY);
            if (!token) return;
            try {
                const res = await fetch(`${API_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data?.user?.email) setEmail(data.user.email);
            } catch {
                // Ignore
            }
        };
        const fetchProfile = async () => {
            const token = localStorage.getItem(TOKEN_KEY);
            if (!token) return;
            try {
                const res = await fetch(`${API_URL}/profile/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data?.profile?.displayName) setProfileName(String(data.profile.displayName));
                if (data?.profile?.avatarUrl) setAvatarUrl(String(data.profile.avatarUrl));
            } catch {
                // Ignore
            }
        };
        fetchUser();
        fetchProfile();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem(TOKEN_KEY);
        router.replace(`/${locale}/login`);
    };

    const displayName = profileName || email || t('user');
    const initials = getInitials(displayName);

    return (
        <div className="sticky top-0 z-40 border-b border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/${locale}/betting`} className="text-sm font-bold text-zinc-900 dark:text-white">
                        <span className="brand-gradient-text">{t('appName')}</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-2">
                        <Link
                            href={`/${locale}/betting`}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active === 'betting'
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            {t('dashboard')}
                        </Link>
                        <Link
                            href={`/${locale}/stats`}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active === 'stats'
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            {t('stats')}
                        </Link>
                        <Link
                            href={`/${locale}/profile`}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active === 'profile'
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            {t('profile')}
                        </Link>
                        <Link
                            href={`/${locale}/settings`}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active === 'settings'
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            {t('settings')}
                        </Link>
                    </nav>
                </div>

                <div className="flex items-center gap-3">
                    <LocaleSwitcher />
                    <div className="relative">
                        <button
                            onClick={() => setMenuOpen((prev) => !prev)}
                            className="flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-200"
                        >
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={displayName}
                                    className="h-7 w-7 rounded-full object-cover"
                                />
                            ) : (
                                <span className="h-7 w-7 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                                    {initials}
                                </span>
                            )}
                            <span className="hidden sm:block">{displayName}</span>
                        </button>
                        {menuOpen ? (
                            <div className="absolute left-0 mt-2 w-48 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-2">
                                <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    {t('signedInAs')}
                                </div>
                                <div className="px-3 pb-2 text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                                    {displayName}
                                </div>
                                <Link
                                    href={`/${locale}/profile`}
                                    className="block w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    {t('profile')}
                                </Link>
                                <Link
                                    href={`/${locale}/settings`}
                                    className="block w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    {t('settings')}
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    {t('logout')}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
