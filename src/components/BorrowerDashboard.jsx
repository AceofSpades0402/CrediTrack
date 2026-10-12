import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAppContext } from '../AppContext.jsx';
import { db, storage } from '../firebase.js';
import BadgeLegend from './BadgeLegend.jsx';
import { calculateLoanTotals, formatPaymentTimeframe } from '../loanUtils.js';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

function getLoanOutstanding(loan) {
  const totalDue = Number(loan.totalDue ?? calculateLoanTotals(Number(loan.principal) || 0, Number(loan.interestRate) || 0).totalDue);
  return Math.max(totalDue - (Number(loan.amountPaid) || 0), 0);
}

function formatLoanDate(value) {
  if (value?.toDate) return value.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  if (!value) return 'Date unavailable';
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 'Date unavailable' : parsedDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function BorrowerDashboard() {
  const { userData, userProfile, userProfileLoading, userProfileError, loans, loansLoading, loansError } = useAppContext();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState('');
  const [proofSuccess, setProofSuccess] = useState('');

  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const outstandingLoans = loans.filter((loan) => loan.status === 'active' || loan.status === 'pending_verification');
  const outstandingBalance = outstandingLoans.reduce((total, loan) => total + getLoanOutstanding(loan), 0);
  const principalOutstanding = outstandingLoans.reduce((total, loan) => total + Math.max((Number(loan.principal) || 0) - (Number(loan.principalPaid) || 0), 0), 0);
  const availableBalance = Math.max(userData.creditLimit - principalOutstanding, 0);
  const goodStanding = userData.riskStatus === 'GREEN';
  const isApproved = userProfile?.status === 'approved';

  function openPaymentModal(loan) {
    setSelectedLoanForPayment(loan);
    setReceiptFile(null);
    setProofError('');
    setProofSuccess('');
    setPaymentModalOpen(true);
  }

  function selectReceiptFile(file) {
    setProofError('');
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setReceiptFile(null);
      setProofError('Choose a supported image file (SVG files are not accepted).');
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setReceiptFile(null);
      setProofError('Receipt images must be 5 MB or smaller.');
      return;
    }
    setReceiptFile(file);
  }

  async function submitPaymentProof(event) {
    event.preventDefault();
    if (!selectedLoanForPayment || !receiptFile) {
      setProofError('Please choose a receipt image before submitting.');
      return;
    }

    setUploadingProof(true);
    setProofError('');
    setProofSuccess('');

    try {
      const receiptRef = ref(storage, `payment_receipts/${selectedLoanForPayment.id}/${Date.now()}`);
      await uploadBytes(receiptRef, receiptFile, { contentType: receiptFile.type });
      const downloadUrl = await getDownloadURL(receiptRef);

      await runTransaction(db, async (transaction) => {
        const loanRef = doc(db, 'loans', selectedLoanForPayment.id);
        const loanSnapshot = await transaction.get(loanRef);
        if (!loanSnapshot.exists() || loanSnapshot.data().status !== 'active') {
          throw new Error('This loan is no longer available for payment submission.');
        }
        const loan = loanSnapshot.data();
        if (loan.borrowerId !== userData.id && loan.borrowerEmail !== userData.email) {
          throw new Error('You are not authorized to submit payment for this loan.');
        }
        transaction.update(loanRef, {
          paymentProofUrl: downloadUrl,
          status: 'pending_verification',
          paymentSubmittedAt: serverTimestamp(),
          paymentSubmittedBy: userData.id,
        });
      });

      setProofSuccess('Payment proof submitted for lender verification.');
      setReceiptFile(null);
      setSelectedLoanForPayment(null);
      setPaymentModalOpen(false);
    } catch (error) {
      setProofError(error instanceof Error ? error.message : 'Unable to submit your payment proof. Please try again.');
    } finally {
      setUploadingProof(false);
    }
  }

  if (userProfileLoading) {
    return <div className="grid min-h-64 place-items-center text-sm font-medium text-emerald-900" role="status">Loading your account status...</div>;
  }

  if (userProfileError) {
    return <p className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800" role="alert">{userProfileError}</p>;
  }

  if (!isApproved) {
    return (
      <section className="mx-auto max-w-2xl border-y border-amber-300 bg-amber-50 px-5 py-10 text-center sm:py-14" aria-labelledby="approval-pending-heading">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100 text-xl font-bold text-amber-900" aria-hidden="true">!</span>
        <h1 id="approval-pending-heading" className="mt-4 text-2xl font-semibold text-amber-950">Your account is pending Superadmin approval.</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-amber-900">Your account and identity details are being reviewed. Loan information and credit features will be available after approval.</p>
      </section>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-emerald-700">Borrower account</p>
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
            Good morning, {userData.name.split(' ')[0]}
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${userData.riskStatus === 'RED' ? 'bg-red-100 text-red-900' : userData.riskStatus === 'YELLOW' ? 'bg-amber-100 text-amber-950' : 'bg-emerald-100 text-emerald-900'}`}>
              <span className={`size-2 rounded-full ${userData.riskStatus === 'RED' ? 'bg-red-600' : userData.riskStatus === 'YELLOW' ? 'bg-amber-500' : 'bg-emerald-600'}`} aria-hidden="true" />
              {userData.riskStatus === 'RED' ? 'Delinquent' : userData.riskStatus === 'YELLOW' ? 'Review recommended' : 'Good Standing'}
            </span>
          </h1>
          <p className="mt-2 text-sm text-gray-600">Your credit and repayment activity.</p>
        </div>
        <NavLink to="/transactions" className="text-sm font-semibold text-emerald-800 underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-emerald-950">
          Full account activity
        </NavLink>
      </div>

      <BadgeLegend className="mb-6" />

      <section aria-labelledby="credit-health-heading" className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="credit-health-heading" className="text-lg font-semibold">Credit health</h2>
            <p className="mt-1 text-sm text-gray-500">Your current borrowing position</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${goodStanding ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'}`}>
            <span className={`size-2 rounded-full ${goodStanding ? 'bg-emerald-600' : 'bg-amber-500'}`} aria-hidden="true" />
            {goodStanding ? 'Good standing' : 'Review recommended'}
          </span>
        </div>
        <div className="mt-6 grid gap-5 border-t border-gray-100 pt-5 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-600">Available balance</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{peso.format(availableBalance)}</p>
          </div>
          <div className="sm:border-l sm:border-gray-100 sm:pl-6">
            <p className="text-sm text-gray-600">Credit limit</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{peso.format(userData.creditLimit)}</p>
          </div>
        </div>
      </section>

      {paymentModalOpen && selectedLoanForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Payment proof</p>
                <h3 className="mt-1 text-xl font-semibold text-gray-900">Upload receipt</h3>
              </div>
              <button type="button" onClick={() => { setPaymentModalOpen(false); setSelectedLoanForPayment(null); setReceiptFile(null); setProofError(''); setProofSuccess(''); }} className="text-sm font-medium text-gray-500 hover:text-gray-800" aria-label="Close payment proof dialog">
                Close
              </button>
            </div>

            <form onSubmit={submitPaymentProof} className="mt-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Loan reference</p>
                <p className="mt-1 text-sm text-gray-600">{selectedLoanForPayment.id}</p>
              </div>

              <div>
                <label htmlFor="payment-proof-upload" className="block text-sm font-medium text-gray-700">Proof of payment image</label>
                <input
                  id="payment-proof-upload"
                  type="file"
                  accept="image/*"
                  onChange={(event) => selectReceiptFile(event.target.files?.[0] || null)}
                  className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-800"
                />
              </div>

              {proofError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{proofError}</p>}
              {proofSuccess && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{proofSuccess}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setPaymentModalOpen(false); setSelectedLoanForPayment(null); setReceiptFile(null); setProofError(''); setProofSuccess(''); }} className="rounded-md border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={!receiptFile || uploadingProof} className="rounded-md bg-emerald-800 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600">
                  {uploadingProof ? 'Uploading...' : 'Submit proof'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <section aria-labelledby="statement-heading" className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
            <div>
              <h2 id="statement-heading" className="text-lg font-semibold">Statement of account</h2>
              <p className="mt-1 text-sm text-gray-500">Transaction logs</p>
            </div>
            <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950">{loans.length} loans</span>
          </div>
          {loansLoading && <p className="border-b border-gray-100 px-5 py-4 text-sm text-emerald-900" role="status">Loading your loan statement...</p>}
          {loansError && <p className="border-b border-gray-100 px-5 py-4 text-sm text-red-800" role="alert">{loansError}</p>}
          <ul className="divide-y divide-gray-100">
            {loans.map((loan) => {
              const totals = calculateLoanTotals(Number(loan.principal) || 0, Number(loan.interestRate) || 0);
              return (
              <li key={loan.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">Loan {loan.id} · {loan.status || 'active'}</p>
                    <p className="mt-1 text-xs text-gray-500">Created {formatLoanDate(loan.createdAt)} · {formatPaymentTimeframe(loan.dueDate)}</p>
                    <p className="mt-1 text-xs text-gray-600">Principal {peso.format(loan.principal)} · Interest ({loan.interestRate ?? 0}%): {peso.format(loan.interest ?? totals.interest)}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-emerald-900">
                    Total due {peso.format(loan.totalDue ?? totals.totalDue)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                    Lender: {loan.lenderName || 'Unknown lender'}
                  </span>
                  {loan.description && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
                      Purpose: {loan.description}
                    </span>
                  )}
                </div>
                {loan.status === 'active' && (
                  <div className="mt-4 flex justify-end">
                    <button type="button" onClick={() => openPaymentModal(loan)} className="rounded-md bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2">
                      Submit Payment
                    </button>
                  </div>
                )}
              </li>
              );
            })}
            {!loansLoading && !loansError && loans.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-gray-500 sm:px-6">No loan records found for your account.</li>
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
            <span className="text-sm font-semibold text-gray-700">Total Balance</span>
            <span className="text-lg font-bold tabular-nums text-gray-950">{peso.format(outstandingBalance)}</span>
          </div>
        </section>

        <section aria-labelledby="notifications-heading" className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
            <h2 id="notifications-heading" className="text-lg font-semibold">Notifications</h2>
            <p className="mt-1 text-sm text-gray-500">Upcoming payment deadlines</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {activeLoans.map((loan) => (
              <li key={loan.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Loan {loan.id}</p>
                  <p className="mt-1 text-sm leading-5 text-gray-600">{formatPaymentTimeframe(loan.dueDate)} · {peso.format(getLoanOutstanding(loan))} outstanding</p>
                </div>
              </li>
            ))}
            {!loansLoading && !loansError && activeLoans.length === 0 && (
              <li className="px-5 py-8 text-sm text-gray-500 sm:px-6">No upcoming loan payments.</li>
            )}
          </ul>
        </section>
      </div>
    </>
  );
}