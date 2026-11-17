/**
 * RedactThenAsk - High-Realism Document Presets
 * Pre-configured realistic documents showcasing different PII/PHI scenarios.
 */

const PRESET_DOCUMENTS = {
  medical: {
    id: 'medical',
    name: 'Clinical Oncology & Pathology Report',
    category: 'Healthcare / PHI',
    policyId: 'HIPAA_CLINICAL',
    icon: '🏥',
    defaultPrompt: 'Explain the diagnosis, highlight the abnormal lab values, and summarize the doctor\'s recommended treatment plan in plain English.',
    content: `PATIENT DIAGNOSTIC & PATHOLOGY REPORT
Confidential Medical Record - For Professional Clinical Use Only

Facility: St. Jude Memorial Hospital, Cancer Care Pavilion
Attending Physician: Dr. Aris Thorne, MD, Oncology & Hematology
Referring Clinic: Cedar Valley Medical Center
Date of Examination: October 14, 2024

PATIENT DEMOGRAPHICS:
Patient Name: Elena Vance
DOB: 04/18/1979
Gender: Female
MRN: ONC-892410-X
Contact Phone: (555) 839-2041
Email: elena.vance@biohealth-research.org
Residential Address: 412 Sycamore Creek Lane, Suite 4B, Rochester, MN

CLINICAL PRESENTATION & CHIEF COMPLAINT:
Patient Elena Vance presents for 6-month oncology follow-up following surgical resection of left axillary lymphadenopathy. Reports persistent mild fatigue and occasional peripheral neuropathy.

DIAGNOSTIC LAB RESULTS:
- Fasting Blood Glucose: 182 mg/dL (ELEVATED - normal 70-99 mg/dL)
- Hemoglobin A1c: 8.4% (ELEVATED - indicates uncontrolled hyperglycemia)
- Absolute Neutrophil Count (ANC): 1.6 x10^3/uL (Borderline low)
- CA-125 Tumor Marker: 18 U/mL (Normal range < 35 U/mL - stable)
- CEA: 2.1 ng/mL (Normal range < 3.0 ng/mL - stable)
- Bilirubin Total: 0.9 mg/dL (Normal)

PATHOLOGY & RADIOLOGY FINDINGS:
Contrast-enhanced CT scan performed on October 10, 2024 at St. Jude Memorial Hospital revealed no discrete recurrent nodal masses in the left axilla. Spleen and liver morphology normal. Bilateral renal perfusion preserved.

ASSESSMENT & PLAN:
1. Secondary Type 2 Diabetes Mellitus with poor glycemic control (HbA1c 8.4%). Initiating Metformin 850mg orally twice daily with meals.
2. Status post left axillary nodal resection: No radiographic evidence of active malignant progression. Continue 3-month surveillance schedule.
3. Order follow-up Comprehensive Metabolic Panel and repeat HbA1c in 90 days.
4. Referral to Dr. Aris Thorne at St. Jude Memorial Hospital endocrinology clinic for diabetic diet education.

Signed electronically by:
Dr. Aris Thorne, MD
Department of Hematology & Medical Oncology`
  },

  legal: {
    id: 'legal',
    name: 'Executive Employment & Equity Agreement',
    category: 'Corporate / Legal',
    policyId: 'LEGAL_CONTRACT',
    icon: '📄',
    defaultPrompt: 'Summarize the executive compensation package, equity vesting terms, and restrictive non-compete covenants.',
    content: `EXECUTIVE EMPLOYMENT AGREEMENT & EQUITY INCENTIVE PLAN

This Employment Agreement ("Agreement") is entered into on September 22, 2024, by and between Apex CyberSystems, Inc., a Delaware corporation located at 450 Innovation Parkway, Suite 800, San Francisco, CA ("Employer"), and Marcus Sterling, an individual residing at 1284 Marina Vista Blvd, San Francisco, CA ("Executive").

1. POSITION AND DUTIES
Employer hereby employs Marcus Sterling as Chief Technology Officer (CTO). Executive will report directly to the Chief Executive Officer and Board of Directors. Executive will oversee development of proprietary machine learning architecture under Codename Bluebird and Project Titan.

2. COMPENSATION & INCENTIVES
(a) Base Salary: Employer shall pay Executive an annual base salary of $385,000, payable semi-monthly in accordance with normal payroll practices.
(b) Performance Bonus: Executive shall be eligible for an annual incentive target bonus of $120,000, contingent upon achievement of corporate technical milestones.
(c) Equity Grant: Subject to Board approval, Executive will receive an option to purchase 75,000 Stock Options of Common Stock. Equity vests under a standard 4-year schedule: 25% vesting on the first-year anniversary of October 1, 2024 (the "Cliff"), and remaining shares vesting in 36 equal monthly installments thereafter.
(d) Signing Bonus: Employer agrees to provide a one-time signing bonus of $50,000, subject to standard withholdings.

3. CONFIDENTIALITY AND RESTRICTIVE COVENANTS
(a) Executive agrees that all specifications, source code, and algorithms related to Project Titan remain the exclusive intellectual property of Apex CyberSystems, Inc.
(b) Non-Competition: For a period of 18 months following termination of employment, Executive shall not directly engage with or advise competing cloud AI enterprises in California.
(c) Direct Deposit: Compensation shall be remitted to Marcus Sterling via direct deposit to Bank Account # 9812-4029-11, Routing # 121000358.

IN WITNESS WHEREOF, the parties execute this Agreement:
Apex CyberSystems, Inc.
By: David Chen, Chief Executive Officer
Executive: Marcus Sterling, CTO
Tax ID / SSN: 219-48-9032`
  },

  payroll: {
    id: 'payroll',
    name: 'Confidential Paystub & Direct Deposit Slip',
    category: 'Financial / Payroll',
    policyId: 'FINANCIAL_PAYROLL',
    icon: '💰',
    defaultPrompt: 'Break down my gross vs net earnings, calculate the deduction percentage, and explain where tax withholdings are going.',
    content: `CONFIDENTIAL BI-WEEKLY EARNINGS STATEMENT
Global FinTech Innovations, Ltd.
Payroll Office: 88 Wall Street Plaza, Floor 14, New York, NY 10005

EMPLOYEE INFORMATION:
Employee Name: Sarah Jenkins
Employee ID: EMP-9042-TX
SSN: 672-11-4920
Department: Quantitative Algorithmic Trading
Pay Period: 10/01/2024 - 10/15/2024
Pay Date: October 18, 2024
Home Address: 742 Evergreen Terrace, Springfield, OR 97477
Contact: s.jenkins@fintech-ventures.com | Phone: (503) 555-0144

EARNINGS BREAKDOWN:
- Regular Salary (80.00 hrs): $8,200.00
- Overtime / On-Call Premium: $650.00
- Quarterly Bonus Discretionary: $800.00
TOTAL GROSS PAY: $9,650.00

STATUTORY TAX WITHHOLDINGS:
- Federal Income Tax (FIT): $1,850.00
- Social Security Tax (FICA-OASDI): $598.30
- Medicare Tax (FICA-HI): $139.93
- State Income Tax (OR): $724.00
TOTAL TAXES WITHHELD: $3,312.23

PRE-TAX & VOLUNTARY DEDUCTIONS:
- 401(k) Retirement Contribution: $750.00
- Premium PPO Health Care: $220.00
- Dental & Vision Plan: $45.00
- Health Savings Account (HSA): $150.00
TOTAL DEDUCTIONS: $1,165.00

NET PAY SUMMARY:
NET TAKE-HOME PAY: $5,172.77

DIRECT DEPOSIT DISBURSEMENT:
Disbursed electronically to Chase Bank
Account Holder: Sarah Jenkins
Routing Number: 021000021
Checking Account #: 88492019482
Disbursement Amount: $5,172.77`
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRESET_DOCUMENTS };
}
export { PRESET_DOCUMENTS };
