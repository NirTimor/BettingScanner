'use client';

import { useMemo, useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BettingCard } from '@/components/betting/betting-card';
import Sparkline from '@/components/Sparkline';
import TopBar from '@/components/TopBar';
import { API_URL, TOKEN_KEY } from '@/lib/api-config';
import { getLeagueLabelFromSportKey, translateEventTitle, translateLeagueLabel, translateSelection, translateTeamName } from '@/lib/team-translations';

interface Recommendation {
    id: string;
    sportKey: string;
    eventTitle: string;
    homeTeam: string;
    awayTeam: string;
    commenceTime: string;
    marketKey: string;
    selection: string;
    odds: string;
    bookmaker: string;
    analysis: string;
    confidenceScore?: number;
    predictionLabel?: string;
    aiAnalysis?: string;
    resultHomeScore?: number | null;
    resultAwayScore?: number | null;
    resultOutcome?: string | null;
    isHit?: boolean | null;
}

interface AccuracySummary {
    total: number;
    graded: number;
    hits: number;
    hitRate: number;
}

interface LiveScore {
    homeScore: number;
    awayScore: number;
    status: string;
}

interface RecentResults {
    form: string;
    matches: Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }>;
}

export default function BettingPage() {
    const t = useTranslations('Betting');
    const locale = useLocale();
    const isHebrew = locale === 'he';
    const router = useRouter();
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [accuracy, setAccuracy] = useState<AccuracySummary | null>(null);
    const [liveScores, setLiveScores] = useState<Record<string, LiveScore>>({});
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [openInfoId, setOpenInfoId] = useState<string | null>(null);
    const [scanStatus, setScanStatus] = useState<'success' | 'error' | null>(null);
    const [recentById, setRecentById] = useState<Record<string, {
        homeRecent?: RecentResults | null;
        awayRecent?: RecentResults | null;
        h2hRecent?: Array<{ homeName: string; awayName: string; homeScore: number; awayScore: number; winner: string | null }> | null;
        sources?: { home?: string; away?: string; h2h?: string };
        reasons?: { home?: string | null; away?: string | null; h2h?: string | null };
        status?: 'loading' | 'ready' | 'error'
    }>>({});
    const [authReady, setAuthReady] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSport, setSelectedSport] = useState('all');
    const [selectedBookmaker, setSelectedBookmaker] = useState('all');
    const [minConfidence, setMinConfidence] = useState('all');
    const [showGradedOnly, setShowGradedOnly] = useState(false);
    const [showHitsOnly, setShowHitsOnly] = useState(false);
    const [preferredSports, setPreferredSports] = useState<string[]>([]);
    const [onlyPreferred, setOnlyPreferred] = useState(false);
    const [defaultOnlyPreferred, setDefaultOnlyPreferred] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [refreshSuccess, setRefreshSuccess] = useState(false);

    const getToken = () => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem(TOKEN_KEY) ?? '';
    };

    const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
        const token = getToken();
        if (!token) return null;
        const res = await fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
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

    const getTodayKey = () => {
        const now = new Date();
        const pad = (val: number) => val.toString().padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    };

    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            setFetchError('');
            const res = await fetchWithAuth(`${API_URL}/betting/recommendations?date=${getTodayKey()}`);
            if (!res) {
                setFetchError(t('fetchError'));
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setRecommendations(data);
            } else {
                setFetchError(t('fetchError'));
            }
        } catch (error) {
            console.error('Failed to fetch recommendations', error);
            setFetchError(t('fetchError'));
        } finally {
            setLoading(false);
        }
    };

    const fetchAccuracy = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/betting/accuracy?date=${getTodayKey()}`);
            if (!res) return;
            if (res.ok) {
                const data = await res.json();
                setAccuracy(data);
            }
        } catch (error) {
            console.error('Failed to fetch accuracy', error);
        }
    };

    const fetchLiveScores = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/betting/live-scores?date=${getTodayKey()}`);
            if (!res) return;
            if (res.ok) {
                const data = await res.json();
                setLiveScores(data || {});
            }
        } catch (error) {
            console.error('Failed to fetch live scores', error);
        }
    };

    const handleScan = async () => {
        try {
            setScanning(true);
            setScanStatus(null);
            const res = await fetchWithAuth(`${API_URL}/betting/scan`, { method: 'POST' });
            if (!res || !res.ok) {
                setScanStatus('error');
                return;
            }
            setTimeout(() => {
                fetchRecommendations();
                fetchAccuracy();
                fetchLiveScores();
                setScanStatus('success');
            }, 2000);
        } catch (error) {
            console.error('Scan failed', error);
            setScanStatus('error');
        } finally {
            setScanning(false);
        }
    };

    const handleToggleInfo = (id: string) => {
        setOpenInfoId((current) => (current === id ? null : id));
    };

    const handleRefresh = async () => {
        setFetchError('');
        setRefreshSuccess(false);
        await Promise.all([fetchRecommendations(), fetchAccuracy(), fetchLiveScores()]);
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 2000);
    };

    const handleSaveResult = async (payload: { recommendationId: string; homeScore: number; awayScore: number }) => {
        const res = await fetchWithAuth(`${API_URL}/betting/results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res || !res.ok) return;
        await Promise.all([fetchRecommendations(), fetchAccuracy()]);
    };

    useEffect(() => {
        const token = getToken();
        if (!token) {
            router.replace(`/${locale}/login`);
            return;
        }
        setAuthReady(true);
    }, [locale, router]);

    useEffect(() => {
        const stored = localStorage.getItem('preferredSports');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setPreferredSports(parsed);
                }
            } catch {
                // ignore
            }
        }
        const storedOnly = localStorage.getItem('preferredSportsOnly');
        if (storedOnly === 'true') {
            setOnlyPreferred(true);
            setDefaultOnlyPreferred(true);
        }
    }, []);

    useEffect(() => {
        if (!authReady) return;
        fetchRecommendations();
        fetchAccuracy();
        fetchLiveScores();
    }, [authReady]);

    useEffect(() => {
        if (!authReady || !openInfoId) return;
        const rec = recommendations.find(r => r.id === openInfoId);
        if (!rec) return;
        if (recentById[openInfoId]) return;

        const fetchRecent = async () => {
            try {
                setRecentById((prev) => ({ ...prev, [openInfoId]: { status: 'loading' } }));
                const params = new URLSearchParams({
                    homeTeam: rec.homeTeam,
                    awayTeam: rec.awayTeam,
                    sportKey: rec.sportKey,
                });
                const res = await fetchWithAuth(`${API_URL}/betting/recent-results?${params.toString()}`);
                if (!res) return;
                if (res.ok) {
                    const data = await res.json();
                    setRecentById((prev) => ({ ...prev, [openInfoId]: { ...data, status: 'ready' } }));
                } else {
                    setRecentById((prev) => ({ ...prev, [openInfoId]: { status: 'error' } }));
                }
            } catch (error) {
                console.error('Failed to fetch recent results', error);
                setRecentById((prev) => ({ ...prev, [openInfoId]: { status: 'error' } }));
            }
        };

        fetchRecent();
    }, [authReady, openInfoId, recommendations, recentById]);

    useEffect(() => {
        if (!authReady) return;
        const interval = setInterval(() => {
            fetchLiveScores();
        }, 60000);
        return () => clearInterval(interval);
    }, [authReady]);

    const sportOptions = useMemo(() => {
        return Array.from(new Set(recommendations.map(rec => rec.sportKey)))
            .sort()
            .map((key) => ({
                key,
                label: translateLeagueLabel(getLeagueLabelFromSportKey(key), locale),
            }));
    }, [recommendations, locale]);

    const bookmakerOptions = useMemo(() => {
        return Array.from(new Set(recommendations.map(rec => rec.bookmaker))).sort();
    }, [recommendations]);

    const summaryStats = useMemo(() => {
        const total = recommendations.length;
        const graded = recommendations.filter(rec => rec.isHit !== null).length;
        const hits = recommendations.filter(rec => rec.isHit === true).length;
        const hitRate = graded > 0 ? Math.round((hits / graded) * 100) : 0;
        const confidenceValues = recommendations
            .map(rec => rec.confidenceScore)
            .filter((score): score is number => typeof score === 'number');
        const avgConfidence = confidenceValues.length > 0
            ? Math.round(confidenceValues.reduce((sum, score) => sum + score, 0) / confidenceValues.length)
            : 0;
        return { total, graded, hits, hitRate, avgConfidence };
    }, [recommendations]);

    const buildSearchHaystack = (rec: Recommendation) => {
        const leagueLabel = getLeagueLabelFromSportKey(rec.sportKey);
        const translatedLeague = translateLeagueLabel(leagueLabel, locale);
        const translatedEvent = translateEventTitle(rec.eventTitle, locale);
        const translatedSelection = translateSelection(rec.selection, locale);
        const translatedHome = translateTeamName(rec.homeTeam ?? '', locale);
        const translatedAway = translateTeamName(rec.awayTeam ?? '', locale);

        return [
            rec.eventTitle,
            rec.homeTeam,
            rec.awayTeam,
            rec.selection,
            rec.sportKey,
            leagueLabel,
            translatedLeague,
            translatedEvent,
            translatedSelection,
            translatedHome,
            translatedAway,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
    };

    const filteredRecommendations = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const min = minConfidence === 'all' ? null : Number(minConfidence);

        return recommendations.filter((rec) => {
            if (selectedSport !== 'all' && rec.sportKey !== selectedSport) return false;
            if (selectedSport === 'all' && onlyPreferred && preferredSports.length > 0 && !preferredSports.includes(rec.sportKey)) return false;
            if (selectedBookmaker !== 'all' && rec.bookmaker !== selectedBookmaker) return false;
            if (min !== null && (rec.confidenceScore ?? 0) < min) return false;
            if (showGradedOnly && rec.isHit === null) return false;
            if (showHitsOnly && rec.isHit !== true) return false;
            if (term) {
                const haystack = buildSearchHaystack(rec);
                if (!haystack.includes(term)) return false;
            }
            return true;
        });
    }, [recommendations, searchTerm, selectedSport, selectedBookmaker, minConfidence, showGradedOnly, showHitsOnly, onlyPreferred, preferredSports, locale]);

    const handleResetFilters = () => {
        setSearchTerm('');
        setSelectedSport('all');
        setSelectedBookmaker('all');
        setMinConfidence('all');
        setShowGradedOnly(false);
        setShowHitsOnly(false);
        setOnlyPreferred(defaultOnlyPreferred);
    };

    return (
        <div className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 ${isHebrew ? 'text-right' : ''}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            <TopBar active="betting" />
            <div className="container mx-auto px-4 py-8">
            {scanning ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="rounded-lg bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 shadow-lg">
                        {t('scanning')}
                    </div>
                </div>
            ) : null}
            <div className="rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 px-6 py-5 mb-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                {scanning ? t('statusScanning') : t('statusLive')}
                            </span>
                            {accuracy ? (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {t('accuracyToday', {
                                        hits: accuracy.hits,
                                        graded: accuracy.graded,
                                        hitRate: accuracy.hitRate,
                                    })}
                                    {' · '}
                                    <Link href={`/${locale}/stats`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                        {t('viewFullStats')}
                                    </Link>
                                </span>
                            ) : null}
                        </div>
                        <h1 className="text-3xl font-bold text-zinc-950 dark:text-white mb-2">
                            {t('title')}
                        </h1>
                        <p className="text-zinc-700 dark:text-zinc-300">
                            {t('description')}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {t('todayDate', {
                                date: new Date().toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                }),
                            })}
                        </p>
                        {scanStatus === 'success' ? (
                            <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                                {t('scanSuccess')}
                            </p>
                        ) : scanStatus === 'error' ? (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                {t('scanFailed')}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                        <button
                            onClick={handleScan}
                            disabled={scanning}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                        >
                            {scanning ? t('scanning') : t('runScan')}
                        </button>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={loading || scanning}
                            className="border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 font-medium py-2 px-4 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                        >
                            {loading ? t('loading') : t('refresh')}
                        </button>
                        {refreshSuccess ? (
                            <span className="text-sm text-emerald-600 dark:text-emerald-400">{t('refreshSuccess')}</span>
                        ) : null}
                    </div>
                </div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-white/60 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 p-4 shadow-sm">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('totalRecommendations')}</p>
                        <div className="flex items-end justify-between">
                            <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{summaryStats.total}</p>
                            <Sparkline
                                values={recommendations.map((rec) => Number(rec.odds || 0)).slice(-12)}
                                strokeClassName="stroke-blue-500"
                            />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/60 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 p-4 shadow-sm">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('gradedCount')}</p>
                        <div className="flex items-end justify-between">
                            <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{summaryStats.graded}</p>
                            <Sparkline
                                values={recommendations.map((rec) => (rec.isHit === true ? 1 : rec.isHit === false ? 0 : 0.5)).slice(-12)}
                                strokeClassName="stroke-blue-500"
                            />
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                            <div
                                className="h-2 rounded-full bg-blue-500"
                                style={{ width: summaryStats.total ? `${Math.round((summaryStats.graded / summaryStats.total) * 100)}%` : '0%' }}
                            />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/60 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 p-4 shadow-sm">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('hitRateShort')}</p>
                        <div className="flex items-end justify-between">
                            <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{summaryStats.hitRate}%</p>
                            <Sparkline
                                values={recommendations.map((rec) => (rec.isHit === true ? 1 : rec.isHit === false ? 0 : 0.5)).slice(-12)}
                                strokeClassName="stroke-emerald-500"
                            />
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                            <div
                                className="h-2 rounded-full bg-emerald-500"
                                style={{ width: `${summaryStats.hitRate}%` }}
                            />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/60 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 p-4 shadow-sm">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('avgConfidence')}</p>
                        <div className="flex items-end justify-between">
                            <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{summaryStats.avgConfidence}%</p>
                            <Sparkline
                                values={recommendations.map((rec) => Number(rec.confidenceScore || 0)).slice(-12)}
                                strokeClassName="stroke-indigo-500"
                            />
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                            <div
                                className="h-2 rounded-full bg-indigo-500"
                                style={{ width: `${summaryStats.avgConfidence}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {fetchError ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200">{fetchError}</p>
                    <button
                        type="button"
                        onClick={() => { setFetchError(''); fetchRecommendations(); fetchAccuracy(); }}
                        className="rounded-lg bg-amber-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        {t('retry')}
                    </button>
                </div>
            ) : null}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-64 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl" />
                    ))}
                </div>
            ) : recommendations.length > 0 && filteredRecommendations.length === 0 ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-8 text-center">
                    <p className="text-zinc-800 dark:text-zinc-200 font-medium mb-1">{t('noMatchesForFilters')}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{t('resetFiltersToSeeAll')}</p>
                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        {t('resetFilters')}
                    </button>
                </div>
            ) : recommendations.length > 0 ? (
                <>
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-4 mb-6 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t('filtersTitle')}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {t('filterResults', { shown: filteredRecommendations.length, total: recommendations.length })}
                            </p>
                        </div>
                        {preferredSports.length > 0 ? (
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t('myLeagues')}</span>
                                {preferredSports.map((key) => (
                                    <span
                                        key={key}
                                        className="rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-200"
                                    >
                                        {translateLeagueLabel(getLeagueLabelFromSportKey(key), locale)}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    {t('search')}
                                </label>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={t('searchPlaceholder')}
                                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    {t('sportFilter')}
                                </label>
                                <select
                                    value={selectedSport}
                                    onChange={(e) => setSelectedSport(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                                >
                                    <option value="all">{t('allSports')}</option>
                                    {sportOptions.map((sport) => (
                                        <option key={sport.key} value={sport.key}>{sport.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    {t('bookmakerFilter')}
                                </label>
                                <select
                                    value={selectedBookmaker}
                                    onChange={(e) => setSelectedBookmaker(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                                >
                                    <option value="all">{t('allBookmakers')}</option>
                                    {bookmakerOptions.map((bookmaker) => (
                                        <option key={bookmaker} value={bookmaker}>{bookmaker}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    {t('confidenceFilter')}
                                </label>
                                <select
                                    value={minConfidence}
                                    onChange={(e) => setMinConfidence(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                                >
                                    <option value="all">{t('anyConfidence')}</option>
                                    {[50, 60, 70, 80].map((value) => (
                                        <option key={value} value={value}>{t('confidenceAtLeast', { value })}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={showGradedOnly}
                                        onChange={(e) => setShowGradedOnly(e.target.checked)}
                                    />
                                    {t('gradedOnly')}
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={showHitsOnly}
                                        onChange={(e) => setShowHitsOnly(e.target.checked)}
                                    />
                                    {t('hitsOnly')}
                                </label>
                                {preferredSports.length > 0 ? (
                                    <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                                        <input
                                            type="checkbox"
                                            checked={onlyPreferred}
                                            onChange={(e) => setOnlyPreferred(e.target.checked)}
                                        />
                                        {t('onlyMyLeagues')}
                                    </label>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleResetFilters}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                                >
                                    {t('resetFilters')}
                                </button>
                            </div>
                        </div>
                    </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecommendations.map((rec) => (
                        <BettingCard
                            key={rec.id}
                            locale={locale}
                            recommendationId={rec.id}
                            sportKey={rec.sportKey}
                            eventTitle={rec.eventTitle}
                            homeTeam={rec.homeTeam}
                            awayTeam={rec.awayTeam}
                            selection={rec.selection}
                            odds={Number(rec.odds)}
                            bookmaker={rec.bookmaker}
                            analysis={rec.analysis}
                            commenceTime={rec.commenceTime}
                            confidenceScore={rec.confidenceScore}
                            predictionLabel={rec.predictionLabel}
                            aiAnalysis={rec.aiAnalysis}
                            resultHomeScore={rec.resultHomeScore}
                            resultAwayScore={rec.resultAwayScore}
                            resultOutcome={rec.resultOutcome}
                            isHit={rec.isHit}
                            liveScore={liveScores[rec.id]}
                            isInfoOpen={openInfoId === rec.id}
                            onToggleInfo={() => handleToggleInfo(rec.id)}
                            onSaveResult={handleSaveResult}
                            recentResults={recentById[rec.id]}
                        />
                    ))}
                </div>
                </>
            ) : (
                <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-500">{t('noResults')}</p>
                </div>
            )}
            </div>
        </div>
    );
}
