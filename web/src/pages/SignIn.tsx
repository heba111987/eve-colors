import { apiClient } from '../lib/api';

const SUPPORT_SAFETY_NOTICE =
  'Eve Colors is a wellness self-reflection tool. It does not provide medical advice, diagnosis, or treatment. ' +
  'If you are in the U.S. and need immediate support, call or text 988. If you are in immediate danger, contact local emergency services.';

export function SignIn() {
  return (
    <div>
      <h1>Eve Colors</h1>
      <p>A daily wellness check-in. Not a medical tool — see the note below.</p>
      <a className="primary" href={apiClient.googleStartUrl()} style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 8, background: '#222', color: '#fff', textDecoration: 'none' }}>
        Sign in with Google
      </a>
      <p className="notice">{SUPPORT_SAFETY_NOTICE}</p>
    </div>
  );
}
