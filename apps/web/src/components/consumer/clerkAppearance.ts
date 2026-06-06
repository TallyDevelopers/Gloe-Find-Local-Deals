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
 * (Apple + Google + TikTok). The "Development mode" badge clears on production.
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
