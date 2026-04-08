'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { API_URL, TOKEN_KEY } from '@/lib/api-config';
import { getInitials } from '@/lib/profile-utils';
import { getLeagueLabelFromSportKey, translateLeagueLabel, translateTeamName } from '@/lib/team-translations';

type FollowedTeam = { id: string; teamName: string; createdAt: string };
type TeamSuggestion = { name: string };
type UpcomingMatch = {
    id: string;
    sportKey: string;
    homeTeam: string;
    awayTeam: string;
    commenceTime: string;
    matchedTeams: string[];
};

type DropdownRect = { left: number; top: number; width: number };

export default function ProfilePage() {
    const t = useTranslations('Profile');
    const locale = useLocale();
    const router = useRouter();
    const isHebrew = locale === 'he';

    const [loading, setLoading] = useState(true);
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [email, setEmail] = useState('');
    const [teams, setTeams] = useState<FollowedTeam[]>([]);
    const [newTeam, setNewTeam] = useState('');
    const [saving, setSaving] = useState(false);
    const [suggestions, setSuggestions] = useState<TeamSuggestion[]>([]);
    const [suggestOpen, setSuggestOpen] = useState(false);
    const [upcoming, setUpcoming] = useState<UpcomingMatch[]>([]);
    const [upcomingLoading, setUpcomingLoading] = useState(false);
    const debounceRef = useRef<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);

    const getToken = () => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem(TOKEN_KEY) ?? '';
    };

    const fetchWithAuth = async (url: string, init?: RequestInit) => {
        const token = getToken();
        if (!token) return null;
        const res = await fetch(url, {
            ...init,
            headers: {
                ...(init?.headers || {}),
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            router.replace(`/${locale}/login`);
            return null;
        }
        return res;
    };

    const load = async () => {
        if (!getToken()) {
            router.replace(`/${locale}/login`);
            return;
        }
        setLoading(true);
        try {
            const [meRes, folRes] = await Promise.all([
                fetchWithAuth(`${API_URL}/profile/me`),
                fetchWithAuth(`${API_URL}/profile/following`),
            ]);
            if (meRes?.ok) {
                const data = await meRes.json();
                setDisplayName(String(data?.profile?.displayName || ''));
                setAvatarUrl(String(data?.profile?.avatarUrl || ''));
                setEmail(String(data?.user?.email || ''));
            }
            if (folRes?.ok) {
                const data = await folRes.json();
                setTeams(Array.isArray(data?.teams) ? data.teams : []);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadUpcoming = async () => {
        if (!getToken()) return;
        setUpcomingLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/profile/upcoming?days=14`);
            if (res?.ok) {
                const data = await res.json();
                setUpcoming(Array.isArray(data?.matches) ? data.matches : []);
            }
        } finally {
            setUpcomingLoading(false);
        }
    };

    useEffect(() => {
        load();
        loadUpcoming();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initials = getInitials(displayName || email || t('userFallback'));

    const handleFollow = async () => {
        const name = newTeam.trim();
        if (!name) return;
        setSaving(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/profile/following`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamName: name }),
            });
            if (res?.ok) {
                setNewTeam('');
                setSuggestOpen(false);
                setSuggestions([]);
                await load();
                await loadUpcoming();
            }
        } finally {
            setSaving(false);
        }
    };

    const handleUnfollow = async (id: string) => {
        setSaving(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/profile/following/${id}`, { method: 'DELETE' });
            if (res?.ok) {
                await load();
                await loadUpcoming();
            }
        } finally {
            setSaving(false);
        }
    };

    const fetchSuggestions = async (q: string) => {
        const term = q.trim();
        if (term.length < 2) {
            setSuggestions([]);
            return;
        }
        const res = await fetchWithAuth(`${API_URL}/profile/team-suggestions?q=${encodeURIComponent(term)}`);
        if (!res || !res.ok) return;
        const data = await res.json();
        setSuggestions(Array.isArray(data?.options) ? data.options : []);
    };

    const computeDropdownRect = () => {
        const el = inputRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setDropdownRect({
            left: rect.left,
            top: rect.bottom + 4,
            width: rect.width,
        });
    };

    const handleInputChange = (val: string) => {
        setNewTeam(val);
        setSuggestOpen(true);
        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }
        debounceRef.current = window.setTimeout(() => {
            fetchSuggestions(val);
        }, 250);
    };

    useEffect(() => {
        if (!suggestOpen) return;
        computeDropdownRect();
        const onScroll = () => computeDropdownRect();
        const onResize = () => computeDropdownRect();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [suggestOpen, suggestions.length]);

    const dropdown = useMemo(() => {
        if (!suggestOpen || suggestions.length === 0 || !dropdownRect) return null;
        if (typeof document === 'undefined') return null;

        return createPortal(
            <div
                className="fixed z-[1000] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                style={{
                    left: dropdownRect.left,
                    top: dropdownRect.top,
                    width: dropdownRect.width,
                }}
            >
                {suggestions.map((opt) => (
                    <button
                        key={opt.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            setNewTeam(opt.name);
                            setSuggestOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        {translateTeamName(opt.name, locale)}
                        {locale === 'he' && translateTeamName(opt.name, locale) !== opt.name ? (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400"> ({opt.name})</span>
                        ) : null}
                    </button>
                ))}
            </div>,
            document.body,
        );
    }, [suggestOpen, suggestions, dropdownRect, locale]);

    return (
        <div className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isHebrew ? 'text-right' : ''}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            <TopBar active="profile" />
            <div className="max-w-5xl mx-auto px-6 py-10">
                <div className="rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 p-6 mb-6 shadow-sm">
                    <h1 className="text-3xl font-bold">{t('title')}</h1>
                    <p className="text-zinc-600 dark:text-zinc-300">{t('subtitle')}</p>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-6 shadow-sm mb-6">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex items-center justify-center text-sm font-semibold text-zinc-700 dark:text-zinc-200 shrink-0">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={displayName || email} className="h-14 w-14 object-cover" />
                            ) : (
                                initials
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {displayName || t('noDisplayName')}
                            </div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                                {email || t('noEmail')}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                        {t('editHint')}
                        {' '}
                        <a href={`/${locale}/settings`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {t('goToSettings')}
                        </a>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-6 shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-lg font-semibold">{t('followTitle')}</h2>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('followHint')}</p>
                        </div>
                        <div className="flex items-center gap-2 relative z-50">
                            <div className="relative z-50">
                                <input
                                    ref={inputRef}
                                    value={newTeam}
                                    onChange={(e) => handleInputChange(e.target.value)}
                                    onFocus={() => {
                                        setSuggestOpen(true);
                                        setTimeout(() => computeDropdownRect(), 0);
                                    }}
                                    onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
                                    placeholder={t('teamPlaceholder')}
                                    className="w-64 max-w-[70vw] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleFollow}
                                disabled={saving || !newTeam.trim()}
                                className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? t('saving') : t('follow')}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('loading')}</div>
                    ) : teams.length === 0 ? (
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('noFollowedTeams')}</div>
                    ) : (
                        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {teams.map((team) => (
                                <li key={team.id} className="py-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{team.teamName}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {t('followedAt', { date: new Date(team.createdAt).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB') })}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleUnfollow(team.id)}
                                        disabled={saving}
                                        className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                                    >
                                        {t('unfollow')}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="relative z-0 mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-1">{t('upcomingTitle')}</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">{t('upcomingHint')}</p>

                    {upcomingLoading ? (
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('loading')}</div>
                    ) : upcoming.length === 0 ? (
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('noUpcoming')}</div>
                    ) : (
                        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {upcoming.slice(0, 30).map((m) => {
                                const league = translateLeagueLabel(getLeagueLabelFromSportKey(m.sportKey), locale);
                                const home = translateTeamName(m.homeTeam, locale);
                                const away = translateTeamName(m.awayTeam, locale);
                                const when = new Date(m.commenceTime);
                                return (
                                    <li key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                {home} {t('vs')} {away}
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {league}
                                                {' · '}
                                                {when.toLocaleString(locale === 'he' ? 'he-IL' : 'en-GB')}
                                            </div>
                                        </div>
                                        <div className="text-xs text-blue-700 dark:text-blue-300">
                                            {t('matchedTeams', { teams: m.matchedTeams.map((x) => translateTeamName(x, locale)).join(', ') })}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
            {dropdown}
        </div>
    );
}

