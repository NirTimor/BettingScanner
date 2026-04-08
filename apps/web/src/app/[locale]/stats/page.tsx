'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Sparkline from '@/components/Sparkline';
import TopBar from '@/components/TopBar';
import { API_URL, TOKEN_KEY } from '@/lib/api-config';
import { getLeagueLabelFromSportKey, translateLeagueLabel } from '@/lib/team-translations';

interface StatsGroup {
    key: string;
    total: number;
    graded: number;
    hits: number;
    hitRate: number;
    roi: number;
    avgOdds: number;
}

interface StatsResponse {
    windowDays: number;
    total: number;
    graded: number;
    hits: number;
    hitRate: number;
    roi: number;
    avgOdds: number;
    bySport: StatsGroup[];
    byBookmaker: StatsGroup[];
}

interface DailyStatsResponse {
    windowDays: number;
    series: Array<{
        date: string;
        total: number;
        graded: number;
        hits: number;
        hitRate: number;
        roi: number;
    }>;
}

export default function StatsPage() {
    const t = useTranslations('Stats');
    const locale = useLocale();
    const router = useRouter();
    const isHebrew = locale === 'he';
    const [days, setDays] = useState(30);
    const [stats, setStats] = useState<StatsResponse | null>(null);
    const [dailyStats, setDailyStats] = useState<DailyStatsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [notifying, setNotifying] = useState(false);
    const [notifyMessage, setNotifyMessage] = useState('');

    const getToken = () => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem(TOKEN_KEY) ?? '';
    };

    const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
        const token = getToken();
        if (!token) return null;
        try {
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
        } catch {
            setErrorMessage(t('fetchError'));
            return null;
        }
    }, [locale, router, t]);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            setErrorMessage('');
            const res = await fetchWithAuth(`${API_URL}/betting/stats?days=${days}`);
            if (!res) return;
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
            const dailyRes = await fetchWithAuth(`${API_URL}/betting/stats/daily?days=${days}`);
            if (!dailyRes) return;
            if (dailyRes.ok) {
                const dailyData = await dailyRes.json();
                setDailyStats(dailyData);
            }
        } catch {
            setErrorMessage(t('fetchError'));
        } finally {
            setLoading(false);
        }
    }, [days, fetchWithAuth, t]);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            router.replace(`/${locale}/login`);
            return;
        }
    }, [locale, router]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const formatGroupLabel = (key: string, isSport: boolean) => {
        if (!isSport) return key;
        return translateLeagueLabel(getLeagueLabelFromSportKey(key), locale);
    };

    const renderTable = (title: string, rows: StatsGroup[], isSport = false) => (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h3 className="text-lg font-semibold mb-3 text-zinc-900 dark:text-zinc-100">{title}</h3>
            {rows.length === 0 ? (
                <p className="text-sm text-zinc-500">{t('noData')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-zinc-800 dark:text-zinc-100">
                        <thead>
                            <tr className="text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60">
                                <th className="text-left py-2 px-2">{t('group')}</th>
                                <th className="text-left py-2 px-2">{t('total')}</th>
                                <th className="text-left py-2 px-2">{t('hitRate')}</th>
                                <th className="text-left py-2 px-2">{t('roi')}</th>
                                <th className="text-left py-2 px-2">{t('avgOdds')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.key} className="border-t border-zinc-100 dark:border-zinc-800">
                                    <td className="py-2 px-2 text-zinc-800 dark:text-zinc-100">{formatGroupLabel(row.key, isSport)}</td>
                                    <td className="py-2 px-2 text-zinc-700 dark:text-zinc-200">{row.total}</td>
                                    <td className="py-2 px-2 text-zinc-700 dark:text-zinc-200">{row.hitRate}%</td>
                                    <td className={`py-2 px-2 ${row.roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {row.roi}%
                                    </td>
                                    <td className="py-2 px-2 text-zinc-700 dark:text-zinc-200">{row.avgOdds}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const handleSyncResults = async () => {
        setSyncMessage('');
        setSyncing(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/betting/results/auto-range?days=${days}`, { method: 'POST' });
            if (!res) return;
            const data = await res.json();
            if (!res.ok) {
                setSyncMessage(t('syncFailed'));
                return;
            }
            const totalUpdated = Array.isArray(data?.results)
                ? data.results.reduce((sum: number, item: { updated?: number }) => sum + (item.updated || 0), 0)
                : 0;
            setSyncMessage(t('syncSuccess', { total: totalUpdated }));
            await fetchStats();
        } finally {
            setSyncing(false);
        }
    };

    const handleNotify = async () => {
        setNotifyMessage('');
        setNotifying(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/betting/notify?date=${new Date().toISOString().slice(0, 10)}`, { method: 'POST' });
            if (!res) return;
            const data = await res.json();
            if (!res.ok) {
                setNotifyMessage(t('notifyFailed'));
                return;
            }
            const total = data?.total ?? 0;
            setNotifyMessage(t('notifySuccess', { total }));
        } finally {
            setNotifying(false);
        }
    };

    const totalSeries = stats?.bySport.map(item => item.total).slice(0, 12) || [];
    const gradedSeries = stats?.bySport.map(item => item.graded).slice(0, 12) || [];
    const hitRateSeries = stats?.bySport.map(item => item.hitRate).slice(0, 12) || [];
    const roiSeries = stats?.byBookmaker.map(item => item.roi).slice(0, 12) || [];

    const chartBySport = stats?.bySport.map((item) => ({
        name: translateLeagueLabel(getLeagueLabelFromSportKey(item.key), locale),
        total: item.total,
        hitRate: item.hitRate,
    })) || [];

    const dailySeries = dailyStats?.series || [];

    return (
        <div className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isHebrew ? 'text-right' : ''}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            <TopBar active="stats" />
            <div className="max-w-6xl mx-auto px-6 py-10">
                <div className="rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 p-6 mb-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-200 mb-2">
                                {t('title')}
                            </span>
                            <h1 className="text-3xl font-bold">{t('title')}</h1>
                            <p className="text-zinc-600 dark:text-zinc-300">{t('subtitle')}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleSyncResults}
                                disabled={syncing}
                                className="border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 font-medium py-2 px-4 rounded-lg transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                            >
                                {syncing ? t('syncing') : t('syncResults')}
                            </button>
                            <button
                                type="button"
                                onClick={handleNotify}
                                disabled={notifying}
                                className="border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 font-medium py-2 px-4 rounded-lg transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                            >
                                {notifying ? t('notifying') : t('sendUpdates')}
                            </button>
                            <Link
                                href={`/${locale}/betting`}
                                className="border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium py-2 px-4 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 rounded-lg inline-block"
                            >
                                {t('backToDashboard')}
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-4 mb-6 shadow-sm">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('daysLabel')}</label>
                    <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="mt-2 w-full md:w-48 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                    >
                        {[7, 30, 90].map((value) => (
                            <option key={value} value={value}>{t('daysOption', { value })}</option>
                        ))}
                    </select>
                    {syncMessage ? (
                        <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{syncMessage}</p>
                        </div>
                    ) : null}
                    {errorMessage ? (
                        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                    ) : null}
                    {notifyMessage ? (
                        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{notifyMessage}</p>
                    ) : null}
                </div>

                {loading || !stats ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl" />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-4 shadow-sm">
                                <p className="text-xs text-zinc-500">{t('total')}</p>
                                <div className="flex items-end justify-between">
                                    <p className="text-2xl font-semibold">{stats.total}</p>
                                    <Sparkline values={totalSeries} strokeClassName="stroke-blue-500" />
                                </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-4 shadow-sm">
                                <p className="text-xs text-zinc-500">{t('graded')}</p>
                                <div className="flex items-end justify-between">
                                    <p className="text-2xl font-semibold">{stats.graded}</p>
                                    <Sparkline values={gradedSeries} strokeClassName="stroke-blue-500" />
                                </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-4 shadow-sm">
                                <p className="text-xs text-zinc-500">{t('hitRate')}</p>
                                <div className="flex items-end justify-between">
                                    <p className="text-2xl font-semibold">{stats.hitRate}%</p>
                                    <Sparkline values={hitRateSeries} strokeClassName="stroke-emerald-500" />
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                                    <div
                                        className="h-2 rounded-full bg-emerald-500"
                                        style={{ width: `${stats.hitRate}%` }}
                                    />
                                </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-4 shadow-sm">
                                <p className="text-xs text-zinc-500">{t('roi')}</p>
                                <div className="flex items-end justify-between">
                                    <p className={`text-2xl font-semibold ${stats.roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {stats.roi}%
                                    </p>
                                    <Sparkline values={roiSeries} strokeClassName={stats.roi >= 0 ? 'stroke-emerald-500' : 'stroke-red-500'} />
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                                    <div
                                        className={`h-2 rounded-full ${stats.roi >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                        style={{ width: `${Math.min(Math.abs(stats.roi), 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-4 shadow-sm">
                                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
                                    {t('chartVolume')}
                                </h3>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartBySport}>
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-4 shadow-sm">
                                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
                                    {t('chartHitRate')}
                                </h3>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartBySport}>
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                                            <Tooltip />
                                            <Bar dataKey="hitRate" fill="#10b981" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-4 shadow-sm mb-6">
                            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
                                {t('chartTrend')}
                            </h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={dailySeries}>
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Line yAxisId="left" type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                        <Line yAxisId="right" type="monotone" dataKey="hitRate" stroke="#10b981" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {renderTable(t('bySport'), stats.bySport, true)}
                            {renderTable(t('byBookmaker'), stats.byBookmaker)}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
