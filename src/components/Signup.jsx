import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuthErrorMessage, useAuth } from '../AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';

const STEPS = ['Registration', 'Email verification', 'KYC upload'];
const MOCK_GOOGLE_CODE = '123456';
const STARTING_CREDIT_LIMIT = 500;

function simulateEmailVerificationRequest() {
  return new Promise((resolve) => window.setTimeout(resolve, 400));
}

export default function Signup() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    gmailAddress: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    occupation: '',
    monthlySalary: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [idType, setIdType] = useState('National ID');
  const [validId, setValidId] = useState(null);
  const [selfieTaken, setSelfieTaken] = useState(false);
  const [kycError, setKycError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { register } = useAuth();

  function updateField(event) {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setAuthError('');

    try {
      if (step === 1) {
        if (!acceptedTerms) return;
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        await simulateEmailVerificationRequest();
        setStep(2);
        return;
      }

      if (step === 2) {
        await simulateEmailVerificationRequest();
        if (verificationCode !== MOCK_GOOGLE_CODE) {
          throw new Error('The confirmation code is invalid. Check the code and try again.');
        }
        setStep(3);
        return;
      }

      if (!validId || !selfieTaken) {
        setKycError('Upload your selected ID type and take a selfie to finish this demo step.');
        return;
      }

      setKycError('');
      await register({ ...formData, idType, idFileName: validId.name, selfieTaken, startingCreditLimit: STARTING_CREDIT_LIMIT });
      navigate('/', { replace: true });
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, 'Unable to complete registration. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  function handleFileChange(event) {
    setValidId(event.target.files?.[0] ?? null);
    setKycError('');
  }

  return (
    <AuthLayout>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-sm font-semibold text-emerald-700">New borrower account</p>
        <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-gray-600">Step {step} of 3 · {STEPS[step - 1]}</p>

        <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="Signup progress">
          {STEPS.map((label, index) => {
            const stepNumber = index + 1;
            const isCurrent = stepNumber === step;
            const isComplete = stepNumber < step;
            return (
              <li key={label} aria-current={isCurrent ? 'step' : undefined} className="min-w-0">
                <div className={`mb-2 h-1.5 rounded-full ${isComplete ? 'bg-amber-400' : isCurrent ? 'bg-emerald-600' : 'bg-gray-200'}`} />
                <span className={`text-xs font-semibold ${isCurrent ? 'text-emerald-800' : isComplete ? 'text-gray-800' : 'text-gray-500'}`}>
                  {stepNumber}. {label}
                </span>
              </li>
            );
          })}
        </ol>

        {authError && <p role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{authError}</p>}

        <form className="mt-7" onSubmit={handleSubmit}>
          {step === 1 && (
            <fieldset className="space-y-4">
              <legend className="mb-4 text-lg font-semibold">Registration details</legend>
              <div>
                <label htmlFor="signup-full-name" className="mb-1.5 block text-sm font-medium text-gray-800">Full name</label>
                <input id="signup-full-name" name="fullName" type="text" autoComplete="name" value={formData.fullName} onChange={updateField} required className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" />
              </div>
              <div>
                <label htmlFor="signup-gmail" className="mb-1.5 block text-sm font-medium text-gray-800">Gmail address</label>
                <input id="signup-gmail" name="gmailAddress" type="email" inputMode="email" autoComplete="email" pattern=".+@gmail[.]com" title="Enter a valid Gmail address ending in @gmail.com" placeholder="you@gmail.com" value={formData.gmailAddress} onChange={updateField} required className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" />
              </div>
              <div>
                <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-gray-800">Password</label>
                <input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={6} value={formData.password} onChange={updateField} required className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" />
              </div>
              <div>
                <label htmlFor="signup-confirm-password" className="mb-1.5 block text-sm font-medium text-gray-800">Confirm password</label>
                <input id="signup-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} value={formData.confirmPassword} onChange={updateField} required className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" />
              </div>
              <div>
                <label htmlFor="signup-phone" className="mb-1.5 block text-sm font-medium text-gray-800">Phone number <span className="font-normal text-gray-500">(optional for account recovery)</span></label>
                <input id="signup-phone" name="phoneNumber" type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. +63 917 555 0123" value={formData.phoneNumber} onChange={updateField} className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" />
              </div>
              <div>
                <label htmlFor="signup-occupation" className="mb-1.5 block text-sm font-medium text-gray-800">Occupation / work</label>
                <input id="signup-occupation" name="occupation" type="text" autoComplete="organization-title" placeholder="e.g. Market vendor" value={formData.occupation} onChange={updateField} required className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" />
              </div>
              <div>
                <label htmlFor="signup-salary" className="mb-1.5 block text-sm font-medium text-gray-800">Monthly salary range</label>
                <select id="signup-salary" name="monthlySalary" value={formData.monthlySalary} onChange={updateField} required className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15">
                  <option value="" disabled>Select a monthly range</option>
                  <option value="under-10000">Under ₱10,000</option>
                  <option value="10000-19999">₱10,000–₱19,999</option>
                  <option value="20000-39999">₱20,000–₱39,999</option>
                  <option value="40000-59999">₱40,000–₱59,999</option>
                  <option value="60000-plus">₱60,000 or more</option>
                </select>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-gray-200 p-3">
                <input id="signup-terms" type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required className="mt-0.5 size-4 shrink-0 accent-emerald-700 focus:ring-emerald-600" />
                <div className="text-sm leading-5 text-gray-700">
                  <label htmlFor="signup-terms">I agree to the </label>
                  <button type="button" onClick={() => setIsTermsOpen(true)} className="font-semibold text-emerald-800 underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-600">
                    Terms and Regulations
                  </button>
                </div>
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-semibold">Verify your Gmail address</legend>
              <p className="text-sm leading-6 text-gray-600">Enter the Google confirmation code sent to <span className="font-semibold text-gray-800">{formData.gmailAddress}</span>.</p>
              <div>
                <label htmlFor="google-confirmation-code" className="mb-1.5 block text-sm font-medium text-gray-800">6-digit Google confirmation code</label>
                <input id="google-confirmation-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={verificationCode} onChange={(event) => { setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setAuthError(''); }} placeholder="000000" required className="w-full rounded-md border border-gray-300 px-3 py-3 text-center font-mono text-xl tracking-[0.25em] outline-none placeholder:text-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" />
              </div>
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">Mock verification code: <span className="font-mono font-bold">123456</span></p>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-semibold">Identity verification</legend>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-950">Standard starting credit limit</p>
                <p className="mt-1 text-sm text-amber-950">₱{STARTING_CREDIT_LIMIT.toLocaleString('en-PH')}</p>
                <p className="mt-1 text-xs leading-5 text-amber-900">All new accounts start at this limit, regardless of the declared salary range.</p>
              </div>
              <p className="text-sm leading-6 text-gray-600">Upload an identity document and take a mock selfie to finish your registration.</p>
              <div>
                <label htmlFor="id-type" className="mb-1.5 block text-sm font-medium text-gray-800">ID type</label>
                <select id="id-type" value={idType} onChange={(event) => setIdType(event.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15">
                  <option value="National ID">National ID</option>
                  <option value="Driver's License">Driver's License</option>
                </select>
              </div>
              <input ref={fileInputRef} id="valid-id-upload" type="file" accept="image/*,.pdf" onChange={handleFileChange} className="sr-only" aria-label={`Choose ${idType} file`} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-md border border-emerald-700 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2">
                Upload {idType}
              </button>
              {validId && <p className="truncate text-sm text-gray-600" role="status">Selected: {validId.name}</p>}
              <button type="button" onClick={() => { setSelfieTaken(true); setKycError(''); }} className={`w-full rounded-md px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${selfieTaken ? 'bg-amber-100 text-amber-950 focus:ring-amber-400' : 'bg-amber-400 text-amber-950 hover:bg-amber-300 focus:ring-amber-500'}`}>
                {selfieTaken ? 'Selfie Captured' : 'Take Selfie'}
              </button>
              {selfieTaken && <p className="text-sm text-emerald-800" role="status">Mock selfie captured.</p>}
              {kycError && <p className="text-sm text-red-700" role="alert">{kycError}</p>}
            </fieldset>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
            {step > 1 ? (
              <button type="button" disabled={isLoading} onClick={() => { setStep((currentStep) => currentStep - 1); setKycError(''); setAuthError(''); }} className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
                Back
              </button>
            ) : (
              <Link to="/login" className="text-sm font-semibold text-gray-600 underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-gray-900">Already registered?</Link>
            )}
            <button type="submit" disabled={isLoading || (step === 1 && !acceptedTerms)} className="rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600">
              {isLoading ? 'Please wait...' : step === 1 ? 'Send Google Verification Code' : step === 2 ? 'Verify Code' : 'Complete signup'}
            </button>
          </div>
        </form>
      </section>

      {isTermsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-gray-950/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsTermsOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="terms-heading" className="my-auto w-full max-w-lg rounded-lg bg-white p-6 shadow-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">CrediTrack · Sample terms</p>
                <h2 id="terms-heading" className="mt-1 text-xl font-semibold">Terms and Regulations</h2>
              </div>
              <button type="button" onClick={() => setIsTermsOpen(false)} aria-label="Close terms" className="grid size-9 shrink-0 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600">×</button>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-6 text-gray-600">
              <p>By creating an account, you confirm that the registration details and identity documents you provide are accurate and belong to you.</p>
              <p>Declared salary information is collected for account review. It does not determine your initial credit limit. All new accounts receive a standard starting limit of ₱500 while verification is completed.</p>
              <p>You agree to keep your account secure, make repayments by their due dates, and contact support if your account information changes.</p>
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">This is sample text for a product demo and is not a legal agreement.</p>
            </div>
            <button type="button" onClick={() => setIsTermsOpen(false)} className="mt-6 min-h-11 w-full rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2">Close</button>
          </section>
        </div>
      )}
    </AuthLayout>
  );
}