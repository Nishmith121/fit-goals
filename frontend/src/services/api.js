// fetch wrapper that tells the backend which signed-in user the request is for,
// so food, water and plan data are stored per account.
export function currentUserEmail() {
  try {
    const saved = localStorage.getItem('fitgoals_user');
    return saved ? (JSON.parse(saved).email || '') : '';
  } catch {
    return '';
  }
}

export function apiFetch(url, options = {}) {
  const email = currentUserEmail();
  const headers = { ...(options.headers || {}) };
  if (email) headers['X-User-Email'] = email;
  // Minutes east of UTC (IST = 330), so the server stamps entries in the user's local time.
  headers['X-TZ-Offset'] = String(-new Date().getTimezoneOffset());
  return fetch(url, { ...options, headers });
}
