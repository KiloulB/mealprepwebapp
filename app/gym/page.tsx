import MuscleMap from "../components/gym/muscle-map/MuscleMap";

export default function HomePage() {
  return (
    <main style={{ padding: 16 }}>
      <h1>Home</h1>
      <p>This is a basic Next.js page.</p>

      <div style={{ display: "grid", gap: 16, maxWidth: 520 }}>
        <div>
          <h2 style={{ margin: "8px 0" }}>Front</h2>
          <MuscleMap view="front" workedSlugs={["chest", "abs", "biceps"]} height={280} />
        </div>

        <div>
          <h2 style={{ margin: "8px 0" }}>Back</h2>
          <MuscleMap view="back" workedSlugs={["upper-back", "lower-back", "gluteal"]} height={280} />
        </div>
      </div>
    </main>
  );
}
