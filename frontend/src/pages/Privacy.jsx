// The privacy policy.
//
// Google will not let the OAuth consent screen be published without a public privacy
// policy URL, and it is worth having anyway: the live test asks real students to sign up.
// It describes what the API actually stores - see backend/src/routes/ - so a change to
// what is stored should change this page too.

const CONTACT = 'pmykhailyk@gmail.com';
const UPDATED = '18 November 2026';

export function Privacy() {
  return (
    <article className="card prose">
      <p className="eyebrow">Privacy policy · updated {UPDATED}</p>
      <h1>Privacy</h1>

      <p>
        sPOKiy is a student project for the Computer Organization Principles course at the
        Ukrainian Catholic University. It is not a company and does not make money from your
        data. This page says what it keeps about you and why.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account</strong>: your e-mail address, and if you sign in with Google,
          your name as Google gives it. Passwords are handled by Amazon Cognito; we never see
          them. Signing in with Google gives us your e-mail, name and Google account id — nothing
          else from your Google account.
        </li>
        <li>
          <strong>Your progress</strong>: which topics you opened and your latest quiz score
          for each.
        </li>
        <li>
          <strong>Topic requests</strong>: the topics you voted for, and whether you said you
          would donate.
        </li>
        <li>
          <strong>Feedback</strong>: anything you write in a feedback form, with your e-mail so
          we can reply.
        </li>
      </ul>
      <p>
        Lessons, cheat sheets and quizzes work without an account; nothing is stored about you
        when you use them signed out. There are no ads, no analytics and no tracking cookies.
        Your browser keeps your sign-in session in local storage so you stay signed in.
      </p>

      <h2>Where it is kept</h2>
      <p>
        On Amazon Web Services in Frankfurt (eu-central-1): accounts in Amazon Cognito, the rest
        in Amazon DynamoDB.
      </p>

      <h2>What we do with it</h2>
      <p>
        Run the site, and count sign-ups, returning users and topic requests for our course
        report. The report uses totals only, never names or e-mail addresses. We do not sell
        or share your data with anyone.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address you signed up
        with, and we will delete your account and everything linked to it.
      </p>
    </article>
  );
}

export default Privacy;
