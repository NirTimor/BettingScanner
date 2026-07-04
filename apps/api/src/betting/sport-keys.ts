export const WORLD_CUP_SPORT_KEY = 'soccer_fifa_world_cup';

export const SCAN_SPORT_KEYS = [
    WORLD_CUP_SPORT_KEY,
    'soccer_epl',
    'soccer_germany_bundesliga',
    'soccer_italy_serie_a',
    'soccer_spain_la_liga',
    'soccer_france_ligue_one',
    'soccer_israel_ligat_ha_al',
    'soccer_israel_ligat_al',
    'soccer_uefa_champs_league',
    'soccer_uefa_europa_league',
    'soccer_uefa_europa_conference_league',
];

export const REGIONS_BY_SPORT: Record<string, string> = {
    [WORLD_CUP_SPORT_KEY]: 'us,eu,uk,au',
    soccer_israel_ligat_ha_al: 'us,eu,uk,au',
    soccer_israel_ligat_al: 'us,eu,uk,au',
};

export const DEFAULT_ODDS_REGIONS = 'eu,uk';
