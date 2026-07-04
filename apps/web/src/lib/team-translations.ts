type Locale = 'he' | 'en';

const TEAM_TRANSLATIONS_HE: Record<string, string> = {
    // Premier League
    'Arsenal': 'ארסנל',
    'Aston Villa': 'אסטון וילה',
    'Bournemouth': 'בורנמות׳',
    'Brentford': 'ברנטפורד',
    'Brighton and Hove Albion': 'ברייטון',
    'Burnley': 'ברנלי',
    'Chelsea': 'צ׳לסי',
    'Crystal Palace': 'קריסטל פאלאס',
    'Everton': 'אברטון',
    'Fulham': 'פולהאם',
    'Leeds United': 'לידס יונייטד',
    'Liverpool': 'ליברפול',
    'Luton Town': 'לוטון טאון',
    'Manchester City': 'מנצ׳סטר סיטי',
    'Manchester United': 'מנצ׳סטר יונייטד',
    'Newcastle United': 'ניוקאסל',
    'Newcastle': 'ניוקאסל',
    'Nottingham Forest': 'נוטינגהאם פורסט',
    'Sheffield United': 'שפילד יונייטד',
    'Tottenham Hotspur': 'טוטנהאם',
    'Tottenham': 'טוטנהאם',
    'West Ham United': 'ווסטהאם',
    'West Ham': 'ווסטהאם',
    'Wolverhampton': 'וולבס',
    'Wolverhampton Wanderers': 'וולבס',
    'Wolves': 'וולבס',
    'Ipswich Town': 'איפסוויץ׳',
    'Leicester City': 'לסטר',
    'Southampton': 'סאות׳המפטון',
    'Sunderland': 'סאנדרלנד',

    // Bundesliga
    'Bayern Munich': 'באיירן מינכן',
    'FC Bayern Munich': 'באיירן מינכן',
    'Borussia Dortmund': 'בורוסיה דורטמונד',
    'RB Leipzig': 'ר.ב. לייפציג',
    'Bayer Leverkusen': 'באייר לברקוזן',
    'Eintracht Frankfurt': 'איינטרכט פרנקפורט',
    'Borussia Monchengladbach': 'בורוסיה מנשנגלדבאך',
    'Werder Bremen': 'ורדר ברמן',
    'FC St. Pauli': 'פ.צ. סנט פאולי',
    'Augsburg': 'אוגסבורג',
    'Hamburger SV': 'המבורג',
    'TSG Hoffenheim': 'הופנהיים',
    'Hoffenheim': 'הופנהיים',
    'Union Berlin': 'אוניון ברלין',
    'Mainz 05': 'מיינץ 05',
    'FSV Mainz 05': 'מיינץ 05',
    'VfL Wolfsburg': 'וולפסבורג',
    'Wolfsburg': 'וולפסבורג',
    'SC Freiburg': 'פרייבורג',
    'Freiburg': 'פרייבורג',
    'Heidenheim': 'היידנהיים',
    '1. FC Heidenheim': 'היידנהיים',
    'VfB Stuttgart': 'שטוטגרט',
    'Stuttgart': 'שטוטגרט',
    'FC Koln': 'קלן',
    'Koln': 'קלן',
    'FC Cologne': 'קלן',
    'Darmstadt': 'דרמשטאדט',
    'Bayer 04 Leverkusen': 'באייר לברקוזן',
    'Bochum': 'בוכום',
    'VfL Bochum': 'בוכום',
    'Holstein Kiel': 'הולשטיין קיל',

    // La Liga
    'Real Madrid': 'ריאל מדריד',
    'Alavés': 'אלאבס',
    'Barcelona': 'ברצלונה',
    'Atletico Madrid': 'אתלטיקו מדריד',
    'Atlético Madrid': 'אתלטיקו מדריד',
    'Athletic Club': 'אתלטיק בילבאו',
    'Athletic Bilbao': 'אתלטיק בילבאו',
    'Elche CF': 'אלצ׳ה',
    'Espanyol': 'אספניול',
    'Real Sociedad': 'ריאל סוסיאדד',
    'Real Betis': 'ריאל בטיס',
    'Sevilla': 'סביליה',
    'Valencia': 'ולנסיה',
    'Villarreal': 'ויאריאל',
    'Getafe': 'חטאפה',
    'Oviedo': 'אוביידו',
    'Celta Vigo': 'סלטה ויגו',
    'Celta de Vigo': 'סלטה ויגו',
    'Osasuna': 'אוסאסונה',
    'Girona': 'ג׳ירונה',
    'Levante': 'לבאנטה',
    'Rayo Vallecano': 'ראיו ואייקאנו',
    'Alaves': 'אלאבס',
    'Deportivo Alaves': 'אלאבס',
    'Mallorca': 'מאיורקה',
    'Real Mallorca': 'מאיורקה',
    'Las Palmas': 'לאס פלמאס',
    'Cadiz': 'קאדיס',
    'Cadiz CF': 'קאדיס',
    'Granada': 'גרנדה',
    'Almeria': 'אלמריה',
    'Valladolid': 'ויאדוליד',
    'Real Valladolid': 'ויאדוליד',

    // Serie A
    'Inter': 'אינטר',
    'Inter Milan': 'אינטר',
    'AC Milan': 'מילאן',
    'Cremonese': 'קרמונזה',
    'Milan': 'מילאן',
    'Juventus': 'יובנטוס',
    'AS Roma': 'רומא',
    'Lazio': 'לאציו',
    'Napoli': 'נאפולי',
    'Atalanta': 'אטלאנטה',
    'Fiorentina': 'פיורנטינה',
    'Bologna': 'בולוניה',
    'Torino': 'טורינו',
    'Sassuolo': 'ססואולו',
    'Udinese': 'אודינזה',
    'Genoa': 'גנואה',
    'Monza': 'מונצה',
    'Lecce': 'לצ׳ה',
    'Empoli': 'אמפולי',
    'Cagliari': 'קליארי',
    'Verona': 'ורונה',
    'Hellas Verona': 'ורונה',
    'Frosinone': 'פרוזינונה',
    'Salernitana': 'סלרניטנה',
    'Parma': 'פארמה',
    'Pisa': 'פיסה',
    'Como': 'קומו',
    'Venezia': 'ונציה',
    'Sampdoria': 'סמפדוריה',

    // Ligue 1
    'Paris FC': 'פריס',
    'Paris Saint Germain': 'פ.ס.ז׳',
    'Paris Saint-Germain': 'פ.ס.ז׳',
    'Marseille': 'מרסיי',
    'Lyon': 'ליון',
    'Olympique Lyon': 'ליון',
    'AS Monaco': 'מונאקו',
    'Lille': 'ליל',
    'Rennes': 'ראן',
    'Nice': 'ניס',
    'Lens': 'לאנס',
    'Nantes': 'נאנט',
    'Strasbourg': 'שטרסבורג',
    'Reims': 'ריימס',
    'Toulouse': 'טולוז',
    'Montpellier': 'מונפלייה',
    'Brest': 'ברסט',
    'Metz': 'מץ',
    'Le Havre': 'לה האבר',
    'Lorient': 'לוריאן',
    'Clermont': 'קלרמון',
    'Auxerre': 'אוקסר',
    'Angers': 'אנז׳ה',
    'Saint-Etienne': 'סנט אטיין',
    'Saint-Étienne': 'סנט אטיין',

    // Champions League (common teams)
    'Benfica': 'בנפיקה',
    'Porto': 'פורטו',
    'Sporting CP': 'ספורטינג',
    'Ajax': 'אייאקס',
    'PSV': 'פ.ס.וו',
    'Feyenoord': 'פיינורד',
    'Celtic': 'סלטיק',
    'Rangers': 'ריינג׳רס',
    'Shakhtar Donetsk': 'שחטאר דונייצק',
    'Galatasaray': 'גלאטסראיי',
    'Fenerbahce': 'פנרבחצ׳ה',
    'Red Star Belgrade': 'הכוכב האדום בלגרד',
    'Dinamo Zagreb': 'דינמו זאגרב',
    'Club Brugge': 'קלאב ברוז׳',
    'Qarabağ FK': 'קראבאג',
    'Bodø/Glimt': 'בודו/גלימט',
    'Olympiakos Piraeus': 'אולימפיקוס פיראס',
    'Atalanta BC': 'אטלאנטה',

    // Israel Premier League (Ligat HaAl)
    'Maccabi Tel Aviv': 'מכבי תל אביב',
    'Maccabi Haifa': 'מכבי חיפה',
    'Hapoel Tel Aviv': 'הפועל תל אביב',
    'Hapoel Beersheba': 'הפועל באר שבע',
    'Beitar Jerusalem': 'בית״ר ירושלים',
    'Maccabi Netanya': 'מכבי נתניה',
    'Maccabi Petah Tikva': 'מכבי פתח תקווה',
    'Bnei Sakhnin': 'בני סכנין',
    'Hapoel Haifa': 'הפועל חיפה',
    'Hapoel Jerusalem': 'הפועל ירושלים',
    'Hapoel Hadera': 'הפועל חדרה',
    'Maccabi Bnei Reineh': 'מכבי בני ריינה',
    'Hapoel Petah Tikva': 'הפועל פתח תקווה',
    'Hapoel Ashdod': 'מ.ס. אשדוד',
    'Ashdod': 'מ.ס. אשדוד',
    'Ironi Kiryat Shmona': 'עירוני קריית שמונה',

    // FIFA World Cup national teams
    'Brazil': 'ברזיל',
    'Argentina': 'ארגנטינה',
    'France': 'צרפת',
    'England': 'אנגליה',
    'Spain': 'ספרד',
    'Germany': 'גרמניה',
    'Portugal': 'פורטוגל',
    'Netherlands': 'הולנד',
    'Belgium': 'בלגיה',
    'Croatia': 'קרואטיה',
    'Italy': 'איטליה',
    'Uruguay': 'אורוגוואי',
    'Colombia': 'קולומביה',
    'Mexico': 'מקסיקו',
    'USA': 'ארה״ב',
    'United States': 'ארה״ב',
    'Canada': 'קנדה',
    'Japan': 'יפן',
    'South Korea': 'דרום קוריאה',
    'Korea Republic': 'דרום קוריאה',
    'Morocco': 'מרוקו',
    'Switzerland': 'שווייץ',
    'Ukraine': 'אוקראינה',
    'Austria': 'אוסטריה',
    'Australia': 'אוסטרליה',
    'Nigeria': 'ניגריה',
    'Egypt': 'מצרים',
};

const LEAGUE_TRANSLATIONS_HE: Record<string, string> = {
    'Premier League': 'פרמייר ליג',
    'Bundesliga': 'בונדסליגה',
    'Serie A': 'סרייה א׳',
    'La Liga': 'לה ליגה',
    'Ligue 1': 'ליגה 1',
    'Israeli Premier League': 'ליגת העל',
    'Champions League': 'ליגת האלופות',
    'Europa League': 'הליגה האירופית',
    'Europa Conference League': 'הקונפרנס ליג',
    'FIFA World Cup': 'מונדיאל',
};

export const translateTeamName = (team: string, locale?: string) => {
    if (locale !== 'he') return team;
    return TEAM_TRANSLATIONS_HE[team] || team;
};

export const translateEventTitle = (eventTitle: string, locale?: string) => {
    if (locale !== 'he') return eventTitle;
    const [home, away] = eventTitle.split(' vs ');
    if (!home || !away) return eventTitle;
    return `${translateTeamName(home, locale)} נגד ${translateTeamName(away, locale)}`;
};

export const translateSelection = (selection: string, locale?: string) => {
    if (locale !== 'he') return selection;
    if (selection.toLowerCase() === 'draw') return 'תיקו';
    return translateTeamName(selection, locale);
};

export const translateLeagueLabel = (leagueLabel: string, locale?: string) => {
    if (locale !== 'he') return leagueLabel;
    return LEAGUE_TRANSLATIONS_HE[leagueLabel] || leagueLabel;
};

export const getLeagueLabelFromSportKey = (sportKey: string) => {
    switch (sportKey) {
        case 'soccer_epl':
            return 'Premier League';
        case 'soccer_germany_bundesliga':
            return 'Bundesliga';
        case 'soccer_italy_serie_a':
            return 'Serie A';
        case 'soccer_spain_la_liga':
            return 'La Liga';
        case 'soccer_france_ligue_one':
            return 'Ligue 1';
        case 'soccer_israel_ligat_ha_al':
            return 'Israeli Premier League';
        case 'soccer_israel_ligat_al':
            return 'Israeli Premier League';
        case 'soccer_uefa_champs_league':
            return 'Champions League';
        case 'soccer_uefa_europa_league':
            return 'Europa League';
        case 'soccer_uefa_europa_conference_league':
            return 'Europa Conference League';
        case 'soccer_fifa_world_cup':
            return 'FIFA World Cup';
        default:
            return sportKey.replace('soccer_', '').replace(/_/g, ' ');
    }
};

export const translateInsight = (insight: string, locale?: string) => {
    if (locale !== 'he') return insight;
    if (insight.startsWith('Edge:')) return insight.replace('Edge:', 'יתרון:');
    if (insight.startsWith('Market implied:')) return insight.replace('Market implied:', 'הסתברות שוק:');
    if (insight.startsWith('Market favorite:')) {
        const team = insight.replace('Market favorite:', '').trim();
        return `פייבוריט שוק: ${translateTeamName(team, locale)}`;
    }
    if (insight.startsWith('Form: unavailable')) return 'כושר: לא זמין';
    if (insight.startsWith('Form:')) return insight.replace('Form:', 'כושר:');
    if (insight.startsWith('H2H: no recent matches')) return 'מפגשים ישירים: ללא משחקים אחרונים';
    if (insight.startsWith('H2H: unavailable')) return 'מפגשים ישירים: לא זמין';
    if (insight.startsWith('H2H:')) return insight.replace('H2H:', 'מפגשים ישירים:');
    if (insight.startsWith('Fitness: no major injuries reported')) return 'כשירות: ללא פציעות משמעותיות';
    if (insight.startsWith('⚠️ Injury Alert:')) return insight.replace('⚠️ Injury Alert:', '⚠️ התראת פציעה:');
    if (insight.startsWith('LLM prob:')) return insight.replace('LLM prob:', 'הערכת מודל:');
    if (insight === 'Draw prediction relies heavily on value edge.') {
        return 'ניבוי תיקו נשען בעיקר על יתרון הערך.';
    }
    return insight;
};

export const translateAnalysis = (analysis: string, locale?: string) => {
    if (locale !== 'he') return analysis;
    return analysis
        .replace('AI:', 'בינה מלאכותית:')
        .replace('Market favorite', 'פייבוריט שוק')
        .replace('Edge:', 'יתרון:');
};

export const translatePredictionLabel = (label: string, locale?: string) => {
    if (locale !== 'he') return label;
    const map: Record<string, string> = {
        'Market Favorite': 'פייבוריט שוק',
        'High Confidence': 'ביטחון גבוה',
        'Medium Confidence': 'ביטחון בינוני',
        'Risky Value': 'ערך מסוכן',
        'Hard to Predict': 'קשה לנבא',
    };
    return map[label] || label;
};
