import './../globals.css';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

function getMetadataBase() {
    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (configuredUrl) {
        return new URL(configuredUrl);
    }

    if (process.env.VERCEL_URL) {
        return new URL(`https://${process.env.VERCEL_URL}`);
    }

    return new URL('http://localhost:3000');
}

export async function generateMetadata({
    params: { locale }
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const t = await getTranslations({ locale, namespace: 'Meta' });
    const title = t('title');
    const description = t('description');
    return {
        metadataBase: getMetadataBase(),
        title,
        description,
        openGraph: {
            title,
            description,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
    };
}

export default async function RootLayout({
    children,
    params: { locale }
}: {
    children: React.ReactNode;
    params: { locale: string };
}) {
    const messages = await getMessages();
    const dir = locale === 'he' ? 'rtl' : 'ltr';

    return (
        <html lang={locale} dir={dir}>
            <body>
                <NextIntlClientProvider messages={messages}>
                    {children}
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
