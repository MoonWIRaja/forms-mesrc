export default function Placeholder({ title }: { title: string }) {
  return (
    <section className="card">
      <h1>{title}</h1>
      <p className="notice">
        Placeholder page. No accounts, credentials or data are connected yet.
      </p>
    </section>
  );
}