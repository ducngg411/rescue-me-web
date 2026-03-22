import Image from 'next/image';

interface RescueMeLogoProps {
    /** Size of the logo image in px (width = height). Defaults to 36. */
    size?: number;
    /** Show the "Rescue Me" text next to the logo. Defaults to true. */
    showText?: boolean;
    /** Font size for the text. Defaults to 'text-xl'. */
    textClass?: string;
    /** Color of the text. Defaults to navy #1a1a2e. */
    textColor?: string;
    /** Extra classes on the wrapper div */
    className?: string;
}

/**
 * Shared brand logo component.
 * Renders /public/RescueMe_Logo.svg with optional "Rescue Me" wordmark.
 */
export default function RescueMeLogo({
    size = 36,
    showText = true,
    textClass = 'text-xl',
    textColor = '#1a1a2e',
    className = '',
}: RescueMeLogoProps) {
    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            <Image
                src="/RescueMe_Logo.svg"
                alt="Rescue Me logo"
                width={size}
                height={size}
                priority
            />
            {showText && (
                <span
                    className={`font-bold leading-none ${textClass}`}
                    style={{ color: textColor }}
                >
                    Rescue Me
                </span>
            )}
        </div>
    );
}
