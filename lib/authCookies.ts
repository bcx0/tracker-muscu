'use client';

export function setAuthCookies(isAuthenticated: boolean, setupComplete: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  const base = 'path=/; max-age=2592000; samesite=lax';
  document.cookie = `mt_authenticated=${isAuthenticated ? '1' : '0'}; ${base}`;
  document.cookie = `mt_setup_complete=${setupComplete ? '1' : '0'}; ${base}`;
}

export function clearAuthCookies(): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = 'mt_authenticated=0; path=/; max-age=0; samesite=lax';
  document.cookie = 'mt_setup_complete=0; path=/; max-age=0; samesite=lax';
}
