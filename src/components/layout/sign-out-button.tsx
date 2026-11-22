import { signOut } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="button-secondary"
      >
        Sign Out
      </button>
    </form>
  );
}