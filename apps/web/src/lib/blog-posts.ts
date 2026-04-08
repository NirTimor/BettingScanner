export interface BlogPost {
    slug: string;
    date: string;
    title: { en: string; he: string };
    excerpt: { en: string; he: string };
    content: { en: string[]; he: string[] };
}

export const BLOG_POSTS: BlogPost[] = [
    {
        slug: 'how-we-scan',
        date: '2026-02-01',
        title: {
            en: 'How we scan for value bets',
            he: 'איך אנחנו סורקים הימורי ערך',
        },
        excerpt: {
            en: 'A quick look at our daily scan flow and why confidence matters.',
            he: 'הצצה לזרימת הסריקה היומית ולמה ציון הביטחון חשוב.',
        },
        content: {
            en: [
                'Every day we collect odds across top leagues and normalize them into a single view.',
                'We prioritize markets with clear discrepancies and add a confidence score to each pick.',
                'The dashboard focuses on clarity: a clean list, filters, and performance stats.',
            ],
            he: [
                'בכל יום אנחנו אוספים יחסים מהליגות המובילות ומאחדים אותם לתמונה ברורה.',
                'אנחנו מזהים פערי ערך ומעניקים לכל המלצה ציון ביטחון.',
                'הדאשבורד מתמקד בפשטות: רשימה נקייה, פילטרים וסטטיסטיקות ביצועים.',
            ],
        },
    },
    {
        slug: 'reading-confidence',
        date: '2026-02-05',
        title: {
            en: 'How to read confidence scores',
            he: 'איך להבין ציוני ביטחון',
        },
        excerpt: {
            en: 'What a confidence score means and how to use it responsibly.',
            he: 'מה המשמעות של ציון ביטחון ואיך להשתמש בו בצורה אחראית.',
        },
        content: {
            en: [
                'Confidence scores are designed to help you compare picks, not predict certainty.',
                'We recommend using them as a relative signal, alongside your own research.',
                'Over time, the stats page helps track consistency by league and bookmaker.',
            ],
            he: [
                'ציוני הביטחון נועדו לעזור להשוות בין המלצות, לא לנבא ודאות.',
                'מומלץ להשתמש בהם כאינדיקציה יחסית לצד בדיקה משלך.',
                'עם הזמן, עמוד הסטטיסטיקות מסייע לעקוב אחרי יציבות לפי ליגה וסוכנות.',
            ],
        },
    },
    {
        slug: 'responsible-approach',
        date: '2026-02-10',
        title: {
            en: 'A responsible approach to betting',
            he: 'גישה אחראית להימורים',
        },
        excerpt: {
            en: 'A short reminder to keep decisions measured and transparent.',
            he: 'תזכורת קצרה לשמור על החלטות מדודות ושקופות.',
        },
        content: {
            en: [
                'Recommendations are data-informed, not guarantees.',
                'Set limits, stick to your plan, and use stats to review performance.',
                'If you ever feel betting is becoming stressful, take a break.',
            ],
            he: [
                'המלצות מבוססות נתונים אינן הבטחות.',
                'קבע גבולות, עמוד בתכנית שלך והיעזר בסטטיסטיקות לבקרה.',
                'אם זה נהיה מלחיץ — מומלץ לקחת הפסקה.',
            ],
        },
    },
];
