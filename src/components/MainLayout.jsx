import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useAppContext } from '../AppContext.jsx';
import { calculateLoanTotals, formatPaymentTimeframe, getDaysUntilDue } from '../loanUtils.js';
import creditLogo from '../../images/creditlogo.png';

const QR_SIZE = 21;

function isFinderCell(row, column, startRow, startColumn) {
  const localRow = row - startRow;
  const localColumn = column - startColumn;
  if (localRow < 0 || localRow > 6 || localColumn < 0 || localColumn > 6) return false;
  return localRow === 0 || localRow === 6 || localColumn === 0 || localColumn === 6 ||
    (localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4);
}

const mockQrPattern = Array.from({ length: QR_SIZE }, (_, row) =>
  Array.from({ length: QR_SIZE }, (_, column) => {
    const inFinder = isFinderCell(row, column, 0, 0) ||
      isFinderCell(row, column, 0, QR_SIZE - 7) ||
      isFinderCell(row, column, QR_SIZE - 7, 0);
    return inFinder || ((row * 13 + column * 7 + row * column) % 4 !== 0);
  }),
);

function ProfileModal({ onClose, userData }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-gray-950/45 px-4 py-6" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="profile-title" className="relative w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-xl sm:p-8">
        <button type="button" onClick={onClose} aria-label="Close profile" className="absolute right-3 top-3 grid size-9 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900">×</button>
        <p className="text-sm font-semibold text-emerald-700">Digital borrower ID</p>
        <h2 id="profile-title" className="mt-1 text-xl font-semibold">{userData.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{userData.email}</p>
        <div className="mx-auto mt-6 aspect-square w-48 rounded-md border border-gray-200 bg-white p-3" aria-label="Mock QR code">
          <div className="grid h-full w-full grid-cols-[repeat(21,minmax(0,1fr))] gap-px" aria-hidden="true">
            {mockQrPattern.flatMap((row, rowIndex) => row.map((filled, columnIndex) => (
              <span key={`${rowIndex}-${columnIndex}`} className={filled ? 'bg-gray-900' : 'bg-white'} />
            )))}
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase text-gray-500">Mock QR code ID</p>
        <p className="mt-1 font-mono text-sm font-semibold text-gray-900">FN-2048-AV-01</p>
      </section>
    </div>
  );
}

export default function MainLayout() {
  const { currentUserRole, toggleUserRole, userData, loans, loansLoading } = useAppContext();
  const { logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const notifications = loans.filter((loan) => loan.status === 'active').map((loan) => {
    const daysUntilDue = getDaysUntilDue(loan.dueDate);
    const totalDue = Number(loan.totalDue ?? calculateLoanTotals(Number(loan.principal) || 0, Number(loan.interestRate) || 0).totalDue);
    const outstanding = Math.max(totalDue - (Number(loan.amountPaid) || 0), 0);
    return {
      id: loan.id,
      title: daysUntilDue !== null && daysUntilDue < 0 ? 'Payment overdue' : daysUntilDue !== null && daysUntilDue <= 7 ? 'Payment due soon' : 'Upcoming installment',
      detail: `Loan ${loan.id}: ${formatPaymentTimeframe(loan.dueDate)} · ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(outstanding)} outstanding.`,
      tone: daysUntilDue !== null && daysUntilDue <= 7 ? 'amber' : 'emerald',
    };
  });

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#f5f7f5] text-[#17211b]">
      <header className="border-b border-emerald-950/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
          <NavLink to="/" className="flex items-center gap-3" aria-label="CrediTrack home">
            <img src={creditLogo} alt="Credit App Logo" className="h-12 w-auto max-w-[190px] object-contain" />
          </NavLink>
          <nav className="order-3 flex w-full items-center gap-1 text-sm sm:order-none sm:w-auto" aria-label="Main navigation">
            <NavLink to="/" end className={({ isActive }) => `rounded-md px-3 py-2 ${isActive ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-gray-600 hover:bg-gray-100'}`}>
              Overview
            </NavLink>
            <NavLink to="/transactions" className={({ isActive }) => `rounded-md px-3 py-2 ${isActive ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-gray-600 hover:bg-gray-100'}`}>
              Transactions
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <button
              type="button"
              role="switch"
              aria-checked={currentUserRole === 'lender'}
              aria-label={`Switch to ${currentUserRole === 'borrower' ? 'Lender Mode' : 'Borrower Mode'}`}
              onClick={toggleUserRole}
              className="flex min-h-10 items-center gap-2 rounded-md border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 sm:text-sm"
            >
              <span className={`relative h-5 w-9 rounded-full transition-colors ${currentUserRole === 'lender' ? 'bg-amber-400' : 'bg-emerald-600'}`} aria-hidden="true">
                <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${currentUserRole === 'lender' ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
              {currentUserRole === 'lender' ? 'Lender Mode' : 'Borrower Mode'}
            </button>
            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={isNotificationsOpen}
                aria-controls="notification-menu"
                onClick={() => setIsNotificationsOpen((open) => !open)}
                className="relative grid size-10 place-items-center rounded-md text-emerald-900 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-500" aria-hidden="true" />
              </button>
              {isNotificationsOpen && (
                <section id="notification-menu" aria-label="Notifications" className="absolute right-0 top-full z-40 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-md border border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">{loansLoading ? '...' : notifications.length} new</span>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {notifications.map((notification) => (
                      <li key={notification.id} className="flex gap-3 px-4 py-3">
                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-600'}`} aria-hidden="true" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                          <p className="mt-1 text-xs leading-5 text-gray-600">{notification.detail}</p>
                        </div>
                      </li>
                    ))}
                    {!loansLoading && notifications.length === 0 && <li className="px-4 py-4 text-xs text-gray-500">No active loan reminders.</li>}
                  </ul>
                </section>
              )}
            </div>
            <button type="button" onClick={() => setIsProfileOpen(true)} className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-600" aria-label="Open user profile and QR ID">
              <span className="grid size-8 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-950" aria-hidden="true">AM</span>
              <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{userData.name}</span>
            </button>
            <button type="button" onClick={handleLogout} className="min-h-10 rounded-md border border-amber-400 px-3 text-xs font-semibold text-amber-950 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 sm:text-sm">
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <Outlet />
        <footer className="mt-12 border-t border-gray-200 pt-5 text-xs text-gray-500">
          <span>{userData.name}</span>
          <span className="mx-2">·</span>
          <span className="capitalize">{currentUserRole} account</span>
        </footer>
      </main>

      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} userData={userData} />}
    </div>
  );
}