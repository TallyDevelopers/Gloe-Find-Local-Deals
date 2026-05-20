import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <SignUp
        appearance={{
          variables: {
            colorPrimary: '#a87044',
            colorBackground: '#ffffff',
            colorText: '#2b2019',
            borderRadius: '12px',
            fontFamily: 'Inter, sans-serif',
          },
        }}
        forceRedirectUrl="/vendor"
      />
    </main>
  );
}
