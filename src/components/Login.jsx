import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getAuthErrorMessage, useAuth } from '../AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setAuthError('');
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname ?? '/', { replace: true });
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, 'Unable to sign in. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-sm font-semibold text-emerald-700">Welcome back</p>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-gray-600">Access your CrediTrack account.</p>

        {location.state?.signupComplete && (
          <p role="status" className="mt-5 rounded-md bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
            Your demo account details are ready. Sign in to continue.
          </p>
        )}

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-800">Email address</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-gray-800">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
          {authError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{authError}</p>}
          <button type="submit" disabled={isLoading} className="w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70">
            {isLoading ? 'Please wait...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          New to CrediTrack? <Link to="/signup" className="font-semibold text-emerald-800 underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-emerald-950">Create an account</Link>
        </p>
      </section>
    </AuthLayout>
  );
}