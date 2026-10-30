import { MessageTable } from "../../outbox/message-table";

export async function EmailsTab({ dealId }: { dealId: string }) {
  return <MessageTable where={{ dealId }} />;
}
