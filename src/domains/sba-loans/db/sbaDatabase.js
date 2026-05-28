/**
 * SBA Loans Database Service
 * Handles persistence of loan applications, analyses, and documents
 *
 * Note: This requires Supabase client initialization
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY in .env
 */

let supabase = null;

/**
 * Initialize Supabase client
 */
export function initializeSBADB(supabaseClient) {
  supabase = supabaseClient;
}

/**
 * Create a new SBA loan application
 */
export async function createLoan(loanData) {
  if (!supabase) throw new Error('Supabase not initialized');

  const {
    borrowerName,
    businessName,
    requestedAmount,
    program = '7(a)',
    purpose,
    monthlyDebtService,
    annualDebtService,
    dscrRatio,
    requiredEquityPercent,
    requiredEquityAmount,
  } = loanData;

  try {
    const { data: loanRecord, error: loanError } = await supabase
      .from('sba_loans')
      .insert([
        {
          borrower_name: borrowerName,
          business_name: businessName,
          requested_amount: requestedAmount,
          program,
          purpose,
          status: 'draft',
          monthly_debt_service: monthlyDebtService,
          annual_debt_service: annualDebtService,
          dscr_ratio: dscrRatio,
          required_equity_percent: requiredEquityPercent,
          required_equity_amount: requiredEquityAmount,
          analysis_complete: false,
          term_sheet_generated: false,
        },
      ])
      .select();

    if (loanError) throw loanError;

    return {
      success: true,
      loanId: loanRecord[0].id,
      loan: loanRecord[0],
    };
  } catch (error) {
    console.error('Failed to create SBA loan:', error);
    throw error;
  }
}

/**
 * Store uploaded financial document
 */
export async function storeDocument(documentData) {
  if (!supabase) throw new Error('Supabase not initialized');

  const {
    loanId,
    documentName,
    documentType,
    fileFormat,
    rawExtractedData,
    normalizedData,
    extractionConfidence,
    extractionErrors,
  } = documentData;

  try {
    const { data: docRecord, error: docError } = await supabase
      .from('sba_documents')
      .insert([
        {
          loan_id: loanId,
          document_name: documentName,
          document_type: documentType,
          file_format: fileFormat,
          extracted_at: new Date().toISOString(),
          extraction_confidence: extractionConfidence,
          extraction_errors: extractionErrors || [],
          raw_extracted_data: rawExtractedData,
          normalized_data: normalizedData,
        },
      ])
      .select();

    if (docError) throw docError;

    return {
      success: true,
      documentId: docRecord[0].id,
    };
  } catch (error) {
    console.error('Failed to store document:', error);
    throw error;
  }
}

/**
 * Store loan analysis results
 */
export async function storeAnalysis(analysisData) {
  if (!supabase) throw new Error('Supabase not initialized');

  const {
    loanId,
    revenue,
    expenses,
    ebitda,
    netIncome,
    totalAssets,
    totalLiabilities,
    ownerEquity,
    workingCapital,
    debtToEquity,
    currentRatio,
    quickRatio,
    profitMargin,
    strengthSummary,
    riskFlags,
  } = analysisData;

  try {
    const { data: analysisRecord, error: analysisError } = await supabase
      .from('sba_analyses')
      .insert([
        {
          loan_id: loanId,
          revenue,
          expenses,
          ebitda,
          net_income: netIncome,
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
          owner_equity: ownerEquity,
          working_capital: workingCapital,
          debt_to_equity: debtToEquity,
          current_ratio: currentRatio,
          quick_ratio: quickRatio,
          profit_margin: profitMargin,
          strength_summary: strengthSummary,
          risk_flags: riskFlags || [],
        },
      ])
      .select();

    if (analysisError) throw analysisError;

    // Mark loan as having complete analysis
    await supabase
      .from('sba_loans')
      .update({ analysis_complete: true })
      .eq('id', loanId);

    return {
      success: true,
      analysisId: analysisRecord[0].id,
    };
  } catch (error) {
    console.error('Failed to store analysis:', error);
    throw error;
  }
}

/**
 * Store amortization schedule
 */
export async function storeAmortizationSchedule(scheduleData) {
  if (!supabase) throw new Error('Supabase not initialized');

  const {
    loanId,
    principalAmount,
    annualInterestRate,
    loanTermYears,
    schedule,
    totalInterest,
    totalPayments,
  } = scheduleData;

  try {
    const { data: scheduleRecord, error: scheduleError } = await supabase
      .from('sba_amortization_schedules')
      .insert([
        {
          loan_id: loanId,
          principal_amount: principalAmount,
          annual_interest_rate: annualInterestRate,
          loan_term_years: loanTermYears,
          schedule_data: schedule,
          total_interest: totalInterest,
          total_payments: totalPayments,
          start_date: new Date().toISOString().split('T')[0],
        },
      ])
      .select();

    if (scheduleError) throw scheduleError;

    return {
      success: true,
      scheduleId: scheduleRecord[0].id,
    };
  } catch (error) {
    console.error('Failed to store amortization schedule:', error);
    throw error;
  }
}

/**
 * Store generated term sheet
 */
export async function storeTermSheet(termSheetData) {
  if (!supabase) throw new Error('Supabase not initialized');

  const {
    loanId,
    borrowerName,
    lenderName,
    effectiveDate,
    maturityDate,
    facilitySummary,
    covenants,
    collateralSummary,
    underwritingNarrative,
    htmlContent,
  } = termSheetData;

  try {
    const { data: tsRecord, error: tsError } = await supabase
      .from('sba_term_sheets')
      .insert([
        {
          loan_id: loanId,
          title: `Term Sheet for ${borrowerName}`,
          borrower_name: borrowerName,
          lender_name: lenderName,
          effective_date: effectiveDate,
          maturity_date: maturityDate,
          facility_summary: facilitySummary,
          covenants,
          collateral_summary: collateralSummary,
          underwriting_narrative: underwritingNarrative,
          html_content: htmlContent,
          status: 'draft',
          generated_at: new Date().toISOString(),
        },
      ])
      .select();

    if (tsError) throw tsError;

    // Mark loan as having term sheet
    await supabase
      .from('sba_loans')
      .update({ term_sheet_generated: true })
      .eq('id', loanId);

    return {
      success: true,
      termSheetId: tsRecord[0].id,
    };
  } catch (error) {
    console.error('Failed to store term sheet:', error);
    throw error;
  }
}

/**
 * Retrieve a loan with all related data
 */
export async function getLoan(loanId) {
  if (!supabase) throw new Error('Supabase not initialized');

  try {
    const { data: loan, error: loanError } = await supabase
      .from('sba_loans')
      .select('*')
      .eq('id', loanId)
      .single();

    if (loanError) throw loanError;

    // Get documents
    const { data: documents } = await supabase
      .from('sba_documents')
      .select('*')
      .eq('loan_id', loanId);

    // Get analysis
    const { data: analyses } = await supabase
      .from('sba_analyses')
      .select('*')
      .eq('loan_id', loanId);

    // Get amortization schedule
    const { data: schedules } = await supabase
      .from('sba_amortization_schedules')
      .select('*')
      .eq('loan_id', loanId);

    // Get term sheet
    const { data: termSheets } = await supabase
      .from('sba_term_sheets')
      .select('*')
      .eq('loan_id', loanId);

    return {
      loan,
      documents: documents || [],
      analyses: analyses || [],
      amortizationSchedules: schedules || [],
      termSheets: termSheets || [],
    };
  } catch (error) {
    console.error('Failed to get loan:', error);
    throw error;
  }
}

/**
 * List all loans with optional filters
 */
export async function listLoans(filters = {}) {
  if (!supabase) throw new Error('Supabase not initialized');

  try {
    let query = supabase.from('sba_loans').select('*');

    // Apply filters
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.borrowerName) query = query.ilike('borrower_name', `%${filters.borrowerName}%`);
    if (filters.program) query = query.eq('program', filters.program);
    if (filters.startDate) {
      query = query.gte('created_at', new Date(filters.startDate).toISOString());
    }
    if (filters.endDate) {
      query = query.lte('created_at', new Date(filters.endDate).toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to list loans:', error);
    throw error;
  }
}

/**
 * Update loan status
 */
export async function updateLoanStatus(loanId, status) {
  if (!supabase) throw new Error('Supabase not initialized');

  try {
    const { data, error } = await supabase
      .from('sba_loans')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loanId)
      .select();

    if (error) throw error;

    return data[0];
  } catch (error) {
    console.error('Failed to update loan status:', error);
    throw error;
  }
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary(dateRange = null) {
  if (!supabase) throw new Error('Supabase not initialized');

  try {
    let query = supabase
      .from('sba_loans')
      .select('status, requested_amount, dscr_ratio, created_at');

    if (dateRange) {
      const { startDate, endDate } = dateRange;
      query = query
        .gte('created_at', new Date(startDate).toISOString())
        .lte('created_at', new Date(endDate).toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate summary stats
    const stats = {
      total: data.length,
      totalAmount: data.reduce((sum, d) => sum + (d.requested_amount || 0), 0),
      byStatus: {
        draft: data.filter((d) => d.status === 'draft').length,
        submitted: data.filter((d) => d.status === 'submitted').length,
        approved: data.filter((d) => d.status === 'approved').length,
        declined: data.filter((d) => d.status === 'declined').length,
      },
      averageDSCR: (
        data.filter((d) => d.dscr_ratio).reduce((sum, d) => sum + d.dscr_ratio, 0) /
        Math.max(1, data.filter((d) => d.dscr_ratio).length)
      ).toFixed(2),
    };

    return stats;
  } catch (error) {
    console.error('Failed to get analytics summary:', error);
    throw error;
  }
}

/**
 * Export all database functions
 */
export default {
  initializeSBADB,
  createLoan,
  storeDocument,
  storeAnalysis,
  storeAmortizationSchedule,
  storeTermSheet,
  getLoan,
  listLoans,
  updateLoanStatus,
  getAnalyticsSummary,
};
