export default function StatCard({ label, value, hint }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <h3>{value}</h3>
      <p className="stat-hint">{hint}</p>
    </div>
  );
}
