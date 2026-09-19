import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SignIn } from './pages/SignIn';
import { Consent } from './pages/Consent';
import { Today } from './pages/Today';
import { Garden } from './pages/Garden';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="/today" element={<Today />} />
        <Route path="/garden" element={<Garden />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
