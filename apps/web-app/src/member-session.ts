/** The signed-in member, as member pages and the messages feature see it. */
export interface MemberSession {
  personId: string;
  name?: string;
  hasCompany: boolean;
  /** The active company and the person's role in it (for the company inbox, N08). */
  companyId?: string;
  companyRole?: string;
}
