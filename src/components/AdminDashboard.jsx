import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../AuthContext.jsx';
import { db } from '../firebase.js';
import BadgeLegend from './BadgeLegend.jsx';
import creditLogo from '../../images/creditlogo.png';
import { calculateLoanTotals, formatPaymentTimeframe, getDaysUntilDue } from '../loanUtils.js';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

const riskStyles = {
  GREEN: 'bg-emerald-100 text-emerald-900',
  YELLOW: 'bg-amber-100 text-amber-950',
  RED: 'bg-red-100 text-red-900',
};

function StatusBadge({ children, tone }) {
  const styles = tone === 'banned'
    ? 'bg-red-100 text-red-800'
    : tone === 'active'
      ? 'bg-emerald-100 text-emerald-900'
      : 'bg-gray-100 text-gray-700';

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{children}</span>;
}

function UserManagement({ users, loans, onToggleBan, onDelete }) {
  return (
    <section aria-labelledby="users-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="users-heading" className="text-xl font-semibold text-gray-950">User management</h2>
          <p className="mt-1 text-sm text-gray-600">Review account access and credit risk status.</p>
        </div>
        <span className="text-sm text-gray-500">{users.length} accounts</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">User name &amp; email</th>
                <th scope="col" className="px-5 py-3 font-semibold">Role status</th>
                <th scope="col" className="px-5 py-3 font-semibold">Account status</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const loan = loans.find((entry) => entry.borrowerEmail === user.email || entry.borrowerId === user.id);
                const daysUntilDue = loan ? getDaysUntilDue(loan.dueDate) : null;
                const loanTotals = loan ? calculateLoanTotals(loan.principal, loan.interestRate) : null;
                const overdueDays = daysUntilDue !== null && daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;
                const riskStatus = loan?.riskStatus ?? user.riskStatus;
                const terminated = riskStatus === 'RED' && overdueDays > 0;
                const accountStatus = terminated ? 'Terminated/Banned' : user.status || 'pending';

                return (
                  <tr key={user.id}>
                    <th scope="row" className="px-5 py-4 font-normal">
                      <span className="block font-semibold text-gray-900">{user.name}</span>
                      <span className="mt-1 block text-xs text-gray-500">{user.email}</span>
                      <span className="mt-1 block font-mono text-[11px] text-gray-400">{user.uid || user.id}</span>
                    </th>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${(user.role || 'borrower').toLowerCase() === 'lender' ? 'bg-amber-100 text-amber-950' : 'bg-gray-100 text-gray-700'}`}>
                        {user.role || 'borrower'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={terminated || user.status === 'banned' ? 'banned' : user.status === 'approved' ? 'active' : 'neutral'}>{accountStatus}</StatusBadge>
                        {riskStatus === 'RED' && <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${riskStyles.RED}`}>Red badge · Delinquent</span>}
                      </div>
                      {loan && loanTotals && <p className="mt-1 text-xs text-gray-600">Principal {peso.format(loan.principal)} · {loan.interestRate}% · Total due {peso.format(loanTotals.totalDue)} · {formatPaymentTimeframe(loan.dueDate)}</p>}
                      {terminated && <p className="mt-1 text-xs font-medium text-red-800">Overdue {overdueDays} days · no borrowing or new accounts</p>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" disabled={terminated} onClick={() => onToggleBan(user)} className={`min-h-9 rounded-md border px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-red-200 disabled:bg-red-50 disabled:text-red-800 ${user.status === 'banned' ? 'border-emerald-700 text-emerald-900 hover:bg-emerald-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                          {terminated ? 'Terminated' : user.status === 'banned' ? 'Unban User' : 'Ban User'}
                        </button>
                        <button type="button" onClick={() => onDelete(user)} className="min-h-9 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2">
                          Delete Account
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-5 py-12 text-center text-sm text-gray-500">No user accounts to display.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function KycApprovals({ submissions, loading, onDecision }) {
  return (
    <section aria-labelledby="kyc-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="kyc-heading" className="text-xl font-semibold text-gray-950">KYC approvals</h2>
          <p className="mt-1 text-sm text-gray-600">Review identity documents submitted by customers.</p>
        </div>
        <span className="text-sm text-gray-500">{submissions.length} awaiting review</span>
      </div>

      {loading && <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">Loading pending user profiles...</p>}
      <ul className="divide-y divide-gray-200 border-y border-gray-200 bg-white">
        {submissions.map((submission) => (
          <li key={submission.id} className="grid gap-5 py-5 sm:grid-cols-[minmax(220px,0.8fr)_minmax(260px,1fr)_auto] sm:items-center">
            <div>
              <p className="font-semibold text-gray-950">{submission.name}</p>
              <p className="mt-1 text-sm text-gray-600">{submission.email}</p>
              <p className="mt-2 font-mono text-xs text-gray-400">{submission.id}</p>
              <p className="mt-1 text-xs text-gray-500">Registered {submission.createdAt?.toDate?.().toLocaleDateString() || 'Date unavailable'}</p>
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p><span className="font-semibold">ID type:</span> {submission.idType || 'Not provided'}</p>
              <p className="mt-1"><span className="font-semibold">ID upload:</span> {submission.idFileName || 'No file record'}</p>
              <p className="mt-1"><span className="font-semibold">Selfie:</span> {submission.selfieTaken ? 'Captured' : 'Not captured'}</p>
            </div>

            <div className="flex gap-2 sm:flex-col">
              <button type="button" onClick={() => onDecision(submission, 'approved')} className="min-h-10 flex-1 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 sm:flex-none">
                Approve
              </button>
              <button type="button" onClick={() => onDecision(submission, 'rejected')} className="min-h-10 flex-1 rounded-md border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:flex-none">
                Reject
              </button>
            </div>
          </li>
        ))}
        {!loading && submissions.length === 0 && (
          <li className="py-12 text-center text-sm text-gray-500">No pending user approvals.</li>
        )}
      </ul>
    </section>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [usersError, setUsersError] = useState('');
  const [loans, setLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(true);
  const [loansError, setLoansError] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();
  const submissions = users.filter((user) => user.status === 'pending' && (user.role || 'borrower') === 'borrower');

  useEffect(() => onSnapshot(collection(db, 'users'), (snapshot) => {
    setUsers(snapshot.docs.map((userDocument) => ({ ...userDocument.data(), id: userDocument.id })));
    setUsersLoading(false);
    setUsersError('');
  }, (error) => {
    setUsersError(error.message || 'Unable to load user accounts.');
    setUsersLoading(false);
  }), []);

  useEffect(() => onSnapshot(query(collection(db, 'loans'), where('status', '==', 'active')), (snapshot) => {
    setLoans(snapshot.docs.map((loanDocument) => ({ ...loanDocument.data(), id: loanDocument.id })));
    setLoansLoading(false);
    setLoansError('');
  }, (error) => {
    setLoansError(error.message || 'Unable to load active loans.');
    setLoansLoading(false);
  }), []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function toggleBan(user) {
    const nextStatus = user.status === 'banned' ? 'approved' : 'banned';
    setUsersError('');
    try {
      await updateDoc(doc(db, 'users', user.id), { status: nextStatus });
      setNotice('Account status updated.');
    } catch (error) {
      setUsersError(error.message || 'Unable to update account status.');
    }
  }

  async function deleteUser(user) {
    setUsersError('');
    try {
      await deleteDoc(doc(db, 'users', user.id));
      setNotice(`${user.name ?? user.email ?? 'User'} account deleted.`);
    } catch (error) {
      setUsersError(error.message || 'Unable to delete this account.');
    }
  }

  async function decideKyc(submission, decision) {
    setUsersError('');
    try {
      await updateDoc(doc(db, 'users', submission.id), { status: decision, reviewedAt: serverTimestamp() });
      setNotice(`${submission.name ?? submission.email ?? 'User'} identity submission ${decision}.`);
    } catch (error) {
      setUsersError(error.message || 'Unable to update this user profile.');
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7f5] text-[#17211b] md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="bg-[#18231d] text-white md:min-h-screen">
        <div className="flex h-full flex-col px-4 py-5 sm:px-5 md:sticky md:top-0 md:h-screen">
          <Link to="/" className="flex items-center gap-3 px-2" aria-label="CrediTrack home">
            <img src={creditLogo} alt="Credit App Logo" className="h-12 w-auto max-w-[190px] object-contain" />
          </Link>
          <div className="mt-9 hidden px-2 text-[11px] font-semibold uppercase text-emerald-100/60 md:block">System administration</div>
          <nav aria-label="Admin navigation" className="mt-5 flex gap-2 overflow-x-auto md:flex-col">
            <button type="button" onClick={() => { setActiveTab('users'); setNotice(''); }} aria-current={activeTab === 'users' ? 'page' : undefined} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition-colors ${activeTab === 'users' ? 'bg-emerald-900 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}>
              <span className="grid size-6 place-items-center rounded bg-white/10 text-xs" aria-hidden="true">U</span>
              User Management
            </button>
            <button type="button" onClick={() => { setActiveTab('kyc'); setNotice(''); }} aria-current={activeTab === 'kyc' ? 'page' : undefined} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition-colors ${activeTab === 'kyc' ? 'bg-emerald-900 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}>
              <span className="grid size-6 place-items-center rounded bg-white/10 text-xs" aria-hidden="true">K</span>
              KYC Approvals
              {submissions.length > 0 && <span className="ml-auto rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-bold text-gray-950">{submissions.length}</span>}
            </button>
          </nav>
          <div className="mt-auto border-t border-white/10 px-2 pt-4">
            <button type="button" onClick={handleLogout} className="min-h-10 w-full rounded-md border border-amber-300/50 px-3 text-left text-sm font-semibold text-amber-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              Log Out
            </button>
            <p className="mt-3 hidden text-xs text-gray-400 md:block">Admin workspace</p>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 pb-5">
          <div>
            <p className="mb-1 text-sm font-semibold text-emerald-800">CrediTrack / Administration</p>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-950">{activeTab === 'users' ? 'User Management' : 'KYC Approvals'}</h1>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span className="size-2 rounded-full bg-emerald-600" aria-hidden="true" />
            Admin session
          </span>
        </header>

        <BadgeLegend className="mb-6" />
        {(loansLoading || usersLoading) && <p className="mb-5 text-sm text-emerald-900" role="status">Loading account and loan data...</p>}
        {(loansError || usersError) && <p className="mb-5 text-sm text-red-800" role="alert">{usersError || loansError}</p>}
        {notice && <p className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900" role="status">{notice}</p>}
        {activeTab === 'users'
          ? <UserManagement users={users} loans={loans} onToggleBan={toggleBan} onDelete={deleteUser} />
          : <KycApprovals submissions={submissions} loading={usersLoading} onDecision={decideKyc} />}
      </main>
    </div>
  );
}