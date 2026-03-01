'use client';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

function toCssSize(value?: string | number): string | undefined {
  if (typeof value === 'number') {
    return `${value}px`;
  }

  return value;
}

export default function Skeleton({ width = '100%', height = 16, borderRadius = '16px', className = '' }: SkeletonProps): JSX.Element {
  return (
    <div
      className={['skeleton-shimmer', className].filter(Boolean).join(' ')}
      style={{
        width: toCssSize(width),
        height: toCssSize(height),
        borderRadius,
      }}
    />
  );
}

export function SkeletonText({ className = '', ...props }: SkeletonProps): JSX.Element {
  return <Skeleton height={14} borderRadius="999px" className={className} {...props} />;
}

export function SkeletonCard({ className = '', ...props }: SkeletonProps): JSX.Element {
  return <Skeleton height={120} borderRadius="16px" className={className} {...props} />;
}

export function SkeletonCircle({ className = '', ...props }: SkeletonProps): JSX.Element {
  return <Skeleton width={40} height={40} borderRadius="999px" className={className} {...props} />;
}
