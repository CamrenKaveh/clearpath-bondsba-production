function createFaqSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}

function createBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export const PAGE_STRUCTURED_DATA = {
  home: [
    createFaqSchema([
      {
        question: 'What is BondSBA built to do?',
        answer: 'BondSBA helps brokers, CPAs, and surety teams turn incomplete contractor files into cleaner SBA and surety submissions before they hit underwriting.',
      },
      {
        question: 'How does the workflow usually start?',
        answer: 'Most teams start by screening the opportunity, organizing the document checklist, and then using the surety triage workflow to produce a clearer readiness report and handoff package.',
      },
      {
        question: 'Where does BondSBA create the most value?',
        answer: 'BondSBA creates value where contractor files are messy, WIP schedules need review, and brokers or surety teams want fewer follow-up emails before underwriting time is spent.',
      },
    ]),
  ],
  contractorReadiness: [
    createBreadcrumbSchema([
      { name: 'BondSBA Terminal', url: 'https://bondsba.com/' },
      { name: 'Contractor Submission Readiness', url: 'https://bondsba.com/contractor-submission-readiness' },
    ]),
    createFaqSchema([
      {
        question: 'What is contractor submission readiness?',
        answer: 'Contractor submission readiness means the financials, WIP support, ownership documents, and bond or financing context are organized enough for an underwriter to review without first cleaning the file up.',
      },
      {
        question: 'Why does this matter for both SBA and surety?',
        answer: 'Contractor deals often require both financing conversations and surety conversations, so cleaner intake and fewer missing items help both lanes move faster.',
      },
      {
        question: 'What does BondSBA produce after intake?',
        answer: 'BondSBA produces a readiness report with missing items, follow-up questions, friction flags, and sharable output for broker or underwriter handoff.',
      },
    ]),
  ],
  requirements: [
    createBreadcrumbSchema([
      { name: 'BondSBA Terminal', url: 'https://bondsba.com/' },
      { name: 'SBA Loan Requirements', url: 'https://bondsba.com/sba-loan-requirements' },
    ]),
    createFaqSchema([
      {
        question: 'What are the main SBA loan requirements?',
        answer: 'Core SBA loan requirements usually include acceptable operating history, owner and guarantor credit quality, eligible use of proceeds, supportable debt service, and complete borrower documentation.',
      },
      {
        question: 'Do SBA loans require a personal guarantee?',
        answer: 'Many SBA transactions require personal guarantees from owners with significant ownership interests, subject to lender policy and current SBA guidance.',
      },
      {
        question: 'Can weak credit automatically disqualify an SBA loan request?',
        answer: 'Weak credit can create a major issue, but lenders also consider compensating strengths such as cash flow, collateral, industry experience, equity, and documentation quality.',
      },
    ]),
  ],
  documentsLanding: [
    createBreadcrumbSchema([
      { name: 'BondSBA Terminal', url: 'https://bondsba.com/' },
      { name: 'SBA Loan Documents', url: 'https://bondsba.com/sba-loan-documents' },
    ]),
    createFaqSchema([
      {
        question: 'What documents are commonly required for an SBA loan?',
        answer: 'Common SBA loan documents include business and personal tax returns, interim financial statements, a debt schedule, entity formation documents, identification, and support for use of proceeds.',
      },
      {
        question: 'Why do lenders ask for a debt schedule?',
        answer: 'A debt schedule helps the lender review current obligations, payment history, leverage, and overall repayment capacity when underwriting the request.',
      },
      {
        question: 'Do document needs change by transaction type?',
        answer: 'Yes. Real estate, working capital, equipment, acquisitions, and refinance requests often require different supporting materials and transaction-specific exhibits.',
      },
    ]),
  ],
  calculatorLanding: [
    createBreadcrumbSchema([
      { name: 'BondSBA Terminal', url: 'https://bondsba.com/' },
      { name: 'SBA 7(a) Calculator', url: 'https://bondsba.com/sba-7a-calculator' },
    ]),
    createFaqSchema([
      {
        question: 'What should an SBA 7(a) calculator estimate?',
        answer: 'An SBA 7(a) calculator should estimate monthly payment, amortization, approximate debt service, and fee impact using loan amount, rate, term, and program assumptions.',
      },
      {
        question: 'Does an SBA calculator replace lender underwriting?',
        answer: 'No. A calculator is a planning tool. Final structure, pricing, eligibility, and approval depend on lender review and current SBA guidance.',
      },
      {
        question: 'Why do rate and term matter so much in SBA payment estimates?',
        answer: 'Even small changes in rate, amortization term, and guaranty fee assumptions can significantly change monthly payment and debt-service coverage.',
      },
    ]),
  ],
  guarantyFee: [
    createBreadcrumbSchema([
      { name: 'ClearPath SBA', url: 'https://clearpathsbaloan.com/' },
      { name: 'SBA Guaranty Fee Calculator', url: 'https://clearpathsbaloan.com/sba-guaranty-fee-calculator' },
    ]),
    createFaqSchema([
      {
        question: 'What is the SBA 7(a) guaranty fee in FY2026?',
        answer: 'For loans ≤ $150K the fee is waived. For loans $150K–$700K, the fee is 3.0% of the guaranteed portion. For $700K–$1M it is 3.5%, and for loans above $1M up to $5M it is 3.5% on the first $1M guaranteed and 3.75% on the remainder.',
      },
      {
        question: 'How is the SBA guaranty fee calculated?',
        answer: 'The fee is based on the guaranteed portion of the loan, not the full loan amount. For most loans above $150K, the SBA guarantees 75% of the loan amount. The fee rate is then applied to that guaranteed portion.',
      },
      {
        question: 'What is the SBA annual service fee?',
        answer: 'The SBA charges an annual service fee of 0.55% on the outstanding guaranteed balance. This is collected monthly by the lender and passed to the SBA.',
      },
      {
        question: 'Can the SBA guaranty fee be financed into the loan?',
        answer: 'Yes. For most 7(a) loans the upfront guaranty fee can be financed into the loan amount, meaning the borrower does not need to pay it out-of-pocket at closing. Confirm with your lender.',
      },
    ]),
  ],
  surety: [
    createBreadcrumbSchema([
      { name: 'BondSBA Terminal', url: 'https://bondsba.com/' },
      { name: 'Surety Underwriting', url: 'https://bondsba.com/surety-underwriting' },
    ]),
    createFaqSchema([
      {
        question: 'What does surety underwriting review first?',
        answer: 'Surety underwriting typically starts with contractor financial strength, work history, WIP schedules, bank support, and the overall ability to complete the bonded obligation.',
      },
      {
        question: 'Why is WIP analysis important in surety underwriting?',
        answer: 'WIP analysis helps identify profit fade, overbillings, underbillings, project concentration, and execution risk across open jobs.',
      },
      {
        question: 'What makes a surety submission more usable?',
        answer: 'A cleaner surety submission usually includes complete financials, a current WIP schedule, organizational information, requested bond details, and a clear explanation of the underlying opportunity.',
      },
    ]),
  ],
  screener: [
    createBreadcrumbSchema([
      { name: 'BondSBA Terminal', url: 'https://bondsba.com/' },
      { name: 'SBA Eligibility Screener', url: 'https://bondsba.com/sba-eligibility-screener' },
    ]),
    createFaqSchema([
      {
        question: 'What does the SBA eligibility screener do?',
        answer: 'The screener gives an initial pre-underwriting view based on key SBA factors such as business history, guarantor credit, transaction purpose, and potential hard-stop items.',
      },
      {
        question: 'Is the screener a final SBA approval?',
        answer: 'No. The screener is a planning step designed to identify likely friction early. Final credit decisions and eligibility determinations are made by lenders using current SBA guidance.',
      },
      {
        question: 'What should I do after a conditional result?',
        answer: 'Address the flagged items first, then package supporting documents and repayment context before sending the file to lending partners.',
      },
    ]),
  ],
  checklist: [
    createBreadcrumbSchema([
      { name: 'BondSBA Terminal', url: 'https://bondsba.com/' },
      { name: 'SBA Document Checklist', url: 'https://bondsba.com/sba-document-checklist' },
    ]),
    createFaqSchema([
      {
        question: 'What does the document checklist include?',
        answer: 'The checklist covers common SBA borrower and business documentation, including tax returns, interim financial statements, debt schedules, entity records, and transaction support items.',
      },
      {
        question: 'Can I share checklist output with clients or partners?',
        answer: 'Yes. The checklist can be exported as a sharable report so brokers, CPAs, and borrowers can work from the same missing-items view.',
      },
      {
        question: 'Do all lenders ask for the exact same documents?',
        answer: 'No. Core requirements overlap, but lenders may request additional documents based on risk profile, industry, or transaction complexity.',
      },
    ]),
  ],
  compare: [
    createBreadcrumbSchema([
      { name: 'BondSBA Terminal', url: 'https://bondsba.com/' },
      { name: 'SBA Program Comparison', url: 'https://bondsba.com/sba-program-comparison' },
    ]),
    createFaqSchema([
      {
        question: 'What programs are compared in this matrix?',
        answer: 'The comparison matrix focuses on SBA 7(a), SBA 504, and SBA Express using practical factors such as amount limits, term, use case, and processing profile.',
      },
      {
        question: 'Which SBA program is best for every deal?',
        answer: 'There is no universal best program. The right fit depends on intended use of proceeds, borrower profile, repayment capacity, and the specific lender strategy.',
      },
      {
        question: 'Should I use this matrix alone for submission decisions?',
        answer: 'No. Use the matrix as a planning reference, then pair it with eligibility screening and document readiness before lender outreach.',
      },
    ]),
  ],
  opsQueue: [
    createBreadcrumbSchema([
      { name: 'BondSBA Terminal', url: 'https://bondsba.com/' },
      { name: 'Submission Ops Queue', url: 'https://bondsba.com/submission-ops-queue' },
    ]),
    createFaqSchema([
      {
        question: 'What is the submission ops queue used for?',
        answer: 'It is used to manage active deal packets across team roles, prioritize follow-up work, and track whether files are genuinely ready for lender or surety handoff.',
      },
      {
        question: 'Can teams use this with existing spreadsheets?',
        answer: 'Yes. The queue supports CSV intake and export so teams can keep their current Excel-based process while adding readiness triage and repeatable handoff rules.',
      },
      {
        question: 'Why does this increase repeat usage?',
        answer: 'Teams return to the queue daily or weekly to update missing items, owner assignments, and next-action status as files progress toward underwriting-ready quality.',
      },
    ]),
  ],
};

export const SEO_LANDING_CONTENT = {
  contractorReadiness: {
    eyebrow: 'CONTRACTOR SUBMISSION READINESS',
    title: 'Cleaner contractor submissions before underwriting.',
    intro: 'BondSBA helps brokers, CPAs, and surety teams replace scattered spreadsheet/email cleanup with one readiness workflow that turns incomplete contractor files into cleaner SBA and surety submissions before they hit underwriting.',
    primaryCta: { label: 'Open Surety Triage Workspace', page: 'suretyDashboard', requiresAuth: true },
    secondaryCta: { label: 'Run Eligibility Screener', page: 'screener', requiresAuth: false },
    sections: [
      ['What contractor files usually get wrong', 'Incomplete financial statements, stale WIP schedules, weak backlog support, and missing follow-up context force underwriters to spend time cleaning up the file instead of judging the opportunity.'],
      ['How BondSBA creates leverage', 'BondSBA replaces manual chase lists with a submission-readiness workflow that surfaces missing items, flags friction early, and packages cleaner takeaways before the file reaches lender or surety review.'],
      ['Where SBA and surety meet', 'Contractor deals often sit between bonding needs, working capital pressure, and documentation gaps. BondSBA treats SBA as the capital lane and surety as the professional review wedge.'],
      ['Best next step', 'Queue the current contractor file, generate the readiness report, and share one owner-scoped packet output instead of sending fragmented follow-up threads.'],
    ],
    supportPage: { label: 'Review Surety Underwriting Guide', page: 'surety' },
  },
  requirements: {
    eyebrow: 'SBA LOAN REQUIREMENTS',
    title: 'SBA loan requirements for cleaner financing submissions.',
    intro: 'Use this page to understand the core SBA loan requirements that shape lender conversations, then map them into a practical prep workflow so teams stop sending incomplete files.',
    primaryCta: { label: 'Run Eligibility Screener', page: 'screener', requiresAuth: false },
    secondaryCta: { label: 'Open Document Checklist', page: 'checklist', requiresAuth: false },
    sections: [
      ['What lenders look at first', 'Most SBA reviews start with business history, repayment capacity, ownership profile, borrower credit, and whether the requested proceeds fit program rules.'],
      ['What affects approval', 'Cash flow, debt-service coverage, guarantor strength, equity injection, management depth, and documentation quality all influence lender appetite.'],
      ['Common mistakes', 'Teams often reach lenders too early with spreadsheet-only prep, unclear use of proceeds, weak financial backup, missing debt schedules, or unresolved credit issues.'],
      ['Best next step', 'Use the screener to surface issues, then build a checklist-driven packet so the file reaches lenders in a cleaner, reviewable state on first pass.'],
    ],
    supportPage: { label: 'Compare SBA Programs', page: 'compare' },
  },
  documentsLanding: {
    eyebrow: 'SBA LOAN DOCUMENTS',
    title: 'SBA loan documents borrowers usually need before underwriting.',
    intro: 'This page focuses on the SBA loan documents that most lenders and referral partners ask for early: tax returns, interim financials, debt schedules, entity records, identification, and support for proceeds or collateral.',
    primaryCta: { label: 'Build Document Checklist', page: 'checklist', requiresAuth: false },
    secondaryCta: { label: 'Review Loan Requirements', page: 'requirements', requiresAuth: false },
    sections: [
      ['What documents are usually requested', 'Most files need business and personal tax returns, interim financial statements, debt schedules, organizational documents, ownership details, and use-of-proceeds support.'],
      ['Why document quality matters', 'Faster reviews happen when numbers reconcile, entity records match ownership, and the file clearly supports repayment capacity and transaction structure.'],
      ['Common missing items', 'Debt schedules, current interim statements, signed borrower forms, and transaction-specific exhibits are among the most common gaps that slow submissions down.'],
      ['Best next step', 'Generate the checklist first, then use the screener or calculator once the documentation base is organized enough to support a real discussion.'],
    ],
    supportPage: { label: 'Run Eligibility Screener', page: 'screener' },
  },
  calculatorLanding: {
    eyebrow: 'SBA 7(A) CALCULATOR',
    title: 'SBA 7(a) calculator guidance for payment, fee, and term planning.',
    intro: 'An SBA 7(a) calculator should help teams estimate monthly payment, debt service, amortization, and fee impact before they take a submission to a lender or partner review.',
    primaryCta: { label: 'Open SBA Loan Calculator', page: 'calculator', requiresAuth: true },
    secondaryCta: { label: 'Compare SBA Programs', page: 'compare', requiresAuth: false },
    sections: [
      ['What the calculator should estimate', 'The core model should cover loan amount, rate, term, monthly payment, approximate guaranty fee impact, and the way amortization changes over time.'],
      ['What changes the payment most', 'Interest rate, amortization term, guaranty fee treatment, and the underlying SBA product structure can all move the monthly debt-service number meaningfully.'],
      ['What a calculator does not replace', 'A calculator does not replace lender underwriting, final pricing, policy exceptions, or current SBA guidance. It improves early-stage planning, not final approval.'],
      ['Best next step', 'Model the payment first, then move into the eligibility screener and checklist so the structure and the file quality improve together.'],
    ],
    supportPage: { label: 'Open Eligibility Screener', page: 'screener' },
  },
  guarantyFee: {
    eyebrow: 'SBA GUARANTY FEE CALCULATOR',
    title: 'SBA 7(a) Guaranty Fee Calculator FY2026.',
    intro: 'Calculate your SBA 7(a) loan guaranty fee instantly. Free calculator for SBA brokers and lenders — updated for the FY2026 fee schedule.',
    primaryCta: { label: 'Calculate Guaranty Fee', page: 'guarantyFee', requiresAuth: false },
    secondaryCta: { label: 'Run Eligibility Screener', page: 'screener', requiresAuth: false },
    sections: [
      ['What the SBA guaranty fee is', 'The SBA charges a one-time upfront guaranty fee based on the guaranteed portion of the loan. For most 7(a) loans above $150K, the guarantee is 75% of the loan amount.'],
      ['FY2026 fee schedule tiers', 'Loans ≤ $150K are fee-waived. $150K–$700K: 3.0% of guaranteed portion. $700K–$1M: 3.5%. $1M–$5M: 3.5% up to $1M guaranteed, then 3.75% on the balance.'],
      ['Annual service fee', 'The SBA also charges an annual service fee of 0.55% on the outstanding guaranteed balance, collected monthly by the lender.'],
      ['How to use the calculator', 'Enter your loan amount and term. The calculator shows guaranteed amount, upfront guaranty fee, annual service fee, and total first-year cost of the guaranty.'],
    ],
    supportPage: { label: 'Open Payment Calculator', page: 'calculatorLanding' },
  },
  surety: {
    eyebrow: 'SURETY UNDERWRITING',
    title: 'Surety submission triage workflow for cleaner contractor files and faster underwriter review.',
    intro: 'BondSBA Terminal is built for surety teams that need to replace fragmented WIP/email cleanup with a repeatable triage workflow that turns messy contractor files into underwriter-usable submission packages.',
    primaryCta: { label: 'Open Triage Workspace', page: 'suretyDashboard', requiresAuth: true },
    secondaryCta: { label: 'Review WIP Workflow', page: 'wip', requiresAuth: true },
    sections: [
      ['What underwriters need first', 'Most surety reviews start with contractor financial strength, current WIP, backlog quality, requested bond details, and enough supporting context to understand where the real follow-up risk sits.'],
      ['Where triage usually breaks down', 'Weak submissions arrive with stale WIP schedules, incomplete financials, unsupported working-capital explanations, and files that still need manual re-keying before underwriting can start.'],
      ['How BondSBA creates value', 'BondSBA helps teams organize the file, normalize contractor numbers, and pressure-test WIP earlier so underwriters receive cleaner packages with fewer clarifying callbacks.'],
      ['Best next step', 'Open the triage workspace, collect the current file, then run spreading and WIP review to surface follow-up items before the submission goes out.'],
    ],
    supportPage: { label: 'Open Financial Spreading', page: 'spreading' },
  },
};
