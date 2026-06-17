/**
 * Returns the person's age as of December 31 of the given tax year.
 * @param {string|null} dob - ISO date string (YYYY-MM-DD)
 * @param {object|null} sectionData - section-level form data (must contain tax_year)
 * @returns {number|null}
 */
export function ageAsOfYearEnd(dob, sectionData) {
  if (!dob) return null;
  const taxYear = Number(sectionData?.tax_year);
  if (!Number.isFinite(taxYear)) return null;
  const birth = new Date(dob + "T00:00:00");
  const dec31 = new Date(taxYear, 11, 31);
  let age = dec31.getFullYear() - birth.getFullYear();
  const m = dec31.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && dec31.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}
