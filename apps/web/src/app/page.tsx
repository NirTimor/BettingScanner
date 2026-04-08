import { redirect } from 'next/navigation';

// This page redirects the root URL to the default locale
// e.g., / -> /en
export default function RootPage() {
    redirect('/en/betting');
}
