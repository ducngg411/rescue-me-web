import React from 'react';

interface AvatarImageProps extends React.HTMLAttributes<HTMLDivElement> {
    name?: string | null;
    avatar?: string | null;
    fallback?: React.ReactNode;
    fallbackBackground?: string;
    initialsCount?: number;
}

function getInitials(name?: string | null, count = 2) {
    const trimmed = name?.trim();
    if (!trimmed) return '?';

    return trimmed
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, count)
        .join('')
        .toUpperCase();
}

export default function AvatarImage({
    name,
    avatar,
    fallback,
    fallbackBackground = '#f97316',
    initialsCount = 2,
    className,
    style,
    ...rest
}: AvatarImageProps) {
    const hasAvatar = Boolean(avatar);
    const mergedStyle = hasAvatar
        ? {
            ...style,
            backgroundImage: `url(${avatar})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
        }
        : {
            ...style,
            background: style?.background ?? fallbackBackground,
        };

    return (
        <div className={className} style={mergedStyle} {...rest}>
            {!hasAvatar && (fallback ?? getInitials(name, initialsCount))}
        </div>
    );
}