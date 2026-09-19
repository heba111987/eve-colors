import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useCurrentUser } from '../lib/useCurrentUser';

export function Consent() {
  const { user, loading, refetch } = useCurrentUser();
  const navigate = useNavigate();
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!loading && user?.consentAcceptedAt) navigate('/today', { replace: true });
  }, [loading, user, navigate]);

  if (!loading && user?.consentAcceptedAt) return null;

  async function handleContinue() {
    setStatus('Saving…');
    try {
      await apiClient.postConsent(analyticsConsent);
      await refetch();
      navigate('/today');
    } catch {
      setStatus('Something went wrong. Please try again.');
    }
  }

  return (
    <div>
      <h1>Before you start</h1>
      <div className="notice">
        <p>
          <strong>Eve Colors is a wellness tool, not a medical device.</strong> It does not provide medical
          advice, diagnosis, or treatment.
        </p>
        <p>
          We store your Google email and display name to run your account, plus the entries you write.
          Deleting your account permanently removes all of it.
        </p>
      </div>
      <p>
        <label>
          <input
            type="checkbox"
            checked={analyticsConsent}
            onChange={(event) => setAnalyticsConsent(event.target.checked)}
          />{' '}
          I agree to analytics tracking and to being contacted by email for marketing purposes. Eve Colors will
          never sell my email address.
        </label>
      </p>
      <button className="primary" onClick={() => void handleContinue()}>
        I understand, continue
      </button>
      <p role="status">{status}</p>
    </div>
  );
}
