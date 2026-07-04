import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatShortDate } from '@/lib/date-format';
import { getLeagueLabelFromSportKey, translateAnalysis, translateEventTitle, translateInsight, translateLeagueLabel, translatePredictionLabel, translateSelection, translateTeamName } from '@/lib/team-translations';

interface RecommendationProps {
    locale?: string;
    recommendationId?: string;
    sportKey: string;
    eventTitle: string;
    homeTeam?: string;
    awayTeam?: string;
    selection: string;
    odds: number;
    bookmaker: string;
    analysis: string; // Legacy text
    commenceTime: string;
    // New fields (optional for backward compat)
    confidenceScore?: number;
    predictionLabel?: string;
    aiAnalysis?: string; // JSON string
    resultHomeScore?: number | null;
    resultAwayScore?: number | null;
    resultOutcome?: string | null;
    isHit?: boolean | null;
    liveScore?: { homeScore: number; awayScore: number; status: string } | null;
    isInfoOpen?: boolean;
    onToggleInfo?: () => void;
    onSaveResult?: (payload: { recommendationId: string; homeScore: number; awayScore: number }) => Promise<void>;
    recentResults?: {
        homeRecent?: { form: string; matches: Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }> } | null;
        awayRecent?: { form: string; matches: Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }> } | null;
        h2hRecent?: Array<{ homeName: string; awayName: string; homeScore: number; awayScore: number; winner: string | null }> | null;
        sources?: { home?: string; away?: string; h2h?: string };
        reasons?: { home?: string | null; away?: string | null; h2h?: string | null };
        status?: 'loading' | 'ready' | 'error';
    };
}

export const BettingCard = ({
    locale,
    sportKey,
    eventTitle,
    homeTeam,
    awayTeam,
    selection,
    odds,
    bookmaker,
    analysis,
    commenceTime,
    confidenceScore,
    predictionLabel,
    aiAnalysis,
    resultHomeScore,
    resultAwayScore,
    resultOutcome,
    isHit,
    liveScore,
    isInfoOpen,
    onToggleInfo,
    onSaveResult,
    recentResults,
    recommendationId,
}: RecommendationProps) => {
    const t = useTranslations('Betting');
    const [enterHome, setEnterHome] = useState('');
    const [enterAway, setEnterAway] = useState('');
    const [savingResult, setSavingResult] = useState(false);
    const [resultSavedFlash, setResultSavedFlash] = useState(false);
    const leagueLabel = translateLeagueLabel(getLeagueLabelFromSportKey(sportKey), locale);
    const displayEventTitle = translateEventTitle(eventTitle, locale);
    const displaySelection = translateSelection(selection, locale);
    const isHebrew = locale === 'he';
    const tr = (key: string, fallbackHe: string, fallbackEn: string) => {
        const val = t(key as never);
        if (val === `Betting.${key}`) return isHebrew ? fallbackHe : fallbackEn;
        return val;
    };

    const formatSource = (source?: string) => {
        if (!source) return '';
        const map: Record<string, string> = {
            'football-data': t('sourceFootballData'),
            'api-football': t('sourceApiFootball'),
            'sportsdb': t('sourceSportsDb'),
            'none': t('sourceNone'),
        };
        return map[source] || source;
    };

    const formatReason = (reason?: string | null) => {
        if (!reason) return '';
        const map: Record<string, string> = {
            'missing-team': t('reasonMissingTeam'),
            'no-data': t('reasonNoData'),
        };
        return map[reason] || reason;
    };

    // Parse AI Analysis object safely
    let aiData: any = null;
    try {
        if (aiAnalysis) aiData = JSON.parse(aiAnalysis);
    } catch (e) { }

    // Determine color based on confidence/label
    const getConfidenceColor = (score: number) => {
        if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        if (score >= 60) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        if (score >= 50) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    };

    const formatForm = (form?: string) => {
        if (!form || form === 'Unknown') return tr('formUnknown', 'לא ידוע', 'Unknown');
        const toSymbol = (c: string) => {
            if (locale !== 'he') return c;
            if (c === 'W') return tr('formWin', 'נ', 'W');
            if (c === 'D') return tr('formDraw', 'ת', 'D');
            if (c === 'L') return tr('formLoss', 'ה', 'L');
            return c;
        };
        return form.split(',').map(toSymbol).join('-');
    };

    const popupSummary = (() => {
        if (aiData?.edge && aiData?.marketFavorite) {
            const msg = tr(
                'betRationale',
                'נבחרה {selection} בגלל יתרון ערך {edge}% והפייבוריט בשוק הוא {favorite}.',
                'Selected {selection} due to value edge {edge}% and market favorite {favorite}.',
            );
            return msg
                .replace('{edge}', aiData.edge)
                .replace('{selection}', translateSelection(aiData.selection || selection, locale))
                .replace('{favorite}', translateSelection(aiData.marketFavorite, locale));
        }
        if (aiData?.summary) return translateAnalysis(aiData.summary, locale);
        return null;
    })();

    const detailedAnalysis = (() => {
        if (!aiData?.insights || !aiData.edge) return null;
        const orderedPrefixes = [
            'Form:',
            'H2H:',
            'Fitness:',
            '⚠️ Injury Alert:',
            'Market implied:',
            'Market favorite:',
            'LLM prob:',
        ];
        const picked: string[] = [];
        for (const prefix of orderedPrefixes) {
            const match = aiData.insights.find((insight: string) => insight.startsWith(prefix));
            if (match) picked.push(match);
        }
        if (picked.length === 0) return null;
        const sentences = [
            translateInsight(`Edge: ${aiData.edge}`, locale),
            ...picked.map((insight: string) => translateInsight(insight, locale)),
        ].filter(Boolean);
        return sentences.join('. ');
    })();

    const homeRecent = recentResults?.homeRecent || aiData?.homeRecent;
    const awayRecent = recentResults?.awayRecent || aiData?.awayRecent;
    const h2hRecent = recentResults?.h2hRecent || aiData?.h2hRecent;
    const recentStatus = recentResults?.status;

    const renderRecentList = (
        teamLabel: string,
        matches?: Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }>,
        source?: string
    ) => {
        if (!matches || matches.length === 0) return null;
        return (
            <div className="mt-1">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                    {teamLabel}
                </div>
                {source ? (
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {t('recentSource', { source: formatSource(source) })}
                    </div>
                ) : null}
                <ul className="mt-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {matches.slice(0, 5).map((match, idx) => {
                        const badgeColor =
                            match.result === 'W'
                                ? 'bg-emerald-500'
                                : match.result === 'D'
                                    ? 'bg-zinc-400'
                                    : 'bg-red-500';
                        return (
                            <li key={idx} className="flex items-center gap-2">
                                <span className={`min-w-[18px] rounded px-1 text-[10px] font-bold text-white ${badgeColor}`}>
                                    {match.result}
                                </span>
                                <span className="text-zinc-700 dark:text-zinc-200">
                                    {match.scored}-{match.conceded}
                                </span>
                                <span className="text-zinc-500 dark:text-zinc-400 truncate">
                                    {tr('vsLabel', 'נגד', 'vs')}{' '}
                                    {(() => {
                                        const rawOpponent = match.opponent || '';
                                        const translatedOpponent = translateTeamName(rawOpponent, locale);
                                        if (locale === 'he' && rawOpponent && translatedOpponent !== rawOpponent) {
                                            return `${translatedOpponent} (${rawOpponent})`;
                                        }
                                        return translatedOpponent;
                                    })()}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    const renderH2hScores = () => {
        if (!h2hRecent || h2hRecent.length === 0) return null;
        return (
            <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                <div className="font-semibold text-zinc-800 dark:text-zinc-100">
                    {tr('h2hLabel', 'מפגשים אחרונים ביניהם:', 'Recent head-to-head:')}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                    {h2hRecent.map((match: { homeScore: number; awayScore: number; winner: string | null }, idx: number) => {
                        const winner = match.winner ? translateTeamName(match.winner, locale) : '';
                        const label = `${match.homeScore}-${match.awayScore}${winner ? ` ${winner}` : ''}`;
                        return (
                            <span key={idx} className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                                {label}
                            </span>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div
            className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between hover:shadow-md transition-shadow ${isHebrew ? 'text-right' : ''}`}
            dir={isHebrew ? 'rtl' : 'ltr'}
        >
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-wrap gap-2">
                        <span className="text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                            {formatShortDate(new Date(commenceTime), locale ?? 'en')}
                        </span>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                            {leagueLabel}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {predictionLabel ? (
                            <span className={`text-xs font-bold px-2 py-1 rounded ${getConfidenceColor(confidenceScore || 0)}`}>
                                {translatePredictionLabel(predictionLabel, locale)} ({confidenceScore}%)
                            </span>
                        ) : (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded">
                                {t('valueBet')}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={onToggleInfo}
                            className="w-6 h-6 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900"
                            aria-label={t('analysisInfo')}
                            title={t('analysisInfo')}
                        >
                            i
                        </button>
                    </div>
                </div>

                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1" dir={isHebrew ? 'rtl' : 'ltr'}>
                    {displayEventTitle}
                </h3>

                <div className="my-4">
                    <p className="text-sm text-zinc-500 mb-1">{t('recommendedSelection')}</p>
                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200" dir={isHebrew ? 'rtl' : 'ltr'}>{displaySelection}</span>
                        <span className="font-bold text-xl text-blue-600 dark:text-blue-400">{Number(odds).toFixed(2)}</span>
                    </div>
                </div>

                {/* AI Summary Section */}
                <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
                    {aiData && aiData.edge ? (
                        <p>
                            {t('analysisSummaryLine', {
                                edge: aiData.edge,
                                confidence: confidenceScore ?? 0,
                            })}
                        </p>
                    ) : (
                        <p>{translateAnalysis(analysis, locale)}</p>
                    )}
                </div>

                {isInfoOpen ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div
                            className="absolute inset-0 bg-black/40"
                            onClick={onToggleInfo}
                            aria-hidden="true"
                        />
                        <div
                            className={`relative z-10 w-[90%] max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xl ${isHebrew ? 'text-right' : ''}`}
                            dir={isHebrew ? 'rtl' : 'ltr'}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    {t('analysisTitle')}
                                </div>
                                <button
                                    type="button"
                                    onClick={onToggleInfo}
                                    className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                                    aria-label={t('close')}
                                >
                                    ✕
                                </button>
                            </div>
                            {aiData && aiData.insights ? (
                                <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                                    {popupSummary ? (
                                        <div className="text-sm text-zinc-700 dark:text-zinc-200">
                                            {popupSummary}
                                        </div>
                                    ) : null}
                                    <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                        <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                                            {tr('recentResults', 'תוצאות אחרונות:', 'Recent results:')}{' '}
                                        </span>
                                    </div>
                                    {renderRecentList(
                                        translateTeamName(homeTeam || '', locale),
                                        homeRecent?.matches,
                                        recentResults?.sources?.home
                                    )}
                                    {renderRecentList(
                                        translateTeamName(awayTeam || '', locale),
                                        awayRecent?.matches,
                                        recentResults?.sources?.away
                                    )}
                                    {recentStatus === 'loading' ? (
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {tr('recentLoading', 'טוען תוצאות אחרונות...', 'Loading recent results...')}
                                        </div>
                                    ) : null}
                                    {recentStatus === 'error' ? (
                                        <div className="text-xs text-red-500">
                                            {tr('recentError', 'שגיאה בקבלת תוצאות אחרונות', 'Failed to load recent results')}
                                        </div>
                                    ) : null}
                                    {recentStatus === 'ready' && !homeRecent && !awayRecent ? (
                                        <div className={`text-xs text-zinc-500 dark:text-zinc-400 ${isHebrew ? 'ml-0 mr-1' : ''}`}>
                                            {tr('recentEmpty', 'אין תוצאות זמינות כרגע', 'No recent results available')}
                                            {recentResults?.reasons?.home ? (
                                                <span className={isHebrew ? 'mr-1' : 'ml-1'}>
                                                    {t('recentReason', { reason: formatReason(recentResults.reasons.home) })}
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    {renderH2hScores()}
                                    {detailedAnalysis ? (
                                        <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                            <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                                                {tr('analysisDetails', 'ניתוח מפורט:', 'Detailed analysis:')}{' '}
                                            </span>
                                            {detailedAnalysis}
                                        </div>
                                    ) : null}
                                    {!detailedAnalysis ? (
                                        <div>
                                            {translateInsight(`Edge: ${aiData.edge}`, locale)}
                                        </div>
                                    ) : null}
                                    {confidenceScore !== undefined ? (
                                        <div>
                                            {t('confidenceScore', { score: confidenceScore })}
                                        </div>
                                    ) : null}
                                    <ul className={`list-disc space-y-1 ${isHebrew ? 'pr-4' : 'pl-4'}`}>
                                        {aiData.insights.map((insight: string, idx: number) => (
                                            <li key={idx}>{translateInsight(insight, locale)}</li>
                                        ))}
                                    </ul>
                                    {Array.isArray(aiData.secondarySelections) && aiData.secondarySelections.length > 1 ? (
                                        <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                                            {t('altOptions')}{' '}
                                            {aiData.secondarySelections
                                                .map((opt: string) => translateSelection(opt, locale))
                                                .join(' / ')}
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                                    {translateAnalysis(analysis, locale)}
                                </p>
                            )}
                        </div>
                    </div>
                ) : null}

                <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    <p className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">{t('result')}</p>
                    {liveScore ? (
                        <div className="mb-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            {t('liveScore', {
                                home: liveScore.homeScore,
                                away: liveScore.awayScore,
                                status: liveScore.status,
                            })}
                        </div>
                    ) : null}
                    {resultHomeScore !== null && resultHomeScore !== undefined &&
                        resultAwayScore !== null && resultAwayScore !== undefined ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                            <span className="text-zinc-700 dark:text-zinc-300">
                                {resultHomeScore} - {resultAwayScore} ({resultOutcome || 'UNKNOWN'})
                                {resultSavedFlash ? (
                                    <span className="ms-2 text-sm font-medium text-emerald-600 dark:text-emerald-400"> · {t('resultSaved')}</span>
                                ) : null}
                            </span>
                            <span
                                className={`text-xs font-bold px-2 py-1 rounded ${isHit === true
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : isHit === false
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                    }`}
                            >
                                {isHit === true ? t('hit') : isHit === false ? t('miss') : t('unknown')}
                            </span>
                        </div>
                    ) : recommendationId && onSaveResult ? (
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('resultPending')}</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    max={99}
                                    value={enterHome}
                                    onChange={(e) => setEnterHome(e.target.value)}
                                    placeholder={t('home')}
                                    className="w-14 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="text-zinc-500">-</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={99}
                                    value={enterAway}
                                    onChange={(e) => setEnterAway(e.target.value)}
                                    placeholder={t('away')}
                                    className="w-14 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100"
                                />
                                {resultSavedFlash ? (
                                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t('resultSaved')}</span>
                                ) : (
                                <button
                                    type="button"
                                    disabled={savingResult || enterHome === '' || enterAway === '' || Number(enterHome) < 0 || Number(enterAway) < 0}
                                    onClick={async () => {
                                        const h = Number(enterHome);
                                        const a = Number(enterAway);
                                        if (!Number.isFinite(h) || !Number.isFinite(a) || h < 0 || a < 0) return;
                                        setSavingResult(true);
                                        setResultSavedFlash(false);
                                        try {
                                            await onSaveResult({ recommendationId, homeScore: h, awayScore: a });
                                            setEnterHome('');
                                            setEnterAway('');
                                            setResultSavedFlash(true);
                                            setTimeout(() => setResultSavedFlash(false), 2000);
                                        } finally {
                                            setSavingResult(false);
                                        }
                                    }}
                                    className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                                >
                                    {savingResult ? t('saving') : t('saveResult')}
                                </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('resultPending')}
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-400">{t('bookmaker')}</span>
                <span className="font-medium text-sm text-zinc-700 dark:text-zinc-300" dir="ltr">{bookmaker}</span>
            </div>
        </div>
    );
};
