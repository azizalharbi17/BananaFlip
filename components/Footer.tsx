export default function Footer({ isDemoData }: { isDemoData: boolean }) {
  return (
    <footer>
      <div className="wrap foot-in">
        <span>© 2026 BananaZone LLC</span>
        <span>
          {isDemoData
            ? "ALL NUMBERS ARE MOCK DATA"
            : "DATA BY COINPAPRIKA · NOT FINANCIAL ADVICE"}
        </span>
      </div>
    </footer>
  );
}
