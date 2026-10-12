import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { AppProvider, useAppContext } from './AppContext.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import BorrowerDashboard from './components/BorrowerDashboard.jsx';
import LenderDashboard from './components/LenderDashboard.jsx';
import Login from './components/Login.jsx';
import MainLayout from './components/MainLayout.jsx';
import Signup from './components/Signup.jsx';
import { calculateLoanTotals, formatPaymentTimeframe } from './loanUtils.js';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <main className="grid min-h-screen place-items-center text-sm font-medium text-emerald-900" role="status">Checking your session...</main>;
  }

  return isAuthenticated
    ? children
    : <Navigate to="/login" replace state={{ from: location }} />;
}

function TransactionHistory() {
  const { loans, loansLoading, loansError } = useAppContext();

  return (
    <section aria-labelledby="transactions-heading">
      <p className="mb-2 text-sm font-medium text-emerald-700">Account activity</p>
      <h1 id="transactions-heading" className="mb-6 text-3xl font-semibold tracking-tight">
        Transactions
      </h1>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {loansLoading && <p className="px-5 py-4 text-sm text-emerald-900" role="status">Loading loan statement...</p>}
        {loansError && <p className="px-5 py-4 text-sm text-red-800" role="alert">{loansError}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Loan</th>
                <th className="px-5 py-3 font-semibold">Payment timeframe</th>
                <th className="px-5 py-3 font-semibold">Interest</th>
                <th className="px-5 py-3 text-right font-semibold">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.map((loan) => {
                const totals = calculateLoanTotals(Number(loan.principal) || 0, Number(loan.interestRate) || 0);
                const totalDue = Number(loan.totalDue ?? totals.totalDue);
                const outstanding = Math.max(totalDue - (Number(loan.amountPaid) || 0), 0);
                return (
                  <tr key={loan.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{loan.borrowerName || 'Loan'}</p>
                      <p className="mt-1 text-xs text-gray-500">{loan.id} · {peso.format(loan.principal)}</p>
                      <p className="mt-1 text-[11px] text-gray-600">Lender: {loan.lenderName || 'Unknown lender'}</p>
                      {loan.description && <p className="mt-1 text-[11px] text-amber-900">Purpose: {loan.description}</p>}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{formatPaymentTimeframe(loan.dueDate)}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {loan.interestRate ?? 0}% · {peso.format(loan.interest ?? totals.interest)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums">{peso.format(outstanding)}</td>
                  </tr>
                );
              })}
              {!loansLoading && !loansError && loans.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-5 py-10 text-center text-sm text-gray-500">No loan records found for your account.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function AppRoutes() {
  const { currentUserRole } = useAppContext();

  return (
    <Routes>
      <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
        <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
        <Route index element={currentUserRole === 'lender' ? <LenderDashboard /> : <BorrowerDashboard />} />
        <Route path="transactions" element={<TransactionHistory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}