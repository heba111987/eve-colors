import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useCurrentUser } from '../lib/useCurrentUser';
import { stopPostHogTracking } from '../lib/posthog';

export function Account() {
  const { user, loading, refetch } = useCurrentUser();
  const navigate = useNavigate();
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [consentInitialized, setConsentInitialized] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true });
  }, [loading, user, navigate]);

  // Seed the checkbox from the server's actual consent state exactly once,
  // as soon as the user loads. After that, `analyticsConsent` is the single
  // source of truth so the box can be unchecked (an earlier version OR'd
  // local state with the server value, which made consent impossible to
  // revoke through the UI — see plan Task 18 review).
  useEffect(() => {
    if (user && !consentInitialized) {
      setAnalyticsConsent(Boolean(user.analyticsMarketingConsentAt));
      setConsentInitialized(true);
    }
  }, [user, consentInitialized]);

  if (!loading && !user) return null;

  async function saveConsent() {
    try {
      await apiClient.postConsent(analyticsConsent);
      if (!analyticsConsent) stopPostHogTracking();
      await refetch();
      setStatus('Saved.');
    } catch {
      setStatus('Something went wrong. Please try again.');
    }
  }

  async function deleteAccount() {
    if (deleteConfirmText !== 'DELETE') {
      setStatus('Type DELETE to confirm.');
      return;
    }
    try {
      await apiClient.deleteMe();
      navigate('/');
    } catch {
      setStatus('Something went wrong. Please try again.');
    }
  }

  if (!user) return <p>Loading…</p>;

  return (
    <div>
      <h1>Account &amp; Privacy</h1>
      <nav>
        <a href="/today">Today</a> · <a href="/garden">My Garden</a>
      </nav>
      <p>
        Signed in as <strong>{user.email}</strong>
      </p>
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
      <p>
        <button onClick={() => void saveConsent()}>Save</button>
      </p>
      <hr />
      <h2>Delete my account</h2>
      <p>This permanently removes your account and every Eve Moment you've saved. Type DELETE to confirm.</p>
      <input type="text" value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} />
      <p>
        <button onClick={() => void deleteAccount()}>Delete My Account</button>
      </p>
      <p role="status">{status}</p>
    </div>
  );
}
