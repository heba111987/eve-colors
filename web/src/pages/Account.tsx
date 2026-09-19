import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useCurrentUser } from '../lib/useCurrentUser';

export function Account() {
  const { user, loading, refetch } = useCurrentUser();
  const navigate = useNavigate();
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true });
  }, [loading, user, navigate]);

  if (!loading && !user) return null;

  const analyticsChecked = analyticsConsent || Boolean(user?.analyticsMarketingConsentAt);

  async function saveConsent() {
    await apiClient.postConsent(analyticsChecked);
    await refetch();
    setStatus('Saved.');
  }

  async function deleteAccount() {
    if (deleteConfirmText !== 'DELETE') {
      setStatus('Type DELETE to confirm.');
      return;
    }
    await apiClient.deleteMe();
    navigate('/');
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
            checked={analyticsChecked}
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
