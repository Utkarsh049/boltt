import React from "react";

interface RestoreIconProps {
  size?: number;
  className?: string;
}

export const RestoreIcon: React.FC<RestoreIconProps> = ({ size = 13, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Background square (top-right) */}
    <rect x="8" y="3" width="13" height="13" rx="2" />
    {/* Foreground square border (bottom-left) */}
    <path d="M3 8v11a2 2 0 0 0 2 2h11" />
  </svg>
);

