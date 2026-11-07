import TicketDetailClient from "./TicketDetailClient";

export function generateStaticParams() {
  return [{ id: "ticket-id" }];
}

export default function TicketDetailPage() {
  return <TicketDetailClient />;
}
