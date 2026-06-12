/**
 * Brand-matched Clerk appearance — "Warm Editorial". Shared by the sign-in modal
 * (`useSignInModal`) and the standalone `/sign-in` + `/sign-up` pages so they
 * look identical, and visually parallel to the native app's auth sheet (centered
 * Gloē wordmark, warm welcome, social-first, email below).
 *
 * Colors come from the consumer design tokens (globals.css / @gloe/ui); fonts
 * are the site's self-hosted Clash Display (headings) + General Sans (body),
 * declared globally so Clerk's components can use them.
 *
 * Set in the Clerk DASHBOARD, not here (appearance only styles): the app name
 * ("Gloē"), the logo (shows above the title), and which SSO providers appear
 * (Apple + Google — Facebook/TikTok dropped 2026-06-12, fewer prod creds +
 * less choice paralysis). The "Development mode" badge clears on production.
 */
const BRAND = {
  rose: '#b8806f', // brand-600
  roseDeep: '#9a6757', // brand-700 (hover)
  roseSoft: '#c89a8c', // brand-500
  text: '#2b2019', // text-primary
  textSoft: '#5e5147', // text-secondary
  textMuted: '#8c7f73', // text-tertiary
  card: '#ffffff', // surface-elevated
  blush: '#faf5f2', // surface-primary (warm pearl)
  blushHover: '#f6e4de', // brand-100
  border: '#e8dad2', // border-subtle
} as const;

export const CLERK_APPEARANCE = {
  layout: {
    socialButtonsPlacement: 'top', // social-first, like the app sheet
    socialButtonsVariant: 'blockButton',
    showOptionalFields: false,
  },
  variables: {
    colorPrimary: BRAND.rose,
    colorBackground: BRAND.card,
    colorText: BRAND.text,
    colorTextSecondary: BRAND.textSoft,
    colorInputBackground: BRAND.card,
    colorInputText: BRAND.text,
    colorDanger: '#b24545',
    borderRadius: '14px',
    spacingUnit: '1rem',
    fontFamily: "'General Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontFamilyButtons: "'General Sans', sans-serif",
  },
  elements: {
    // Warm pearl modal on a soft, slightly warm backdrop.
    modalBackdrop: { backgroundColor: 'rgba(43, 32, 25, 0.45)', backdropFilter: 'blur(2px)' },
    modalContent: {
      borderRadius: '24px',
      overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(43, 32, 25, 0.22)',
    },
    // Pearl surface for the card body (modal + page both).
    card: { boxShadow: 'none', backgroundColor: BRAND.blush, padding: '2rem 1.75rem' },
    rootBox: { width: '100%' },
    header: { textAlign: 'center' },
    headerTitle: {
      fontFamily: "'Clash Display', sans-serif",
      fontWeight: 500,
      fontSize: '1.7rem',
      letterSpacing: '-0.01em',
      color: BRAND.text,
    },
    headerSubtitle: { color: BRAND.textSoft, fontSize: '0.95rem' },

    // Social buttons — warm pill, logo + label, like the native sheet.
    socialButtonsBlockButton: {
      borderColor: BRAND.border,
      borderRadius: '999px',
      minHeight: '52px',
      fontWeight: 500,
      color: BRAND.text,
      '&:hover': { backgroundColor: BRAND.blush, borderColor: BRAND.roseSoft },
    },
    socialButtonsBlockButtonText: { fontWeight: 500, fontSize: '0.95rem' },

    dividerLine: { backgroundColor: BRAND.border },
    dividerText: { color: BRAND.textMuted, fontSize: '0.85rem' },

    formFieldLabel: { color: BRAND.textSoft, fontWeight: 500 },
    formFieldInput: {
      backgroundColor: BRAND.card,
      borderColor: BRAND.border,
      borderRadius: '12px',
      minHeight: '50px',
      '&:focus': { borderColor: BRAND.rose, boxShadow: `0 0 0 3px ${BRAND.roseSoft}33` },
    },

    formButtonPrimary: {
      backgroundColor: BRAND.rose,
      borderRadius: '999px',
      minHeight: '52px',
      fontWeight: 600,
      fontSize: '0.98rem',
      textTransform: 'none',
      boxShadow: 'none',
      '&:hover': { backgroundColor: BRAND.roseDeep },
      '&:focus': { boxShadow: `0 0 0 3px ${BRAND.roseSoft}55` },
    },

    footer: { textAlign: 'center' },
    footerActionText: { color: BRAND.textSoft },
    footerActionLink: { color: BRAND.rose, fontWeight: 600, '&:hover': { color: BRAND.roseDeep } },
    // Quiet Clerk's dev badge so it doesn't shout on the test instance.
    badge: { display: 'none' },
  },
} as const;

/**
 * Variant for the STANDALONE /sign-in + /sign-up pages. The modal needs
 * `rootBox: 100%` to fill its shell, but on a page that stretches the wrapper
 * across the viewport and the card inside left-aligns — so pages use the
 * card's intrinsic width and let the page's flex centering do its job.
 */
export const CLERK_PAGE_APPEARANCE = {
  ...CLERK_APPEARANCE,
  elements: {
    ...CLERK_APPEARANCE.elements,
    rootBox: { width: 'auto' },
  },
} as const;

/**
 * Variant for the BUSINESS auth shell (BizAuthShell). The shell already shows
 * the Gloē FOR BUSINESS wordmark and renders its own business-specific heading
 * above the card, so Clerk's in-card logo + generic "Create your account /
 * Welcome!" header are hidden — that duplication is what made the prebuilt
 * card feel like a bolted-on widget. The card also drops its tinted surface
 * so it sits flush on the page instead of reading as a box-in-a-box.
 */
export const CLERK_BIZ_APPEARANCE = {
  ...CLERK_PAGE_APPEARANCE,
  elements: {
    ...CLERK_PAGE_APPEARANCE.elements,
    logoBox: { display: 'none' },
    logoImage: { display: 'none' },
    header: { display: 'none' },
    // The wrapper is invisible here, but it still clips: kill its radius +
    // overflow so the social buttons' rounded corners don't get shaved.
    card: { boxShadow: 'none', backgroundColor: 'transparent', padding: '0.5rem 2px 0' },
    cardBox: { boxShadow: 'none', border: 'none', borderRadius: 0, overflow: 'visible' },
    footer: { textAlign: 'center', background: 'transparent' },
  },
} as const;

/**
 * Variant for INVITED owners (claim & invite, GLO-5). The Clerk ticket binds
 * the account to the invited email — an SSO button here would let them sign
 * up as a different address, the claim-by-email match would miss, and they'd
 * fall into the signup form and create the duplicate vendor the invite flow
 * exists to prevent. So: password only, no social row.
 */
export const CLERK_INVITED_BIZ_APPEARANCE = {
  ...CLERK_BIZ_APPEARANCE,
  elements: {
    ...CLERK_BIZ_APPEARANCE.elements,
    socialButtons: { display: 'none' },
    socialButtonsBlockButton: { display: 'none' },
    dividerRow: { display: 'none' },
  },
} as const;
