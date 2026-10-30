/** "or" separator between Google sign-in and the email form. */
export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-[13px] text-text-tertiary">
      <span className="flex-1 border-t border-border-subtle" aria-hidden />
      or use your email
      <span className="flex-1 border-t border-border-subtle" aria-hidden />
    </div>
  );
}
