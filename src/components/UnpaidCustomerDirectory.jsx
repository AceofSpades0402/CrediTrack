import { useMemo, useState } from 'react';
import { calculateLoanTotals, formatPaymentTimeframe } from '../loanUtils.js';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

export default function UnpaidCustomerDirectory({ loans, loading, error }) {
  const [sortDirection, setSortDirection] = useState('newest');
  const debtors = useMemo(() => loans
    .filter((loan) => loan.status === 'active' && outstandingForLoan(loan) > 0)
    .sort((first, second) => {
      const order = (first.createdAt?.toMillis?.() ?? 0) - (second.createdAt?.toMillis?.() ?? 0);
      return sortDirection === 'newest' ? -order : order;
    }), [loans, sortDirection]);

  return (
    <section aria-labelledby="unpaid-directory-heading" className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <div>
          <h2 id="unpaid-directory-heading" className="text-lg font-semibold">Unpaid customer directory</h2>
          <p className="mt-1 text-sm text-gray-500">Customers with an outstanding balance</p>
        </div>
        <label className="text-sm font-medium text-gray-700">
          <span className="sr-only">Sort by latest transaction</span>
          <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)} className="min-h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20">
            <option value="newest">Most recent</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      {loading && <p className="px-5 py-5 text-sm text-emerald-900" role="status">Loading active loans...</p>}
      {error && <p className="px-5 py-4 text-sm text-red-800" role="alert">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Borrower</th>
              <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Loan / timeframe</th>
              <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Created</th>
              <th scope="col" className="px-5 py-3 text-right font-semibold sm:px-6">Outstanding balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {debtors.map((loan) => (
              <tr key={loan.id}>
                <th scope="row" className="px-5 py-4 font-semibold text-gray-900 sm:px-6">
                  {loan.borrowerName || 'Borrower'}
                  <span className="mt-1 block text-xs font-normal text-gray-500">{loan.borrowerEmail || loan.borrowerId}</span>
                </th>
                <td className="px-5 py-4 text-gray-600 sm:px-6">{loan.id} · {formatPaymentTimeframe(loan.dueDate)}</td>
                <td className="px-5 py-4 text-gray-600 sm:px-6">{formatLoanDate(loan.createdAt)}</td>
                <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-900 sm:px-6">{peso.format(outstandingForLoan(loan))}</td>
              </tr>
            ))}
            {!loading && debtors.length === 0 && (
              <tr>
                <td colSpan="4" className="px-5 py-10 text-center text-sm text-gray-500 sm:px-6">No active Firestore loans found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500 sm:px-6">{debtors.length} active {debtors.length === 1 ? 'loan' : 'loans'}</p>
    </section>
  );
}

function outstandingForLoan(loan) {
  const fallbackTotal = calculateLoanTotals(Number(loan.principal) || 0, Number(loan.interestRate) || 0).totalDue;
  return Math.max(Number(loan.totalDue ?? fallbackTotal) - (Number(loan.amountPaid) || 0), 0);
}

function formatLoanDate(value) {
  if (value?.toDate) return value.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  if (!value) return 'Date unavailable';
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 'Date unavailable' : parsedDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}