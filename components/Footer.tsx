export default function Footer({ isDemoData }: { isDemoData: boolean }) {
  return (
    <footer>
      <div className="wrap foot-in">
        <div className="foot-left">
          <span>BANANAFLIP · A BANANAZONE PRODUCT</span>
          <span>© 2026 BananaZone LLC</span>
        </div>
        <span>
          {isDemoData
            ? "ALL NUMBERS ARE MOCK DATA"
            : "DATA BY COINPAPRIKA · NOT FINANCIAL ADVICE"}
        </span>
      </div>
    </footer>
  );
}
