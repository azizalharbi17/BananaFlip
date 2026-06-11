import Link from "next/link";

export default function NotFound() {
  return (
    <header className="hero wrap">
      <div>
        <div className="eyebrow">404</div>
        <h1>
          No such <span className="gold">flip</span>.
        </h1>
        <p>
          That pair isn&apos;t in the dataset. Try a URL like{" "}
          <span className="mono">/pepe-flip-doge</span>, or head back to the machine.
        </p>
        <p>
          <Link href="/" style={{ color: "var(--gold-hi)" }}>
            ← Back to BananaFlip
          </Link>
        </p>
      </div>
    </header>
  );
}
