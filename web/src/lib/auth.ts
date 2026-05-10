import Cookies from 'js-cookie';

const TOKEN_KEY = 'access_token';

export function saveToken(token: string): void {
  Cookies.set(TOKEN_KEY, token, { expires: 1, sameSite: 'lax' });
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function clearToken(): void {
  Cookies.remove(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  return typeof token === 'string' && token.length > 0;
}
