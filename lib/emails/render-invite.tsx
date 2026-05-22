/**
 * Renders the invite email to HTML string.
 * Kept in a .tsx file so JSX is valid.
 */
import { render } from "@react-email/render";
import { InviteEmail } from "./invite";

export async function renderInviteEmail(props: {
  firmName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
}): Promise<string> {
  return render(
    <InviteEmail
      firmName={props.firmName}
      inviterName={props.inviterName}
      role={props.role}
      acceptUrl={props.acceptUrl}
      expiresInDays={props.expiresInDays}
    />
  );
}
