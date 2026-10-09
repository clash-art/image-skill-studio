export default function StudioLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="正在打开 Image Skill Studio"
      style={{ minHeight: "100svh", background: "#f5f0e6" }}
    >
      <span className="sr-only">正在打开 Image Skill Studio</span>
    </main>
  );
}
