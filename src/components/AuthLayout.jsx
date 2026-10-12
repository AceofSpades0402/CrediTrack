import { Link } from 'react-router-dom';
import creditLogo from '../../images/creditlogo.png';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f5f7f5] px-4 py-7 text-[#17211b] sm:py-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="flex items-center gap-3" aria-label="CrediTrack home">
          <img src={creditLogo} alt="Credit App Logo" className="h-10 w-auto" />
        </Link>
        <Link to="/login" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950">
          Return to sign in
        </Link>
      </header>
      <main className="mx-auto mt-10 w-full max-w-lg sm:mt-14">{children}</main>
    </div>
  );
}