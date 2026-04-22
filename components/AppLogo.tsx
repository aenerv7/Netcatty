import React from 'react';

interface AppLogoProps {
    className?: string;
}

/**
 * App logo component that dynamically uses the accent color (--primary CSS variable).
 * The original logo.svg file remains unchanged; this component renders an inline SVG
 * with colors bound to the current theme's accent color.
 */
export const AppLogo: React.FC<AppLogoProps> = ({ className }) => (
    <svg viewBox="0 0 64 64" className={className}>
        {/* Main background - uses accent color */}
        <rect x="4" y="4" width="56" height="56" rx="12" fill="hsl(var(--primary))" />
        {/* Terminal window */}
        <rect x="14" y="17" width="36" height="24" rx="4" fill="white" />
        {/* Title bar - light accent tint */}
        <rect x="14" y="17" width="36" height="5" rx="4" fill="hsl(var(--primary) / 0.15)" />
        {/* Window buttons */}
        <circle cx="18" cy="19.5" r="1" fill="hsl(var(--primary))" />
        <circle cx="22" cy="19.5" r="1" fill="hsl(var(--primary))" opacity="0.7" />
        <circle cx="26" cy="19.5" r="1" fill="hsl(var(--primary))" opacity="0.5" />
        {/* Terminal prompt arrow */}
        <path d="M20 32 L24 30 L20 28" stroke="hsl(var(--primary))" fill="none" strokeWidth="1.6" />
        {/* Cursor line */}
        <path d="M28 34 H34" stroke="hsl(var(--primary))" strokeWidth="1.6" />
        {/* Cat ears */}
        <path d="M24 17 L26 12 L28 17Z" fill="white" />
        <path d="M36 17 L38 12 L40 17Z" fill="white" />
        {/* Cat tail */}
        <path d="M40 37 C44 40,46 42,46 46 C46 49,44 51,41 51" stroke="white" fill="none" strokeWidth="3.2" />
        {/* Connector/plug */}
        <rect x="38" y="48" width="6" height="5" rx="1" fill="white" stroke="hsl(var(--primary))" />
    </svg>
);

export default AppLogo;
