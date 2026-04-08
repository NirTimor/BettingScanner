'use client';

import { useRef } from 'react';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getLeagueLabelFromSportKey, translateLeagueLabel } from '@/lib/team-translations';
import { TOKEN_KEY } from '@/lib/api-config';
import { getInitials } from '@/lib/profile-utils';

const MAX_AVATAR_SIZE_BYTES = 1024 * 1024; // 1MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

const STORAGE_KEY = 'preferredSports';
const ONLY_PREFERRED_KEY = 'preferredSportsOnly';
const PROFILE_NAME_KEY = 'profileName';
const PROFILE_AVATAR_KEY = 'profileAvatar';

const SPORT_KEYS = [
    'soccer_epl',
    'soccer_spain_la_liga',
    'soccer_germany_bundesliga',
    'soccer_italy_serie_a',
    'soccer_france_ligue_one',
    'soccer_uefa_champs_league',
    'soccer_israel_ligat_ha_al',
];

export default function SettingsPage() {
    const t = useTranslations('Settings');
    const locale = useLocale();
    const router = useRouter();
    const isHebrew = locale === 'he';
    const [preferred, setPreferred] = useState<string[]>([]);
    const [onlyPreferred, setOnlyPreferred] = useState(false);
    const [saved, setSaved] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarError, setAvatarError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            router.replace(`/${locale}/login`);
            return;
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) setPreferred(parsed);
            } catch {
                // ignore
            }
        }
        const storedOnly = localStorage.getItem(ONLY_PREFERRED_KEY);
        if (storedOnly === 'true') setOnlyPreferred(true);
        setProfileName(localStorage.getItem(PROFILE_NAME_KEY) || '');
        setAvatarUrl(localStorage.getItem(PROFILE_AVATAR_KEY) || '');
    }, [locale, router]);

    const toggleSport = (sportKey: string) => {
        setPreferred((current) => {
            if (current.includes(sportKey)) {
                return current.filter((key) => key !== sportKey);
            }
            return [...current, sportKey];
        });
    };

    const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAvatarError('');
        const file = e.target.files?.[0];
        if (!file) return;
        if (!ALLOWED_TYPES.includes(file.type)) {
            setAvatarError(t('avatarFormatError'));
            return;
        }
        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            setAvatarError(t('avatarSizeError'));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setAvatarUrl(dataUrl);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleRemoveAvatar = () => {
        setAvatarUrl('');
        setAvatarError('');
        fileInputRef.current?.value && (fileInputRef.current.value = '');
    };

    const handleSave = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferred));
        localStorage.setItem(ONLY_PREFERRED_KEY, String(onlyPreferred));
        localStorage.setItem(PROFILE_NAME_KEY, profileName.trim());
        localStorage.setItem(PROFILE_AVATAR_KEY, avatarUrl.trim());
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    return (
        <div className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${isHebrew ? 'text-right' : ''}`} dir={isHebrew ? 'rtl' : 'ltr'}>
            <TopBar active="settings" />
            <div className="max-w-5xl mx-auto px-6 py-10">
                <div className="rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 p-6 mb-6 shadow-sm">
                    <h1 className="text-3xl font-bold">{t('title')}</h1>
                    <p className="text-zinc-600 dark:text-zinc-300">{t('subtitle')}</p>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-6 shadow-sm mb-6">
                    <h2 className="text-lg font-semibold mb-2">{t('profileTitle')}</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">{t('profileHint')}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                {t('displayName')}
                            </label>
                            <input
                                type="text"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                placeholder={t('displayNamePlaceholder')}
                                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                {t('avatarUpload')}
                            </label>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{t('avatarUploadHint')}</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                    onChange={handleAvatarFile}
                                    className="hidden"
                                    id="avatar-upload"
                                />
                                <label
                                    htmlFor="avatar-upload"
                                    className="cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                    {t('avatarChooseFile')}
                                </label>
                                {avatarUrl ? (
                                    <button
                                        type="button"
                                        onClick={handleRemoveAvatar}
                                        className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        {t('avatarRemove')}
                                    </button>
                                ) : null}
                            </div>
                            {avatarError ? (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{avatarError}</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex items-center justify-center text-sm font-semibold text-zinc-700 dark:text-zinc-200 shrink-0">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={profileName} className="h-12 w-12 object-cover" />
                            ) : (
                                getInitials(profileName || t('user'))
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                                {profileName || t('user')}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('profilePreview')}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-2">{t('leaguePrefsTitle')}</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">{t('leaguePrefsHint')}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {SPORT_KEYS.map((key) => {
                            const label = translateLeagueLabel(getLeagueLabelFromSportKey(key), locale);
                            const selected = preferred.includes(key);
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleSport(key)}
                                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${selected
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                                        : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    <span>{label}</span>
                                    <span className={`text-xs ${selected ? 'opacity-100' : 'opacity-40'}`}>
                                        {selected ? t('selected') : t('select')}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
                        <input
                            type="checkbox"
                            checked={onlyPreferred}
                            onChange={(e) => setOnlyPreferred(e.target.checked)}
                        />
                        {t('onlyPreferred')}
                    </label>

                    <div className="mt-6 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSave}
                            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                        >
                            {t('save')}
                        </button>
                        {saved ? (
                            <span className="text-sm text-emerald-600">{t('saved')}</span>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
