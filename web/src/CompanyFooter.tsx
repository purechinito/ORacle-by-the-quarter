import '../../apps/quarter_erp/quarter_erp/public/branding/footer.css';

export function CompanyFooter({note}: {note?: string}) {
  return <footer className="company-footer" aria-label="Super Q company information">
    <div className="company-footer__identity">
      <img src="/assets/quarter_erp/branding/ngosiok-marketing.jpg" width="42" height="42" alt="Ngosiok Marketing logo" decoding="async"/>
      <div>
        <div className="company-footer__name">Super Q ERP <span aria-hidden="true">·</span> <strong>NGOSIOK MARKETING</strong></div>
        <p className="company-footer__tagline">Quality Noodles Since 1945</p>
      </div>
    </div>
    <div className="company-footer__links">
      <a href="https://www.superq.ph/" target="_blank" rel="noopener noreferrer">superq.ph <span aria-hidden="true">↗</span><span className="company-footer__sr"> (opens in a new tab)</span></a>
      <span className="company-footer__copyright">© {new Date().getFullYear()} Ngosiok Marketing</span>
    </div>
    {note && <p className="company-footer__note">{note}</p>}
  </footer>;
}
