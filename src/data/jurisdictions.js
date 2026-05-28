/**
 * Jurisdiction-specific surety and construction-law reference data.
 *
 * Sources are public-record statutes and regulator names. Always treated as
 * informational — not legal advice. Each region row carries:
 *   - statute  : the controlling Act / framework
 *   - regulator: the agency or court that enforces it
 *   - bondNote : the dominant bond / guarantee instrument
 */

export const JURISDICTIONS = [
  {
    code: 'US', flag: '🇺🇸', label: 'United States',
    docStandard: 'AIA contract documents (A312 performance/payment bonds)',
    federalStatute: 'Miller Act 40 U.S.C. §§ 3131-3134 (federal contracts ≥ $150K)',
    carriers: ['Travelers', 'Liberty Mutual', 'Zurich', 'CNA Surety', 'ICW Group', 'AmTrust', 'Old Republic', 'Merchants Bonding', 'Chubb'],
    regions: [
      { code: 'CA', label: 'California',     statute: 'Cal. Pub. Cont. Code §§ 7103, 9550 (Little Miller Act)',  regulator: 'California Department of Insurance',    bondNote: 'Performance & payment bonds; CSLB contractor license bonds required' },
      { code: 'TX', label: 'Texas',          statute: 'Tex. Gov\'t Code § 2253 (McGregor Act)',                    regulator: 'Texas Department of Insurance',         bondNote: 'Public works ≥ $25K require P&P bonds' },
      { code: 'FL', label: 'Florida',        statute: 'Fla. Stat. § 255.05 (Little Miller Act)',                   regulator: 'Florida Office of Insurance Regulation',bondNote: 'Public construction > $100K requires bond' },
      { code: 'NY', label: 'New York',       statute: 'N.Y. State Fin. Law § 137',                                 regulator: 'NY Dept. of Financial Services',        bondNote: 'Public projects > $100K require P&P bonds' },
      { code: 'IL', label: 'Illinois',       statute: '30 ILCS 550 (Public Construction Bond Act)',                regulator: 'Illinois Dept. of Insurance',           bondNote: 'Public projects > $50K require bond' },
      { code: 'OH', label: 'Ohio',           statute: 'Ohio Rev. Code § 153.54',                                   regulator: 'Ohio Dept. of Insurance',               bondNote: 'Public improvement bonds required statewide' },
      { code: 'GA', label: 'Georgia',        statute: 'O.C.G.A. § 13-10-40 (Little Miller Act)',                   regulator: 'Georgia Office of Insurance',           bondNote: 'Public works > $100K bonded' },
      { code: 'NC', label: 'North Carolina', statute: 'N.C. Gen. Stat. § 44A-26',                                  regulator: 'NC Dept. of Insurance',                 bondNote: 'Public > $300K performance + payment bonds' },
      { code: 'VA', label: 'Virginia',       statute: 'Va. Code § 2.2-4337 (Little Miller Act)',                   regulator: 'Virginia Bureau of Insurance',          bondNote: 'Public projects > $500K bonded' },
      { code: 'AZ', label: 'Arizona',        statute: 'A.R.S. § 34-222',                                           regulator: 'Arizona Dept. of Insurance',            bondNote: 'Public works require P&P bonds' },
      { code: 'WA', label: 'Washington',     statute: 'RCW 39.08',                                                 regulator: 'WA Office of the Insurance Commissioner',bondNote: 'Public > $35K require bond + retainage' },
      { code: 'CO', label: 'Colorado',       statute: 'C.R.S. § 38-26-106',                                        regulator: 'Colorado Division of Insurance',        bondNote: 'Public projects > $50K bonded' },
      { code: 'MA', label: 'Massachusetts',  statute: 'M.G.L. c.149 § 29',                                         regulator: 'MA Division of Insurance',              bondNote: 'Public > $25K require P&P bond' },
      { code: 'NJ', label: 'New Jersey',     statute: 'N.J. Stat. § 2A:44-143 (Trust Fund Act)',                   regulator: 'NJ Dept. of Banking & Insurance',       bondNote: 'Public works > $25K require P&P bond' },
      { code: 'PA', label: 'Pennsylvania',   statute: '8 P.S. § 191 (Public Works Contractors\' Bond Law)',         regulator: 'PA Insurance Department',               bondNote: 'Public projects > $5K require bond' },
      { code: 'TN', label: 'Tennessee',      statute: 'Tenn. Code § 12-4-201',                                     regulator: 'TN Dept. of Commerce & Insurance',      bondNote: 'Public projects > $100K bonded' },
      { code: 'MD', label: 'Maryland',       statute: 'Md. Code, State Fin. & Proc. § 17-103',                     regulator: 'Maryland Insurance Administration',     bondNote: 'Public > $100K P&P bonds required' },
      { code: 'MI', label: 'Michigan',       statute: 'MCL 129.201',                                               regulator: 'Michigan Dept. of Insurance',           bondNote: 'Public works > $50K bonded' },
      { code: 'OTHER', label: 'Other US state', statute: 'See state Little Miller Act',                              regulator: 'State insurance department',            bondNote: 'Most states bond public works > $25K-$100K' },
    ],
  },
  {
    code: 'CA-COUNTRY', flag: '🇨🇦', label: 'Canada',
    docStandard: 'CCDC 2 (stipulated price), CCDC 5A/B (construction management), CCDC 14 (design-build)',
    federalStatute: 'Federal Real Property and Federal Immovables Act (federal contracts)',
    carriers: ['Trisura', 'Intact', 'Aviva', 'The Guarantee Company', 'Travelers Canada', 'Liberty Mutual Canada', 'Zurich Canada', 'Sovereign'],
    regions: [
      { code: 'ON', label: 'Ontario',           statute: 'Construction Act, R.S.O. 1990 c. C.30 (incl. 2019 prompt-payment amendments)',  regulator: 'Financial Services Regulatory Authority (FSRA)', bondNote: 'L&M bond + P&P bond, mandatory on public projects > $500K' },
      { code: 'BC', label: 'British Columbia',  statute: 'Builders Lien Act, S.B.C. 1997 c. 45',                                          regulator: 'BC Financial Services Authority (BCFSA)',         bondNote: '10% statutory holdback; P&P bonds standard on tendered work' },
      { code: 'AB', label: 'Alberta',           statute: 'Prompt Payment and Construction Lien Act, S.A. 2020 c. P-26.4',                 regulator: 'Alberta Insurance Council',                       bondNote: '8 mo lien rights; 90/120 mo bond claim windows' },
      { code: 'QC', label: 'Québec',            statute: 'Civil Code of Québec arts. 2123-2129; Régie du bâtiment licence rules',         regulator: 'Régie du bâtiment du Québec (RBQ)',               bondNote: 'Licence bond required for contractors; cautionnement d\'exécution standard' },
      { code: 'MB', label: 'Manitoba',          statute: 'Builders\' Liens Act, C.C.S.M. c. B91',                                          regulator: 'Insurance Council of Manitoba',                   bondNote: '7.5% holdback; P&P bonds on public projects' },
      { code: 'SK', label: 'Saskatchewan',      statute: 'Builders\' Lien Act, S.S. 1984-85-86 c. B-7.1',                                  regulator: 'Saskatchewan Insurance Council',                  bondNote: '10% holdback; bond on tenders > $200K' },
      { code: 'NS', label: 'Nova Scotia',       statute: 'Builders\' Lien Act, R.S.N.S. 1989 c. 277',                                       regulator: 'Nova Scotia Office of the Superintendent of Insurance', bondNote: '10% holdback; CCDC-format bonds standard' },
      { code: 'NB', label: 'New Brunswick',     statute: 'Mechanics\' Lien Act, R.S.N.B. 1973 c. M-6',                                     regulator: 'Financial and Consumer Services Commission',      bondNote: 'Lien rights 60 days post-completion' },
      { code: 'NL', label: 'Newfoundland & Labrador', statute: 'Mechanics\' Lien Act, R.S.N.L. 1990 c. M-3',                                regulator: 'Service NL',                                       bondNote: 'Holdback varies; bonds on public projects' },
      { code: 'PE', label: 'Prince Edward Island', statute: 'Mechanics\' Lien Act, R.S.P.E.I. 1988 c. M-4',                                regulator: 'PEI Office of the Superintendent of Insurance',   bondNote: 'P&P bonds standard on tendered work' },
      { code: 'YT', label: 'Yukon / NWT / Nunavut', statute: 'Territorial Mechanics Lien Acts',                                            regulator: 'Territorial superintendents',                     bondNote: 'Federal Crown contract bonding typical' },
    ],
  },
  {
    code: 'GB', flag: '🇬🇧', label: 'United Kingdom',
    docStandard: 'JCT 2016/2024 suites · NEC4 ECC · FIDIC for international works',
    federalStatute: 'Housing Grants, Construction and Regeneration Act 1996 (as amended by LDEDC Act 2009)',
    carriers: ['Tokio Marine HCC', 'Liberty Mutual London', 'Zurich UK', 'Euler Hermes', 'Atradius', 'Aviva UK'],
    regions: [
      { code: 'EW', label: 'England & Wales', statute: 'Housing Grants, Construction and Regeneration Act 1996; Scheme for Construction Contracts (1998)', regulator: 'Financial Conduct Authority (FCA)', bondNote: 'On-demand performance bond + APG common; 5% retention typical' },
      { code: 'SC', label: 'Scotland',        statute: 'Scheme for Construction Contracts (Scotland) Regulations 1998',                                    regulator: 'Financial Conduct Authority (FCA)', bondNote: 'Scottish-law variants on JCT/SBCC contracts' },
      { code: 'NI', label: 'Northern Ireland',statute: 'Construction Contracts (Northern Ireland) Order 1997',                                              regulator: 'Financial Conduct Authority (FCA)', bondNote: 'Similar to E&W; NI-specific JCT amendments' },
    ],
  },
  {
    code: 'AU', flag: '🇦🇺', label: 'Australia / NZ',
    docStandard: 'AS 4000-1997 (general conditions), AS 2124-1992; AS 4902/4903 for D&C',
    federalStatute: 'No federal construction statute; each state has Security of Payment Act',
    carriers: ['QBE', 'Vero', 'Assetinsure', 'Berkley Insurance Australia', 'Liberty Specialty Markets'],
    regions: [
      { code: 'NSW', label: 'New South Wales',   statute: 'Building and Construction Industry Security of Payment Act 1999 (NSW)',  regulator: 'NSW Fair Trading',           bondNote: 'Bank guarantees common; SOP adjudication available' },
      { code: 'VIC', label: 'Victoria',          statute: 'Building and Construction Industry Security of Payment Act 2002 (Vic)',  regulator: 'Victorian Building Authority',bondNote: 'AS 4000 standard; bank guarantees > insurance bonds' },
      { code: 'QLD', label: 'Queensland',        statute: 'Building Industry Fairness (Security of Payment) Act 2017 (Qld)',         regulator: 'QBCC',                       bondNote: 'BIF Act adjudication + project bank accounts on Qld government work' },
      { code: 'WA',  label: 'Western Australia', statute: 'Building and Construction Industry (Security of Payment) Act 2021 (WA)', regulator: 'WA Building Commission',     bondNote: 'New SOP regime effective 2022' },
      { code: 'SA',  label: 'South Australia',   statute: 'Building and Construction Industry Security of Payment Act 2009 (SA)',  regulator: 'Consumer and Business Services SA', bondNote: 'AS-format bonds standard' },
      { code: 'TAS', label: 'Tasmania',          statute: 'Building and Construction Industry Security of Payment Act 2009 (Tas)', regulator: 'Consumer, Building and Occupational Services',bondNote: 'AS-format bonds standard' },
      { code: 'ACT', label: 'ACT',               statute: 'Building and Construction Industry (Security of Payment) Act 2009 (ACT)',regulator: 'Access Canberra',            bondNote: 'AS-format bonds standard' },
      { code: 'NT',  label: 'Northern Territory',statute: 'Construction Contracts (Security of Payments) Act 2004 (NT)',           regulator: 'NT Building Practitioners Board', bondNote: 'AS-format bonds standard' },
      { code: 'NZ',  label: 'New Zealand',       statute: 'Construction Contracts Act 2002',                                       regulator: 'Ministry of Business, Innovation and Employment', bondNote: 'NZS 3910 contracts; bank guarantees common' },
    ],
  },
];

export function findJurisdiction(countryCode) {
  return JURISDICTIONS.find((j) => j.code === countryCode) || JURISDICTIONS[0];
}

export function findRegion(countryCode, regionCode) {
  const country = findJurisdiction(countryCode);
  if (!country) return null;
  return country.regions.find((r) => r.code === regionCode) || country.regions[0] || null;
}
