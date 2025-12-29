import type { Metadata } from "next";
import { Poppins, Roboto } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers/AppProviders";
import { Navbar } from "@/components/shared/Navbar";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
    variable: "--font-poppins"
});

const roboto = Roboto({
    subsets: ["latin"],
    weight: ["300", "400", "500", "700"],
    variable: "--font-roboto"
});

export const metadata: Metadata = {
    title: "RescueMe - Emergency Assistance Platform",
    description: "Get help when you need it most",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${poppins.variable} ${roboto.variable} font-sans`}>
                <AppProviders>
                    <Navbar />
                    {children}
                </AppProviders>
            </body>
        </html>
    );
}
