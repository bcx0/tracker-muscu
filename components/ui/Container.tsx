'use client';

import { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export default function Container({ children, className = '' }: ContainerProps): JSX.Element {
  return <div className={`mx-auto w-full max-w-md px-4 pb-24 ${className}`.trim()}>{children}</div>;
}
