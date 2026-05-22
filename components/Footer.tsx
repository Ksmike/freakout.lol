export function Footer() {
  return (
    <footer className="border-t border-divider bg-content1 px-4 py-6 text-sm text-foreground/40 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} KG Qualify, Inc.</p>
        <p>Evidence-backed knowledge workflows for regulated teams.</p>
      </div>
    </footer>
  );
}
