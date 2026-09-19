import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SignIn } from './pages/SignIn';
import { Consent } from './pages/Consent';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
