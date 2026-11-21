import { signOut } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
      >
        Sign Out
      </button>
    </form>
  );
}